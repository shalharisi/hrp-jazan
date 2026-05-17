import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { buildDocument, OUTPUT_PATH } from "./generate-user-guide.js";
import type { CaptureEntry } from "./generate-user-guide.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, "../screenshots");
const INDEX_JSON = path.join(SCREENSHOTS_DIR, "index.json");
const GUIDE_SOURCE = path.resolve(__dirname, "./generate-user-guide.ts");
const DEBOUNCE_MS = 500;

/**
 * Static asset files consumed by generate-user-guide.ts.
 * Add new entries here as the guide toolchain grows — each will be watched
 * via its parent directory so file replacements and create-after-start are
 * captured without restarting the watcher.
 */
const STATIC_ASSET_FILES: string[] = [
  path.resolve(__dirname, "../../artifacts/hrp-tracker/src/assets/logo.jpg"),
];

const OPEN_FLAG = process.argv.includes("--open");

function ts(): string {
  return new Date().toLocaleTimeString("ar-SA", { hour12: false });
}

function openDocument(filePath: string): void {
  const platform = process.platform;
  let cmd: string;
  let args: string[];

  if (platform === "darwin") {
    cmd = "open";
    args = [filePath];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", "", filePath];
  } else {
    cmd = "xdg-open";
    args = [filePath];
  }

  const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
  child.on("error", (err) => {
    console.warn(`${ts()} ⚠  تعذّر فتح الملف تلقائياً (${cmd}): ${err.message}`);
  });
  child.unref();
  console.log(`${ts()} 📂 تم فتح الملف في المشاهد الافتراضي: ${path.basename(filePath)}`);
}

function loadScreenshots(): { screenshots: Map<string, Buffer>; captureOrder: CaptureEntry[] } {
  const screenshots = new Map<string, Buffer>();
  let captureOrder: CaptureEntry[] = [];

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    return { screenshots, captureOrder };
  }

  if (!fs.existsSync(INDEX_JSON)) {
    console.warn(
      `⚠  لا يوجد ملف index.json في ${SCREENSHOTS_DIR} — سيُنشأ المستند بدون صور.\n` +
        `   شغّل أولاً: pnpm --filter @workspace/scripts run capture-screenshots`,
    );
    return { screenshots, captureOrder };
  }

  try {
    captureOrder = JSON.parse(fs.readFileSync(INDEX_JSON, "utf8")) as CaptureEntry[];
  } catch (err) {
    console.warn("⚠  تعذّر قراءة index.json:", err);
    return { screenshots, captureOrder };
  }

  for (const entry of captureOrder) {
    const filePath = path.join(SCREENSHOTS_DIR, entry.filename);
    if (fs.existsSync(filePath)) {
      screenshots.set(entry.key, fs.readFileSync(filePath));
    } else {
      console.warn(`⚠  ملف الصورة غير موجود: ${entry.filename}`);
    }
  }

  return { screenshots, captureOrder };
}

type ChangeKind = "added" | "removed" | "updated";

function buildDiffSummary(changes: Map<string, ChangeKind>): string {
  const added = [...changes.values()].filter((k) => k === "added").length;
  const removed = [...changes.values()].filter((k) => k === "removed").length;
  const updated = [...changes.values()].filter((k) => k === "updated").length;

  const parts: string[] = [];
  if (updated > 0) parts.push(`${updated} updated`);
  if (added > 0) parts.push(`${added} added`);
  if (removed > 0) parts.push(`${removed} removed`);

  const summary = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  const filenames = [...changes.keys()].sort().join(", ");
  return filenames.length > 0 ? `${summary} — ${filenames}` : "";
}

