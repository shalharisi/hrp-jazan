/**
 * Delete test/demo patients (and their pregnancies + appointments)
 * that were manually entered before the Excel import.
 *
 * Safe: only deletes patients whose national IDs do NOT appear in the Excel file.
 *
 * Run: pnpm --filter @workspace/scripts run delete-test-data
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx") as typeof import("xlsx");

import {
  db,
  patientsTable,
  pregnanciesTable,
  appointmentsTable,
} from "@workspace/db";
import { eq, inArray, notInArray } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.resolve(
  __dirname,
  "../../attached_assets/HRPJazan2026_(2)_1778936984329.xlsx"
);

async function main() {
  // ── 1. Collect all valid national IDs from the Excel file ──────────────
  console.log("📂 Reading Excel file...");
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets["البيانات"];
  const rows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  }) as string[][];

  const excelIds = new Set<string>();
  for (const row of rows.slice(1)) {
    const rawNID = String(row[21] ?? "")
      .trim()
      .replace(/\D/g, "");
    if (rawNID && rawNID.length >= 8) {
      excelIds.add(rawNID.padStart(10, "0"));
    }
  }
  console.log(`  Excel valid national IDs: ${excelIds.size}`);

  // ── 2. Find test patients (not in Excel) ──────────────────────────────
  const allPatients = await db
    .select({ id: patientsTable.id, nationalId: patientsTable.nationalId, nameAr: patientsTable.nameAr })
    .from(patientsTable);

  const testPatients = allPatients.filter(p => !excelIds.has(p.nationalId));

  if (testPatients.length === 0) {
    console.log("\n✅ No test patients found – database is already clean.");
    return;
  }

  console.log(`\n⚠️  Found ${testPatients.length} test patient(s) to delete:`);
  testPatients.forEach(p =>
    console.log(`  - [${p.nationalId}] ${p.nameAr || "(no name)"}`)
  );

  const testPatientIds = testPatients.map(p => p.id);

  // ── 3. Find their pregnancies ──────────────────────────────────────────
  const testPregnancies = await db
    .select({ id: pregnanciesTable.id })
    .from(pregnanciesTable)
    .where(inArray(pregnanciesTable.patientId, testPatientIds));

  const testPregnancyIds = testPregnancies.map(p => p.id);
  console.log(`  Pregnancies to delete: ${testPregnancyIds.length}`);

  // ── 4. Find their appointments ─────────────────────────────────────────
  let deletedAppts = 0;
  if (testPregnancyIds.length > 0) {
    const apptResult = await db
      .delete(appointmentsTable)
      .where(inArray(appointmentsTable.pregnancyId, testPregnancyIds))
      .returning({ id: appointmentsTable.id });
    deletedAppts = apptResult.length;
  }

  // ── 5. Delete pregnancies ──────────────────────────────────────────────
  let deletedPregnancies = 0;
  if (testPatientIds.length > 0) {
    const pregResult = await db
      .delete(pregnanciesTable)
      .where(inArray(pregnanciesTable.patientId, testPatientIds))
      .returning({ id: pregnanciesTable.id });
    deletedPregnancies = pregResult.length;
  }

  // ── 6. Delete patients ─────────────────────────────────────────────────
  const patResult = await db
    .delete(patientsTable)
    .where(inArray(patientsTable.id, testPatientIds))
    .returning({ id: patientsTable.id });

  // ── 7. Summary ────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(50));
  console.log("✅ Cleanup complete!");
  console.log(`   Test patients deleted:      ${patResult.length}`);
  console.log(`   Test pregnancies deleted:   ${deletedPregnancies}`);
  console.log(`   Test appointments deleted:  ${deletedAppts}`);

  // Final counts
  const [{ count: remPatients }] = await db
    .select({ count: db.$count(patientsTable) })
    .from(patientsTable);
  const [{ count: remPregnancies }] = await db
    .select({ count: db.$count(pregnanciesTable) })
    .from(pregnanciesTable);

  console.log("\n📊 Remaining in database:");
  console.log(`   Patients:    ${remPatients}`);
  console.log(`   Pregnancies: ${remPregnancies}`);
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error("❌ Fatal error:", e);
    process.exit(1);
  });
