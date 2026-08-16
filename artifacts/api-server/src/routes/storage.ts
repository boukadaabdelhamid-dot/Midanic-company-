import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';

import { requireAuth, requireRole } from '../middlewares/auth';
import { ObjectPermission } from '../lib/objectAcl';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function getRequestOrigin(req: Request): string {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwardedProto || req.protocol;
  return `${protocol}://${req.get('host')}`;
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires admin auth so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  requireAuth,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      const { uploadURL: rawUploadURL, objectPath } =
        await objectStorageService.createUploadTarget({
          name,
          size,
          contentType,
        });
      const uploadURL = rawUploadURL.startsWith('/')
        ? new URL(rawUploadURL, getRequestOrigin(req)).toString()
        : rawUploadURL;

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to generate upload URL',
      });
    }
  },
);

/**
 * PUT /storage/uploads/local/:token
 *
 * Fallback upload endpoint for deployments that do not have the Replit
 * Object Storage sidecar (for example Railway). The signed token is short
 * lived and binds the upload to its requested size and content type.
 */
router.put(
  '/storage/uploads/local/:token',
  async (req: Request, res: Response) => {
    try {
      const token = Array.isArray(req.params.token)
        ? req.params.token[0]
        : req.params.token;
      const upload = objectStorageService.getLocalUpload(token);
      if (!upload) {
        res.status(401).json({ error: 'Invalid or expired upload link' });
        return;
      }

      const contentLength = Number(req.headers['content-length'] || 0);
      if (contentLength > upload.maxSize) {
        res.status(413).json({ error: 'Uploaded file is too large' });
        return;
      }

      let bytes = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          bytes += chunk.length;
          if (bytes > upload.maxSize) {
            callback(new Error('Uploaded file is too large'));
            return;
          }
          callback(null, chunk);
        },
      });
      const chunks: Buffer[] = [];
      limiter.on('data', (chunk: Buffer) => chunks.push(chunk));
      await pipeline(req, limiter);

      await objectStorageService.saveLocalUpload(
        token,
        Buffer.concat(chunks),
        String(req.headers['content-type'] || ''),
      );
      res.status(201).json({ objectPath: `/local-objects/${upload.objectId}` });
    } catch (error) {
      req.log.error({ err: error }, 'Error saving local upload');
      res.status(400).json({
        error:
          error instanceof Error ? error.message : 'Failed to save upload',
      });
    }
  },
);

/**
 * GET /storage/r2-objects/*
 *
 * Stable public download URL for objects stored in Cloudflare R2. The API
 * signs a short-lived GET request on every access, so the database can keep a
 * permanent path without exposing R2 credentials.
 */
router.get(
  '/storage/r2-objects/*objectKey',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.objectKey;
      const encodedPath = Array.isArray(raw) ? raw.join('/') : raw;
      const response = await objectStorageService.downloadR2Object(
        `/r2-objects/${encodedPath}`,
      );
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      req.log.error({ err: error }, 'Error serving R2 object');
      res.status(500).json({ error: 'Failed to serve R2 object' });
    }
  },
);

router.get(
  '/storage/local-objects/:objectId',
  async (req: Request, res: Response) => {
    try {
      const object = await objectStorageService.getLocalObject(
        Array.isArray(req.params.objectId)
          ? req.params.objectId[0]
          : req.params.objectId,
      );
      res.type(object.contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(object.data);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      req.log.error({ err: error }, 'Error serving local object');
      res.status(500).json({ error: 'Failed to serve file' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * POST /storage/uploads/confirm-public
 *
 * Called by the admin client after a successful presigned-URL upload to GCS.
 * Sets the object's ACL to public visibility so it can be served via the
 * /storage/objects/* endpoint without authentication.
 * Requires admin auth — only admins may promote uploaded objects to public.
 */
router.post(
  '/storage/uploads/confirm-public',
  requireAuth,
  requireRole('super_admin'),
  async (req: Request, res: Response) => {
    const { objectPath } = req.body as { objectPath?: string };
    if (!objectPath || typeof objectPath !== 'string') {
      res.status(400).json({ error: 'objectPath is required' });
      return;
    }
    try {
       if (objectPath.startsWith('/local-objects/')) {
        await objectStorageService.confirmLocalObject(objectPath);
       } else if (objectPath.startsWith('/r2-objects/')) {
         await objectStorageService.confirmR2Object(objectPath);
      } else {
        await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
          owner: 'admin',
          visibility: 'public',
        });
      }
      res.json({ objectPath, visibility: 'public' });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: 'Object not found — upload may not have completed yet' });
        return;
      }
      req.log.error({ err: error }, 'Error setting ACL on object');
      res.status(500).json({ error: 'Failed to set object visibility' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * Access is controlled by per-object ACL (set via confirm-public endpoint).
 * Objects with visibility "public" are served without authentication.
 * Objects with no ACL or visibility "private" are denied (403).
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    // Check object ACL — only publicly-visible objects are served here.
    // Objects without an ACL or with visibility "private" are rejected.
    const canAccess = await objectStorageService.canAccessObjectEntity({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });
    if (!canAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      );
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
