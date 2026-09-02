import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
app.set("trust proxy", process.env["TRUST_PROXY"] === "1" ? 1 : false);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Matches both *.replit.dev (dev previews) and *.replit.app (production deploys).
// Only used in development — in production every origin must be in ALLOWED_ORIGINS.
const REPLIT_DOMAIN_RE = /^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.replit\.(dev|app)(:\d+)?$/i;
const isDev = process.env["NODE_ENV"] !== "production";
const tenantRootDomain = (process.env["ERP_TENANT_ROOT_DOMAIN"] ?? "midanic.com")
  .trim()
  .toLowerCase()
  .replace(/\.$/, "");

function isTenantOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" &&
      url.port === "" &&
      url.hostname.toLowerCase().endsWith(`.${tenantRootDomain}`);
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 && isDev) return cb(null, true);
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      if (isTenantOrigin(origin)) {
        return cb(null, true);
      }
      if (isDev && REPLIT_DOMAIN_RE.test(origin)) {
        return cb(null, true);
      }
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Store-Slug", "X-Tenant-Hostname"],
    exposedHeaders: ["Content-Type"],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const erpDist = path.resolve(__dirname, "../../erp/dist/public");
  app.use("/erp", express.static(erpDist));
  app.use("/erp", (req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(erpDist, "index.html"));
  });

  // Company wildcard domains point to this service, so the ERP web app and API
  // share the same trusted Host boundary in production.
  app.use(express.static(erpDist));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(erpDist, "index.html"));
  });
}

export default app;
