import { Storage } from "@google-cloud/storage";
import { Readable } from "stream";
import { createHash, createHmac, randomUUID } from "crypto";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// Persistent fallback directory for local disk storage, used when neither a GCS
// service account nor Replit Object Storage bucket paths are configured. Lives
// inside the working directory (the workspace in Replit dev) so it survives
// restarts and does not require any environment configuration.
const DEFAULT_LOCAL_STORAGE_PATH = path.resolve(process.cwd(), ".uploads");

export type { ObjectAclPolicy, ObjectPermission } from "./objectAcl";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface StorageFile {
  exists(): Promise<[boolean]>;
  createReadStream(): NodeJS.ReadableStream;
  getMetadata(): Promise<[{ contentType?: string; size?: number | string }]>;
  save(buffer: Buffer, options: { contentType: string; resumable?: boolean }): Promise<void>;
}

/**
 * Resolve a user-supplied sub-path under a known root and reject any
 * attempt to escape the root via ".." segments or absolute paths.
 */
function safeJoin(root: string, userPath: string): string {
  // Strip leading slashes to prevent path.join treating it as absolute
  const stripped = userPath.replace(/^[/\\]+/, "");
  const resolved = path.resolve(root, stripped);
  const normalizedRoot = path.resolve(root);
  if (!resolved.startsWith(normalizedRoot + path.sep) && resolved !== normalizedRoot) {
    throw Object.assign(
      new Error("Path traversal attempt rejected"),
      { statusCode: 400 }
    );
  }
  return resolved;
}

/**
 * LocalFile: persists file data + content-type (in a ".meta" sidecar).
 * Reconstructs content-type on retrieval so images are served correctly.
 */
class LocalFile implements StorageFile {
  private readonly metaPath: string;

  constructor(private readonly filePath: string) {
    this.metaPath = filePath + ".meta";
  }

  async exists(): Promise<[boolean]> {
    try {
      await fsPromises.access(this.filePath);
      return [true];
    } catch {
      return [false];
    }
  }

  createReadStream(): NodeJS.ReadableStream {
    return fs.createReadStream(this.filePath);
  }

  async getMetadata(): Promise<[{ contentType?: string; size?: number | string }]> {
    const stat = await fsPromises.stat(this.filePath);
    let contentType = "application/octet-stream";
    try {
      const meta = await fsPromises.readFile(this.metaPath, "utf8");
      const parsed = JSON.parse(meta) as { contentType?: string };
      if (parsed.contentType) contentType = parsed.contentType;
    } catch {
      // No sidecar — default MIME
    }
    return [{ contentType, size: stat.size }];
  }

  async save(buffer: Buffer, options: { contentType: string }): Promise<void> {
    await fsPromises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsPromises.writeFile(this.filePath, buffer);
    await fsPromises.writeFile(this.metaPath, JSON.stringify({ contentType: options.contentType }));
  }
}

type StorageMode = "r2" | "gcs" | "replit" | "local";

function detectStorageMode(): StorageMode {
  if (
    process.env.CLOUDFLARE_R2_ACCOUNT_ID &&
    process.env.CLOUDFLARE_R2_BUCKET_NAME &&
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  ) {
    return "r2";
  }
  // Explicit GCS service account — Railway production with a GCS bucket.
  if (process.env.GOOGLE_CREDENTIALS_JSON) return "gcs";
  // Replit-managed Object Storage — only when the bucket paths are configured.
  // REPL_ID alone is NOT sufficient: without PRIVATE_OBJECT_DIR and
  // PUBLIC_OBJECT_SEARCH_PATHS the GCS-backed code path cannot resolve a bucket
  // and uploadBuffer() would throw. In that case we fall through to local disk
  // storage so uploads keep working in Replit dev without any extra config.
  if (
    (process.env.REPL_ID || process.env.REPLIT_DEV_DOMAIN) &&
    process.env.PRIVATE_OBJECT_DIR &&
    process.env.PUBLIC_OBJECT_SEARCH_PATHS
  ) {
    return "replit";
  }
  // Everything else uses local disk storage. An explicit STORAGE_LOCAL_PATH
  // (e.g. a Railway Volume) is honoured by getLocalBase(); otherwise a
  // persistent default path is used so uploads always work.
  return "local";
}

