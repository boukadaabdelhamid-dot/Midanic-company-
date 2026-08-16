import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { Readable } from 'stream';
import { File, Storage } from '@google-cloud/storage';
import { pool } from '@workspace/db';

import {
  canAccessObject,
  getObjectAclPolicy,
  ObjectAclPolicy,
  ObjectPermission,
  setObjectAclPolicy,
} from './objectAcl';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

export const objectStorageClient = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export type UploadMetadata = {
  name: string;
  size: number;
  contentType: string;
};

export type UploadTarget = {
  uploadURL: string;
  objectPath: string;
  backend: 'replit' | 'r2' | 'local';
};

type LocalUploadToken = {
  objectId: string;
  expiresAt: number;
  contentType: string;
  maxSize: number;
};

export class ObjectStorageService {
  constructor() {}

  private usesR2ObjectStorage(): boolean {
    return Boolean(
      process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
        process.env.CLOUDFLARE_R2_BUCKET_NAME &&
        process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
        process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    );
  }

  private usesReplitObjectStorage(): boolean {
    return Boolean(
      process.env.REPL_ID &&
        process.env.PRIVATE_OBJECT_DIR &&
        process.env.PUBLIC_OBJECT_SEARCH_PATHS,
    );
  }

  private getLocalTokenSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      throw new Error(
        'SESSION_SECRET is required for local upload links. Configure it in the production environment.',
      );
    }
    return secret;
  }

  private createLocalUploadToken(metadata: UploadMetadata): {
    token: string;
    objectId: string;
  } {
    const payload: LocalUploadToken = {
      objectId: randomUUID(),
      expiresAt: Date.now() + 15 * 60 * 1000,
      contentType: metadata.contentType,
      maxSize: metadata.size,
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = createHmac('sha256', this.getLocalTokenSecret())
      .update(encodedPayload)
      .digest('base64url');
    return {
      token: `${encodedPayload}.${signature}`,
      objectId: payload.objectId,
    };
  }

  private parseLocalUploadToken(token: string): LocalUploadToken | null {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const expectedSignature = createHmac('sha256', this.getLocalTokenSecret())
      .update(encodedPayload)
      .digest('base64url');
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      ) as LocalUploadToken;
      if (
        !payload.objectId ||
        !Number.isFinite(payload.expiresAt) ||
        payload.expiresAt < Date.now() ||
        !Number.isFinite(payload.maxSize) ||
        payload.maxSize < 0
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async createUploadTarget(metadata: UploadMetadata): Promise<UploadTarget> {
    if (this.usesR2ObjectStorage()) {
      const objectKey = createR2ObjectKey(metadata.name);
      return {
        uploadURL: await createR2PresignedURL({
          objectKey,
          method: 'PUT',
          contentType: metadata.contentType,
          expiresInSeconds: 15 * 60,
        }),
        objectPath: `/r2-objects/${objectKey
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`,
        backend: 'r2',
      };
    }

    if (this.usesReplitObjectStorage()) {
      const uploadURL = await this.getObjectEntityUploadURL();
      return {
        uploadURL,
        objectPath: this.normalizeObjectEntityPath(uploadURL),
        backend: 'replit',
      };
    }

    if (metadata.size > 10 * 1024 * 1024) {
      throw new Error(
        'Image uploads outside Replit are limited to 10 MB. Configure S3-compatible storage for larger files.',
      );
    }

    const { token, objectId } = this.createLocalUploadToken(metadata);
    return {
      uploadURL: `/api/storage/uploads/local/${token}`,
      objectPath: `/local-objects/${objectId}`,
      backend: 'local',
    };
  }

  getLocalUpload(token: string): LocalUploadToken | null {
    return this.parseLocalUploadToken(token);
  }

  async saveLocalUpload(
    token: string,
    content: Buffer,
    contentType: string,
  ): Promise<string> {
    const payload = this.parseLocalUploadToken(token);
    if (!payload) throw new Error('Invalid or expired upload link');
    if (content.length > payload.maxSize) {
      throw new Error('Uploaded file is larger than the requested size');
    }
    if (contentType && contentType !== payload.contentType) {
      throw new Error('Uploaded content type does not match the requested type');
    }

    const result = await pool.query(
      `INSERT INTO "uploaded_assets" ("id", "content_type", "data")
       VALUES ($1, $2, $3)
       ON CONFLICT ("id") DO NOTHING
       RETURNING "id"`,
      [payload.objectId, payload.contentType, content],
    );
    if (result.rowCount !== 1) {
      throw new Error('This upload link has already been used');
    }
    return `/local-objects/${payload.objectId}`;
  }

  async getLocalObject(objectId: string): Promise<{
    data: Buffer;
    contentType: string;
  }> {
    if (!/^[0-9a-f-]{36}$/i.test(objectId)) {
      throw new ObjectNotFoundError();
    }
    const result = await pool.query<{
      data: Buffer;
      content_type: string;
    }>(
      `SELECT "data", "content_type"
       FROM "uploaded_assets"
       WHERE "id" = $1`,
      [objectId],
    );
    const asset = result.rows[0];
    if (!asset) {
      throw new ObjectNotFoundError();
    }
    return { data: asset.data, contentType: asset.content_type };
  }

  async confirmLocalObject(objectPath: string): Promise<void> {
    const objectId = objectPath.replace(/^\/local-objects\//, '');
    await this.getLocalObject(objectId);
  }

  async confirmR2Object(objectPath: string): Promise<void> {
    const objectKey = parseR2ObjectPath(objectPath);
    const response = await fetch(
      await createR2PresignedURL({
        objectKey,
        method: 'HEAD',
        expiresInSeconds: 5 * 60,
      }),
      { method: 'HEAD' },
    );
    if (!response.ok) {
      throw new ObjectNotFoundError();
    }
  }

  async downloadR2Object(objectPath: string): Promise<Response> {
    const objectKey = parseR2ObjectPath(objectPath);
    const response = await fetch(
      await createR2PresignedURL({
        objectKey,
        method: 'GET',
        expiresInSeconds: 5 * 60,
      }),
      { method: 'GET' },
    );
    if (response.status === 404) {
      throw new ObjectNotFoundError();
    }
    if (!response.ok) {
      throw new Error(`R2 download failed with status ${response.status}`);
    }

    const headers = new Headers();
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag']) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(response.body, {
      status: response.status,
      headers,
    });
  }

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
    const paths = Array.from(
      new Set(
        pathsStr
          .split(',')
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          'tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths).',
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.',
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(
    file: File,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === 'public';

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      'Content-Type':
        (metadata.contentType as string) || 'application/octet-stream',
      'Cache-Control': `${isPublic ? 'public' : 'private'}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) {
      headers['Content-Length'] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.',
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: 'PUT',
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split('/');
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join('/');
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith('/')) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith('https://storage.googleapis.com/')) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith('/')) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith('/')) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const pathParts = path.split('/');
  if (pathParts.length < 3) {
    throw new Error('Invalid path: must contain at least a bucket name');
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join('/');

  return {
    bucketName,
    objectName,
  };
}

function getR2Config(): {
  accountId: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
} {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Cloudflare R2 is not configured. Set CLOUDFLARE_R2_ACCOUNT_ID, ' +
        'CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_ACCESS_KEY_ID, and ' +
        'CLOUDFLARE_R2_SECRET_ACCESS_KEY.',
    );
  }
  return {
    accountId,
    bucketName,
    accessKeyId,
    secretAccessKey,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

function createR2ObjectKey(fileName: string): string {
  const safeName = fileName
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'upload';
  return `uploads/${randomUUID()}-${safeName}`;
}

function parseR2ObjectPath(objectPath: string): string {
  const prefix = '/r2-objects/';
  if (!objectPath.startsWith(prefix)) {
    throw new ObjectNotFoundError();
  }
  const encodedKey = objectPath.slice(prefix.length);
  try {
    const objectKey = decodeURIComponent(encodedKey);
    if (!objectKey || objectKey.includes('..')) {
      throw new Error('Invalid R2 object path');
    }
    return objectKey;
  } catch {
    throw new ObjectNotFoundError();
  }
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeR2Path(objectKey: string): string {
  return `/${objectKey.split('/').map(encodeRfc3986).join('/')}`;
}

function toAmzDate(date: Date): { short: string; full: string } {
  const iso = date.toISOString().replace(/[-:]/g, '');
  return {
    short: iso.slice(0, 8),
    full: `${iso.slice(0, 15)}Z`,
  };
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

async function createR2PresignedURL({
  objectKey,
  method,
  contentType,
  expiresInSeconds,
}: {
  objectKey: string;
  method: 'GET' | 'PUT' | 'HEAD';
  contentType?: string;
  expiresInSeconds: number;
}): Promise<string> {
  const config = getR2Config();
  const now = new Date();
  const { short: dateStamp, full: amzDate } = toAmzDate(now);
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodeRfc3986(config.bucketName)}${encodeR2Path(objectKey)}`;
  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
    'X-Amz-SignedHeaders': 'host',
  };
  const canonicalQueryString = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&');
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    'host',
    payloadHash,
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), region), service),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey)
    .update(stringToSign)
    .digest('hex');
  query['X-Amz-Signature'] = signature;
  const queryString = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&');
  const url = `${config.endpoint}/${encodeRfc3986(config.bucketName)}${encodeR2Path(objectKey)}?${queryString}`;
  if (method === 'PUT' && contentType) {
    // The upload client sends this header, but it is intentionally not signed.
    // R2 accepts an unsigned Content-Type while the URL remains reusable only
    // for this one short-lived object key.
  }
  return url;
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`,
    );
  }

  const json = await response.json() as { signed_url: string };
  const signedURL = json.signed_url;
  if (typeof signedURL !== 'string') {
    throw new Error('Invalid signed URL response from sidecar');
  }
  return signedURL;
}
