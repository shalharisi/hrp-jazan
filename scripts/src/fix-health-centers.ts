/**
 * Add missing health centers to the DB and update patients
 * that were assigned to the wrong (fallback) health center.
 *
 * Run: pnpm --filter @workspace/scripts run fix-health-centers
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx") as typeof import("xlsx");

import { db, healthCentersTable, sectorsTable, patientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.resolve(
  __dirname,
  "../../attached_assets/HRPJazan2026_(2)_1778936984329.xlsx",
);

// ---------------------------------------------------------------------------
// Normalize sector name to canonical Arabic (same as import-excel.ts)
// ---------------------------------------------------------------------------
function normalizeSector(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("مركزي") || s.includes("central")) return "القطاع المركزي";
  if (s.includes("غربي") || s.includes("western")) return "القطاع الغربي";
  if (s.includes("شمالي") || s.includes("northern")) return "القطاع الشمالي";
  if (s.includes("جنوبي") || s.includes("southern")) return "القطاع الجنوبي";
  if (s.includes("جبلي") || s.includes("jabaly")) return "القطاع الجبلي";
  if (s.includes("اوسط") || s.includes("أوسط") || s.includes("middle")) return "القطاع الأوسط";
  if (s.includes("بني مالك") || s.includes("bani malik") || s.includes("bany malik"))
    return "قطاع بني مالك";
  if (s.includes("فرسان") || s.includes("farasan")) return "قطاع فرسان";
  return raw.trim();
}

// Strip English parenthetical from HC names like "مركز مزهرة (Mazharah Center)"
function stripEnglish(name: string): string {
  return name.replace(/\s*\(.*?\)\s*/g, "").trim();
}

// Normalize HC name for matching
function normalizeHCName(name: string): string {
  return name
    .replace(/^مركز\s+/u, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  console.log("📂 Reading Excel file...");
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets["البيانات"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
  const dataRows = rows.slice(1);

  // Load DB reference data
  const dbSectors = await db.select().from(sectorsTable).orderBy(sectorsTable.id);
  const dbHCs = await db.select().from(healthCentersTable).orderBy(healthCentersTable.id);

  // Build sector lookup
  const sectorByNorm = new Map(dbSectors.map((s) => [normalizeSector(s.nameAr), s]));

  // Build HC lookup by normalized name
  const hcByNorm = new Map(dbHCs.map((h) => [normalizeHCName(h.nameAr), h]));
  const hcByFull = new Map(dbHCs.map((h) => [h.nameAr, h]));

  // Step 1: Collect unique (hcName, sectorName) pairs from Excel for unmatched HCs
  const toAdd = new Map<string, { sectorName: string; sectorId: number }>();

  for (const row of dataRows) {
    const rawHC = String(row[14] ?? "").trim();
    if (!rawHC || rawHC === "أخرى") continue;

    const hcName = stripEnglish(rawHC);
    if (!hcName) continue;

    // Check if already in DB
    if (hcByFull.has(hcName) || hcByNorm.has(normalizeHCName(hcName))) continue;

    // Not in DB — collect with sector
    if (toAdd.has(hcName)) continue;

    const rawSector = String(row[5] ?? "").trim();
    const normSector = normalizeSector(rawSector);
    const sector = sectorByNorm.get(normSector);
    if (!sector) {
      console.warn(`  ⚠️  No sector match for "${rawSector}" (HC: "${hcName}")`);
      continue;
    }
    toAdd.set(hcName, { sectorName: sector.nameAr, sectorId: sector.id });
  }

  console.log(`\n📋 Health centers to add: ${toAdd.size}`);
  [...toAdd.entries()].forEach(([hc, { sectorName }]) =>
    console.log(`  + "${hc}" → ${sectorName}`),
  );

  // Step 2: Insert missing health centers
  const newHCIds = new Map<string, number>(); // hcName → new id

  for (const [hcName, { sectorId }] of toAdd.entries()) {
    const [inserted] = await db
      .insert(healthCentersTable)
      .values({ nameAr: hcName, sectorId })
      .onConflictDoNothing()
      .returning({ id: healthCentersTable.id, nameAr: healthCentersTable.nameAr });

    if (inserted) {
      newHCIds.set(hcName, inserted.id);
      console.log(`  ✓  Inserted "${hcName}" (id=${inserted.id})`);
    } else {
      // May already exist now (race or conflict)
      const [existing] = await db
        .select({ id: healthCentersTable.id })
        .from(healthCentersTable)
        .where(eq(healthCentersTable.nameAr, hcName))
        .limit(1);
      if (existing) {
        newHCIds.set(hcName, existing.id);
        console.log(`  ⟳  "${hcName}" already in DB (id=${existing.id})`);
      }
    }
  }

  // Rebuild HC lookup with new entries
  const freshHCs = await db.select().from(healthCentersTable);
  const freshHCByNorm = new Map(freshHCs.map((h) => [normalizeHCName(h.nameAr), h]));
  const freshHCByFull = new Map(freshHCs.map((h) => [h.nameAr, h]));

  // Step 3: Re-read Excel and fix patients whose HC was assigned wrong (via fallback)
  let updated = 0;
  let alreadyCorrect = 0;
  let noPatient = 0;

  for (const row of dataRows) {
    const rawNID = String(row[21] ?? "")
      .trim()
      .replace(/\D/g, "");
    if (!rawNID || rawNID.length < 8) continue;
    const nationalId = rawNID.padStart(10, "0");

    const rawHC = String(row[14] ?? "").trim();
    if (!rawHC || rawHC === "أخرى") continue;
    const hcName = stripEnglish(rawHC);
    if (!hcName) continue;

    // Find correct HC in DB
    const correctHC = freshHCByFull.get(hcName) || freshHCByNorm.get(normalizeHCName(hcName));
    if (!correctHC) continue;

    // Find patient
    const [patient] = await db
      .select({ id: patientsTable.id, healthCenterId: patientsTable.healthCenterId })
      .from(patientsTable)
      .where(eq(patientsTable.nationalId, nationalId))
      .limit(1);

    if (!patient) {
      noPatient++;
      continue;
    }

    if (patient.healthCenterId === correctHC.id) {
      alreadyCorrect++;
      continue;
    }

    // Update to correct HC
    await db
      .update(patientsTable)
      .set({ healthCenterId: correctHC.id })
      .where(eq(patientsTable.id, patient.id));
    updated++;
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Fix complete!");
  console.log(`   Health centers added:       ${newHCIds.size}`);
  console.log(`   Patients corrected:          ${updated}`);
  console.log(`   Patients already correct:    ${alreadyCorrect}`);
  console.log(`   Patients not found in DB:    ${noPatient}`);
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("❌ Fatal:", e);
    process.exit(1);
  });
