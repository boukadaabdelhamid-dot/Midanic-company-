import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { Readable } from "stream";
import multer from "multer";
import { sql } from "drizzle-orm";
import { db, runWithTenantDatabase, schema } from "../lib/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { authenticate, configuredTenantLimit, type AuthRequest } from "../lib/auth";
import { storageLimitReached } from "../lib/entitlement-limits";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are accepted"));
  },
});

/**
 * Multer completes multipart parsing from stream callbacks that can outlive
 * the async context created by authenticate. Re-enter the authenticated
 * tenant database before handing control to the upload handler.
 */
function tenantAwareUpload(req: AuthRequest, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (error: unknown) => {
    const continueRequest = () => next(error);
    const context = req.tenantDatabaseContext;
    if (context) {
      void runWithTenantDatabase(context, continueRequest);
      return;
    }
    next(error);
  });
}

/**
 * GET /uploads/:id
 * Serve a previously uploaded image by its UUID — no auth required.
 * This is the public CDN-style endpoint for product images uploaded via POST /uploads.
 */
router.get("/uploads/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const objectPath = `/objects/uploads/${id}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving uploaded image");
    res.status(500).json({ error: "Failed to serve image" });
  }
});

/**
 * POST /uploads
 * Accepts a multipart/form-data request with a single "file" field.
 * Uploads it to object storage, persists metadata, and returns a public URL.
 */
router.post(
  "/uploads",
  authenticate,
  tenantAwareUpload,
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided. Send a multipart/form-data request with a 'file' field." });
      return;
    }
    const file = req.file;
    try {
      const storageGb = configuredTenantLimit(req, "storageGb");
      const result = await db.transaction(async (tx) => {
        if (storageGb !== null) {
          // Serialize the usage check with the metadata insert so concurrent
          // uploads cannot each consume the same remaining capacity.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(2147483647, 73902)`);
          const usage = await tx.execute<{ total: string | number }>(sql`
            SELECT COALESCE(SUM(size), 0)::bigint AS total
            FROM uploaded_images
          `);
          const currentBytes = BigInt(String(usage.rows[0]?.total ?? "0"));
          const requestedBytes = BigInt(file.size);
          if (storageLimitReached(currentBytes, requestedBytes, storageGb)) {
            throw Object.assign(
              new Error(`This company has reached its storage limit (${storageGb} GB)`),
              {
                statusCode: 409,
                code: "STORAGE_LIMIT_REACHED",
                storageGb,
                usedBytes: currentBytes.toString(),
                requestedBytes: file.size,
              },
            );
          }
        }

        const { objectPath, publicUrl } = await objectStorageService.uploadBuffer(
          file.buffer,
          file.mimetype,
        );

        const [record] = await tx
          .insert(schema.uploadedImagesTable)
          .values({
            objectPath,
            publicUrl,
            contentType: file.mimetype,
            size: file.size,
            uploadedBy: req.user?.id ?? null,
          })
          .returning();
        return { id: record.id, url: publicUrl, objectPath, contentType: record.contentType, size: record.size };
      });

      res.status(201).json(result);
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 409) {
        res.status(409).json({
          error: (err as Error).message,
          code: (err as { code?: string }).code,
          storageGb: (err as { storageGb?: number }).storageGb,
          usedBytes: (err as { usedBytes?: string }).usedBytes,
          requestedBytes: (err as { requestedBytes?: number }).requestedBytes,
        });
        return;
      }
      req.log.error({ err }, "Upload failed");
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const response = await objectStorageService.downloadObject(file);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 * Serve private objects from PRIVATE_OBJECT_DIR — requires authentication.
 */
router.get("/storage/objects/*path", authenticate, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
