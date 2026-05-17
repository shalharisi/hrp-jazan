import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { buildDocument, OUTPUT_PATH } from "./generate-user-guide.js";
import type { CaptureEntry } from "./generate-user-guide.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, "../screenshots");
const INDEX_JSON = path.join(SCREENSHOTS_DIR, "index.json");
const DEBOUNCE_MS = 500;

function ts(): string {
  return new Date().toLocaleTimeString("ar-SA", { hour12: false });
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

async function rebuild(changed: string[]): Promise<void> {
  const changedList = changed.length > 0 ? ` — Changed: ${changed.join(", ")}` : "";
  console.log(`\n${ts()} 🔄 تغيير مكتشف في لقطات الشاشة${changedList} — إعادة بناء المستند...`);
  try {
    const { screenshots, captureOrder } = loadScreenshots();
    const buffer = await buildDocument(
      screenshots.size > 0 ? screenshots : undefined,
      captureOrder.length > 0 ? captureOrder : undefined,
    );
    fs.writeFileSync(OUTPUT_PATH, buffer);
    const sizeKB = Math.round(buffer.length / 1024);
    console.log(`${ts()} ✅ تم تحديث ملف Word (${sizeKB} KB): ${path.basename(OUTPUT_PATH)}`);
  } catch (err) {
    console.error(`${ts()} ❌ فشل إعادة البناء:`, err);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const pendingChanges = new Set<string>();

function scheduleRebuild(filename: string): void {
  pendingChanges.add(filename);
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const changed = [...pendingChanges].sort();
    pendingChanges.clear();
    rebuild(changed).catch(console.error);
  }, DEBOUNCE_MS);
}

function startWatcher(): void {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    console.log(`📁 تم إنشاء مجلد لقطات الشاشة: ${SCREENSHOTS_DIR}`);
  }

  console.log(`👁  مراقبة التغييرات في: ${SCREENSHOTS_DIR}`);
  console.log(`    (أي تغيير في ملفات PNG سيُعيد بناء المستند بعد ${DEBOUNCE_MS}ms)\n`);

  fs.watch(SCREENSHOTS_DIR, { persistent: true }, (eventType, filename) => {
    if (filename && filename.endsWith(".png")) {
      scheduleRebuild(filename);
    }
  });
}

startWatcher();
