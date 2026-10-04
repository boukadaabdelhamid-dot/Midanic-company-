---
name: OpenAPI raw upload types
description: Orval's generated type for streamed application/octet-stream uploads in Node-only api-zod consumers
---

## Rule
For a raw `application/octet-stream` request streamed directly by the application, use an OpenAPI schema with `type: string` and a description, but omit `format: binary` when the generated `api-zod` package must compile without DOM types.

**Why:** Orval emits `Blob` for `format: binary`, which the Node-only shared typecheck cannot resolve.

**How to apply:** Keep the raw MIME type on the request content and stream bytes in the transport; only omit the format marker when generated `Blob` types are incompatible with the shared build.