let _mode: StorageMode | undefined;
let _gcsClient: Storage | undefined;

function getMode(): StorageMode {
  if (!_mode) _mode = detectStorageMode();
  return _mode;
}

function getGcsClient(): Storage {
  if (!_gcsClient) {
    const mode = getMode();
    if (mode === "gcs") {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON!) as object;
      _gcsClient = new Storage({ credentials });
    } else if (mode === "replit") {
      _gcsClient = new Storage({
        credentials: {
          audience: "replit",
          subject_token_type: "access_token",
          token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
          type: "external_account",
          credential_source: {
            url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
            format: {
              type: "json",
              subject_token_field_name: "access_token",
            },
          },
          universe_domain: "googleapis.com",
        },
        projectId: "",
      });
    } else {
      throw new Error("GCS client not available in local storage mode");
    }
  }
  return _gcsClient;
}

function getLocalBase(): string {
  const p = process.env.STORAGE_LOCAL_PATH || DEFAULT_LOCAL_STORAGE_PATH;
  return path.resolve(p);
}

/** Resolved storage mode for the current process (for logging/diagnostics). */
export function getStorageMode(): StorageMode {
  return getMode();
}

/** Absolute base directory used in local storage mode. */
export function getLocalStorageBase(): string {
  return getLocalBase();
}

class R2File implements StorageFile {
  constructor(private readonly objectKey: string) {}

  async exists(): Promise<[boolean]> {
    const response = await fetch(
      await createR2PresignedURL({
        objectKey: this.objectKey,
        method: "HEAD",
        expiresInSeconds: 300,
      }),
      { method: "HEAD" },
    );
    if (response.status === 404) return [false];
    if (!response.ok) {
      throw new Error(`R2 HEAD failed with status ${response.status}`);
    }
    return [true];
  }

  createReadStream(): NodeJS.ReadableStream {
    const objectKey = this.objectKey;
    return Readable.from(
      (async function* () {
        const response = await fetch(
          await createR2PresignedURL({
            objectKey,
            method: "GET",
            expiresInSeconds: 300,
          }),
        );
        if (response.status === 404) throw new ObjectNotFoundError();
        if (!response.ok || !response.body) {
          throw new Error(`R2 GET failed with status ${response.status}`);
        }
        for await (const chunk of Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        )) {
          yield chunk;
        }
      })(),
    );
  }

  async getMetadata(): Promise<
    [{ contentType?: string; size?: number | string }]
  > {
    const response = await fetch(
      await createR2PresignedURL({
        objectKey: this.objectKey,
        method: "HEAD",
        expiresInSeconds: 300,
      }),
      { method: "HEAD" },
    );
    if (response.status === 404) throw new ObjectNotFoundError();
    if (!response.ok) {
      throw new Error(`R2 HEAD failed with status ${response.status}`);
    }
    return [
      {
        contentType:
          response.headers.get("content-type") || "application/octet-stream",
        size: response.headers.get("content-length") || undefined,
      },
    ];
  }

  async save(
    buffer: Buffer,
    options: { contentType: string },
  ): Promise<void> {
    const response = await fetch(
      await createR2PresignedURL({
        objectKey: this.objectKey,
        method: "PUT",
        expiresInSeconds: 900,
      }),
      {
        method: "PUT",
        headers: { "Content-Type": options.contentType },
        body: buffer,
      },
    );
    if (!response.ok) {
      throw new Error(`R2 PUT failed with status ${response.status}`);
    }
  }
}

/**
 * Create the local storage directories up-front so the first upload never races
 * on directory creation. No-op when not in local mode. Safe to call on startup.
 */
