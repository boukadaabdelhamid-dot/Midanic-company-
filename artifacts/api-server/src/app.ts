import express, {
  type ErrorRequestHandler,
  type Express,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedDatabase } from "./lib/seed";

const app: Express = express();

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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// In production the API serves the pre-built React frontend so both live on
// the same origin — no CORS issues and no separate static host needed.
if (process.env.NODE_ENV === "production") {
  const staticDir = path.join(process.cwd(), "public");
  if (existsSync(staticDir)) {
    app.use(express.static(staticDir));
    // SPA fallback: any non-API path that has no matching static file gets
    // index.html so client-side routing (wouter) can take over. Express 5
    // rejects the old `*` route pattern, so use middleware instead.
    app.use((req, res, next) => {
      if (req.path === "/api" || req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
    logger.info({ staticDir }, "Serving frontend static files");
  } else {
    logger.warn(
      { staticDir },
      "Static directory not found — frontend will not be served",
    );
  }
}

// Keep API failures machine-readable. Express's default error handler returns
// an HTML page, which makes the admin client report a misleading JSON parse
// error instead of the actual server failure.
const apiErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  req.log.error({ err }, "Unhandled API request error");
  const isApiRequest =
    req.originalUrl === "/api" || req.originalUrl.startsWith("/api/");
  if (isApiRequest) {
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  next(err);
};

app.use(apiErrorHandler);

export default app;
