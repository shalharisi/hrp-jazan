import { Router, type IRouter } from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_FILENAME_AR = "دليل_المستخدم_منظومة_جازان.docx";

// Resolve the guide file using an explicit env override, then two fallback strategies:
// 1. process.cwd()-relative: pnpm runs artifact scripts from their own dir
//    (artifacts/api-server), so ../../ reaches the workspace root.
// 2. __dirname-relative: at runtime the bundle is at dist/index.mjs,
//    so ../../../ from there also reaches the workspace root.
function resolveGuidePath(): string {
  if (process.env["GUIDE_DOCX_PATH"]) return process.env["GUIDE_DOCX_PATH"];
  const cwdCandidate = path.resolve(process.cwd(), `../../${GUIDE_FILENAME_AR}`);
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;
  return path.resolve(__dirname, `../../../${GUIDE_FILENAME_AR}`);
}

const GUIDE_PATH = resolveGuidePath();
const GUIDE_FILENAME = "دليل_المستخدم_منظومة_جازان.docx";

const router: IRouter = Router();

// GET /api/guide/download — any authenticated user
router.get("/guide/download", (req, res): void => {
  if (!fs.existsSync(GUIDE_PATH)) {
    res.status(404).json({ error: "ملف الدليل غير متوفر حاليًا. يرجى التواصل مع مسؤول المنظومة." });
    return;
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(GUIDE_FILENAME)}`);

  const stream = fs.createReadStream(GUIDE_PATH);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: "حدث خطأ أثناء تحميل الملف." });
    }
  });
  stream.pipe(res);
});

export default router;
