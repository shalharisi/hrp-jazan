import { Router, type IRouter } from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// When built with esbuild, import.meta.url resolves to the bundle file
// (dist/index.mjs), so __dirname = artifacts/api-server/dist/.
// Three levels up from dist/ reaches workspace root reliably regardless of cwd.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../");

const DOCX_PATH = path.join(WORKSPACE_ROOT, "دليل_المستخدم_منظومة_جازان.docx");
const PDF_PATH = path.join(WORKSPACE_ROOT, "دليل_المستخدم_منظومة_جازان.pdf");

const router: IRouter = Router();

// GET /api/downloads/user-guide.docx — all authenticated users
// Auth is enforced globally in routes/index.ts; no per-route middleware needed.
router.get("/downloads/user-guide.docx", (req, res): void => {
  if (!fs.existsSync(DOCX_PATH)) {
    res.status(404).json({ error: "ملف Word غير متاح بعد. يرجى تشغيل سكريبت إنشاء الدليل أولاً.", code: "FILE_NOT_FOUND" });
    return;
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", 'attachment; filename*=UTF-8\'\'%D8%AF%D9%84%D9%8A%D9%84_%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D8%AE%D8%AF%D9%85_%D9%85%D9%86%D8%B8%D9%88%D9%85%D8%A9_%D8%AC%D8%A7%D8%B2%D8%A7%D9%86.docx; filename="user-guide.docx"');
  const stream = fs.createReadStream(DOCX_PATH);
  stream.pipe(res);
});

// GET /api/downloads/user-guide.pdf — all authenticated users
router.get("/downloads/user-guide.pdf", (req, res): void => {
  if (!fs.existsSync(PDF_PATH)) {
    res.status(404).json({ error: "ملف PDF غير متاح بعد. يرجى تشغيل سكريبت إنشاء الدليل أولاً.", code: "FILE_NOT_FOUND" });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename*=UTF-8\'\'%D8%AF%D9%84%D9%8A%D9%84_%D8%A7%D9%84%D9%85%D8%B3%D8%AA%D8%AE%D8%AF%D9%85_%D9%85%D9%86%D8%B8%D9%88%D9%85%D8%A9_%D8%AC%D8%A7%D8%B2%D8%A7%D9%86.pdf; filename="user-guide.pdf"');
  const stream = fs.createReadStream(PDF_PATH);
  stream.pipe(res);
});

// GET /api/downloads/user-guide/status — check which files are available
router.get("/downloads/user-guide/status", (req, res): void => {
  res.json({
    docx: fs.existsSync(DOCX_PATH),
    pdf: fs.existsSync(PDF_PATH),
  });
});

export default router;
