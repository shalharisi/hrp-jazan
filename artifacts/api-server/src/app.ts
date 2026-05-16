import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// ---------------------------------------------------------------------------
// CORS — only allow explicit trusted origins with credentials
// ---------------------------------------------------------------------------
const REPLIT_DOMAINS_ENV = process.env["REPLIT_DOMAINS"] ?? "";
const trustedOrigins = REPLIT_DOMAINS_ENV
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .flatMap((d) => [`https://${d}`, `http://${d}`]);

app.use(
  cors({
    origin: (origin, callback) => {
      // server-to-server (no Origin header) — allow
      if (!origin) return callback(null, true);
      // localhost in development
      if (
        process.env["NODE_ENV"] !== "production" &&
        (origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1") ||
          origin.includes(".replit.dev") ||
          origin.includes(".repl.co"))
      ) {
        return callback(null, true);
      }
      // Replit production domains
      if (trustedOrigins.some((trusted) => origin === trusted)) {
        return callback(null, true);
      }
      // Reject silently — do not echo arbitrary origins
      return callback(null, false);
    },
    credentials: true,
  }),
);

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

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