async function rebuild(changes: Map<string, ChangeKind>): Promise<void> {
  const diffInfo = buildDiffSummary(changes);
  console.log(`\n${ts()} 🔄 تغيير مكتشف${diffInfo} — إعادة بناء المستند...`);
  try {
    const { screenshots, captureOrder } = loadScreenshots();
    const buffer = await buildDocument(
      screenshots.size > 0 ? screenshots : undefined,
      captureOrder.length > 0 ? captureOrder : undefined,
    );
    fs.writeFileSync(OUTPUT_PATH, buffer);
    const sizeKB = Math.round(buffer.length / 1024);
    console.log(`${ts()} ✅ تم تحديث ملف Word (${sizeKB} KB): ${path.basename(OUTPUT_PATH)}`);

    if (OPEN_FLAG) {
      openDocument(OUTPUT_PATH);
    }
  } catch (err) {
    console.error(`${ts()} ❌ فشل إعادة البناء:`, err);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingChanges = new Map<string, ChangeKind>();

function scheduleRebuild(filename: string, eventType: string): void {
  let kind: ChangeKind;
  if (eventType === "rename") {
    kind = fs.existsSync(path.join(SCREENSHOTS_DIR, filename)) ? "added" : "removed";
  } else {
    kind = "updated";
  }
  const existing = pendingChanges.get(filename);
  if (existing === undefined) {
    pendingChanges.set(filename, kind);
  } else if (existing === "added" && kind === "removed") {
    pendingChanges.delete(filename);
  } else if (existing === "removed" && kind === "added") {
    pendingChanges.set(filename, "updated");
  } else if (kind === "removed") {
    pendingChanges.set(filename, "removed");
  }
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const changes = new Map(pendingChanges);
    pendingChanges.clear();
    rebuild(changes).catch(console.error);
  }, DEBOUNCE_MS);
}

function startWatcher(): void {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    console.log(`📁 تم إنشاء مجلد لقطات الشاشة: ${SCREENSHOTS_DIR}`);
  }

  console.log(`👁  المسارات التي تتم مراقبتها:`);
  console.log(`    • ${SCREENSHOTS_DIR}  (ملفات PNG)`);
  console.log(`    • ${INDEX_JSON}`);
  console.log(`    • ${GUIDE_SOURCE}`);
  for (const assetPath of STATIC_ASSET_FILES) {
    console.log(`    • ${assetPath}`);
  }
  console.log(`    (أي تغيير سيُعيد بناء المستند بعد ${DEBOUNCE_MS}ms)`);
  if (OPEN_FLAG) {
    console.log(`    (--open مُفعَّل: سيُفتح الملف تلقائياً بعد كل إعادة بناء ناجحة)`);
  }
  console.log();

  fs.watch(SCREENSHOTS_DIR, { persistent: true }, (eventType, filename) => {
    if (filename && filename.endsWith(".png")) {
      scheduleRebuild(filename, eventType);
    }
  });

  if (fs.existsSync(INDEX_JSON)) {
    fs.watch(INDEX_JSON, { persistent: true }, (_eventType, filename) => {
      scheduleRebuild(filename ?? path.basename(INDEX_JSON), "change");
    });
  } else {
    console.warn(`⚠  لم يُعثر على ${INDEX_JSON} — لن تتم مراقبته حتى تتم إعادة تشغيل المراقب`);
  }

  // Watch the guide source via its parent directory so that file replacements
  // (e.g. cp new-guide.ts generate-user-guide.ts) are reliably captured on Linux,
  // where fs.watch on an individual file stops firing after the inode is swapped.
  const guideSourceDir = path.dirname(GUIDE_SOURCE);
  const guideSourceName = path.basename(GUIDE_SOURCE);
  fs.watch(guideSourceDir, { persistent: true }, (_eventType, filename) => {
    if (filename === guideSourceName) {
      scheduleRebuild(guideSourceName, "change");
    }
  });

  // Watch each static asset file via its parent directory so that file
  // replacements (cp newlogo.jpg logo.jpg) and create-after-start events
  // are captured reliably without restarting the watcher process.
  for (const assetPath of STATIC_ASSET_FILES) {
    const assetDir = path.dirname(assetPath);
    const assetName = path.basename(assetPath);
    fs.watch(assetDir, { persistent: true }, (_eventType, filename) => {
      if (filename === assetName) {
        scheduleRebuild(assetName, "change");
      }
    });
  }
}

startWatcher();
