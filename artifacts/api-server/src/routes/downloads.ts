import { Router, type IRouter } from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { requireRole } from "../lib/auth.js";

// When built with esbuild, import.meta.url resolves to the bundle file
// (dist/index.mjs), so __dirname = artifacts/api-server/dist/.
// Three levels up from dist/ reaches workspace root reliably regardless of cwd.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../");

const DOCX_PATH = path.join(WORKSPACE_ROOT, "دليل_المستخدم_منظومة_جازان.docx");
const PDF_PATH = path.join(WORKSPACE_ROOT, "دليل_المستخدم_منظومة_جازان.pdf");

const router: IRouter = Router();

// In-process lock: prevents concurrent guide generation runs.
let guideGenerating = false;

// GET /api/downloads/user-guide.docx — all authenticated users
// Auth is enforced globally in routes/index.ts; no per-route middleware needed.
router.get("/downloads/user-guide.docx", (req, res): void => {
  if (!fs.existsSync(DOCX_PATH)) {
    res.status(404).json({
      error: "ملف Word غير متاح بعد. يرجى تشغيل سكريبت إنشاء الدليل أولاً.",
      code: "FILE_NOT_FOUND",
    });
    return;
  }
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename*=UTF-8''%D8%AF%D9%84%D9%8A%D9%84_%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D8%AE%D8%AF%D9%85_%D9%85%D9%86%D8%B8%D9%88%D9%85%D8%A9_%D8%AC%D8%A7%D8%B2%D8%A7%D9%86.docx; filename=\"user-guide.docx\"",
  );
  const stream = fs.createReadStream(DOCX_PATH);
  stream.pipe(res);
});

// GET /api/downloads/user-guide.pdf — all authenticated users
router.get("/downloads/user-guide.pdf", (req, res): void => {
  if (!fs.existsSync(PDF_PATH)) {
    res.status(404).json({
      error: "ملف PDF غير متاح بعد. يرجى تشغيل سكريبت إنشاء الدليل أولاً.",
      code: "FILE_NOT_FOUND",
    });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename*=UTF-8''%D8%AF%D9%84%D9%8A%D9%84_%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D8%AE%D8%AF%D9%85_%D9%85%D9%86%D8%B8%D9%88%D9%85%D8%A9_%D8%AC%D8%A7%D8%B2%D8%A7%D9%86.pdf; filename=\"user-guide.pdf\"",
  );
  const stream = fs.createReadStream(PDF_PATH);
  stream.pipe(res);
});

// GET /api/downloads/user-guide/status — check which files are available
router.get("/downloads/user-guide/status", (req, res): void => {
  const docxExists = fs.existsSync(DOCX_PATH);
  const pdfExists = fs.existsSync(PDF_PATH);
  res.json({
    docx: docxExists,
    pdf: pdfExists,
    docxMtime: docxExists ? fs.statSync(DOCX_PATH).mtime.toISOString() : null,
    pdfMtime: pdfExists ? fs.statSync(PDF_PATH).mtime.toISOString() : null,
  });
});

// POST /api/downloads/user-guide/generate — admin only; triggers guide generation on demand.
// Streams Server-Sent Events so the client can display named progress steps.
// Each event is a JSON object:
//   { step: string }   — a named progress step emitted by the script
//   { done: true }     — generation completed successfully
//   { error: true }    — generation failed
router.post("/downloads/user-guide/generate", requireRole("admin"), (req, res): void => {
  if (guideGenerating) {
    res.status(409).json({ error: "Guide generation is already in progress. Please wait and try again." });
    return;
  }

  guideGenerating = true;

  // Set SSE headers so the client can read events as they arrive.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: object): void => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const child = spawn("pnpm", ["--filter", "@workspace/scripts", "run", "generate-guide"], {
    cwd: WORKSPACE_ROOT,
    stdio: "pipe",
  });

  // Buffer stdout and emit SSE for every PROGRESS: line the script writes.
  let stdoutBuf = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split("\n");
    stdoutBuf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("PROGRESS:")) {
        const step = trimmed.slice("PROGRESS:".length);
        sendEvent({ step });
      }
    }
  });

  child.on("close", (code) => {
    guideGenerating = false;
    if (code === 0) {
      req.log.info("User guide generated successfully via admin trigger");
      sendEvent({ done: true });
    } else {
      req.log.error({ code }, "Guide generation script exited with non-zero code");
      sendEvent({ error: true, code });
    }
    res.end();
  });

  child.on("error", (err) => {
    guideGenerating = false;
    req.log.error({ err }, "Failed to spawn guide generation script");
    sendEvent({ error: true, detail: err.message });
    res.end();
  });
});

export default router;