export async function ensureLocalStorageReady(): Promise<void> {
  if (getMode() !== "local") return;
  const base = getLocalBase();
  await fsPromises.mkdir(path.join(base, "private", "uploads"), { recursive: true });
  await fsPromises.mkdir(path.join(base, "public"), { recursive: true });
}

/**
 * Public base URL prepended to served image URLs.
 * We always store relative paths (/api/uploads/…) so URLs never go stale
 * when the Replit dev domain changes between sessions.
 * Frontends resolve via resolveImg() + VITE_API_URL, and both Vite configs
 * proxy /api/* → localhost:8080 in dev as a safety net.
 * Set PUBLIC_ASSET_BASE_URL to override with a CDN/custom domain.
 */
function getPublicBaseUrl(): string {
  if (process.env.PUBLIC_ASSET_BASE_URL) {
    return process.env.PUBLIC_ASSET_BASE_URL.replace(/\/+$/, "");
  }
  // Always relative — never bake a dev domain into stored URLs.
  return "";
}

function buildPublicUrl(objectId: string): string {
  return `${getPublicBaseUrl()}/api/uploads/${objectId}`;
}

function parseObjectPath(p: string): { bucketName: string; objectName: string } {
  if (!p.startsWith("/")) p = `/${p}`;
  const parts = p.split("/");
  if (parts.length < 3) throw new Error("Invalid path: must contain at least a bucket name");
  return { bucketName: parts[1], objectName: parts.slice(2).join("/") };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const mode = getMode();
  if (mode === "gcs") {
    const file = getGcsClient().bucket(bucketName).file(objectName);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: method === "PUT" ? "write" : method === "DELETE" ? "delete" : "read",
      expires: Date.now() + ttlSec * 1000,
    });
    return url;
  }
  if (mode === "replit") {
    const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method,
        expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Failed to sign object URL: ${response.status}`);
    const json = await response.json() as { signed_url: string };
    return json.signed_url;
  }
  throw new Error(
    "Signed URLs are not supported in local storage mode. Use POST /api/uploads directly."
  );
}

export class ObjectStorageService {
  getPublicObjectSearchPaths(): string[] {
    const mode = getMode();
    if (mode === "local") return [path.join(getLocalBase(), "public")];
    if (mode === "r2") return ["public"];
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(pathsStr.split(",").map(p => p.trim()).filter(p => p.length > 0))
    );
    if (paths.length === 0) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set.");
    return paths;
  }

  getPrivateObjectDir(): string {
    const mode = getMode();
    if (mode === "local") return path.join(getLocalBase(), "private");
    if (mode === "r2") return "/private";
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) throw new Error("PRIVATE_OBJECT_DIR not set.");
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<StorageFile | null> {
    const mode = getMode();
    if (mode === "r2") {
      const file = new R2File(`public/${filePath.replace(/^\/+/, "")}`);
      const [exists] = await file.exists();
      return exists ? file : null;
    }
    if (mode === "local") {
      const root = path.join(getLocalBase(), "public");
      let resolved: string;
      try { resolved = safeJoin(root, filePath); } catch { return null; }
      const f = new LocalFile(resolved);
      const [exists] = await f.exists();
      return exists ? f : null;
    }
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const file = getGcsClient().bucket(bucketName).file(objectName);
      const [exists] = await file.exists();
      if (exists) return file as unknown as StorageFile;
    }
    return null;
  }

  async downloadObject(file: StorageFile, cacheTtlSec: number = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) headers["Content-Length"] = String(metadata.size);
    return new Response(webStream, { headers });
  }

  async uploadBuffer(
    buffer: Buffer,
    contentType: string,
  ): Promise<{ objectPath: string; publicUrl: string }> {
    const objectId = randomUUID();
    const mode = getMode();
    if (mode === "r2") {
      const objectKey = `uploads/${objectId}`;
      const file = new R2File(objectKey);
      await file.save(buffer, { contentType });
      return {
        objectPath: `/objects/${objectKey}`,
        publicUrl: buildPublicUrl(objectId),
      };
    }
    if (mode === "local") {
      const root = path.join(getLocalBase(), "private", "uploads");
      // objectId is a UUID — no traversal risk, but still validate with safeJoin
      const filePath = safeJoin(root, objectId);
      const f = new LocalFile(filePath);
      await f.save(buffer, { contentType });
      return { objectPath: `/objects/uploads/${objectId}`, publicUrl: buildPublicUrl(objectId) };
    }
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const file = getGcsClient().bucket(bucketName).file(objectName);
    await file.save(buffer, { contentType, resumable: false });
    return { objectPath: `/objects/uploads/${objectId}`, publicUrl: buildPublicUrl(objectId) };
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const mode = getMode();
    if (mode === "r2") {
      return createR2PresignedURL({
        objectKey: `uploads/${randomUUID()}`,
        method: "PUT",
        expiresInSeconds: 900,
      });
    }
    if (mode === "local") {
      throw new Error(
        "Signed upload URLs are not supported in local storage mode. Use POST /api/uploads instead."
      );
    }
    const objectId = randomUUID();
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signObjectURL({ bucketName, objectName, method: "PUT", ttlSec: 900 });
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) return rawPath;
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) objectEntityDir = `${objectEntityDir}/`;
    if (!rawObjectPath.startsWith(objectEntityDir)) return rawObjectPath;
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<StorageFile> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) throw new ObjectNotFoundError();
    const entityId = parts.slice(1).join("/");
    const mode = getMode();
    if (mode === "r2") {
      const file = new R2File(entityId);
      const [exists] = await file.exists();
      if (!exists) throw new ObjectNotFoundError();
      return file;
    }
    if (mode === "local") {
      const root = path.join(getLocalBase(), "private");
      let filePath: string;
      try { filePath = safeJoin(root, entityId); } catch { throw new ObjectNotFoundError(); }
      const f = new LocalFile(filePath);
      const [exists] = await f.exists();
      if (!exists) throw new ObjectNotFoundError();
      return f;
    }
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const objectFile = getGcsClient().bucket(bucketName).file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) throw new ObjectNotFoundError();
    return objectFile as unknown as StorageFile;
  }
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
  const secretAccessKey =
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Cloudflare R2 is not configured. Set CLOUDFLARE_R2_ACCOUNT_ID, " +
        "CLOUDFLARE_R2_BUCKET_NAME, CLOUDFLARE_R2_ACCESS_KEY_ID, and " +
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY.",
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

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeR2Path(objectKey: string): string {
  return `/${objectKey.split("/").map(encodeRfc3986).join("/")}`;
}

function toAmzDate(date: Date): { short: string; full: string } {
  const iso = date.toISOString().replace(/[-:]/g, "");
  return {
    short: iso.slice(0, 8),
    full: `${iso.slice(0, 15)}Z`,
  };
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

async function createR2PresignedURL({
  objectKey,
  method,
  expiresInSeconds,
}: {
  objectKey: string;
  method: "GET" | "PUT" | "HEAD";
  expiresInSeconds: number;
}): Promise<string> {
  const config = getR2Config();
  const now = new Date();
  const { short: dateStamp, full: amzDate } = toAmzDate(now);
  const region = "auto";
  const service = "s3";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${encodeRfc3986(config.bucketName)}${encodeR2Path(objectKey)}`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQueryString = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signingKey = hmac(
    hmac(
      hmac(hmac(`AWS4${config.secretAccessKey}`, dateStamp), region),
      service,
    ),
    "aws4_request",
  );
  query["X-Amz-Signature"] = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  const queryString = Object.entries(query)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join("&");
  return `${config.endpoint}/${encodeRfc3986(config.bucketName)}${encodeR2Path(objectKey)}?${queryString}`;
}
