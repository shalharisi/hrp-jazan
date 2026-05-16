/**
 * Import HRP patient data from Excel file into the database.
 * - Skips rows without a valid national ID (10 digits)
 * - Skips patients that already exist (by nationalId)
 * - Always inserts a new pregnancy record per row
 * - Inserts appointment if appointmentDate is present
 *
 * Run: pnpm --filter @workspace/scripts run import-excel
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx") as typeof import("xlsx");
import { db, patientsTable, pregnanciesTable, appointmentsTable, healthCentersTable, sectorsTable, hospitalsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.resolve(__dirname, "../../attached_assets/HRPJazan2026_(2)_1778936984329.xlsx");

// ---------------------------------------------------------------------------
// Excel serial date → ISO date string (YYYY-MM-DD)
// ---------------------------------------------------------------------------
function excelDateToISO(serial: number): string {
  // Excel's date epoch is Dec 30, 1899. Offset to Unix epoch = 25569 days.
  const ms = (serial - 25569) * 86400 * 1000;
  return new Date(ms).toISOString().split("T")[0]!;
}

// ---------------------------------------------------------------------------
// Parse gestational age string to week number (integer)
// e.g. "14wkd 5 d" → 14, "5wks 2 d" → 5, "18W5D" → 18, "29 wks" → 29
// ---------------------------------------------------------------------------
function parseGA(raw: string): number | null {
  if (!raw) return null;
  const s = String(raw).trim();
  // If pure number
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // Extract leading integer
  const m = s.match(/^(\d+)/);
  if (m) return parseInt(m[1]!, 10);
  return null;
}

// ---------------------------------------------------------------------------
// Normalize sector name to canonical Arabic
// ---------------------------------------------------------------------------
function normalizeSector(raw: string): string {
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (s.includes("مركزي") || s.includes("central")) return "القطاع المركزي";
  if (s.includes("غربي") || s.includes("western")) return "القطاع الغربي";
  if (s.includes("شمالي") || s.includes("northern")) return "القطاع الشمالي";
  if (s.includes("جنوبي") || s.includes("southern")) return "القطاع الجنوبي";
  if (s.includes("جبلي") || s.includes("jabaly") || s.includes("aljabaly")) return "القطاع الجبلي";
  if (s.includes("اوسط") || s.includes("أوسط") || s.includes("middle")) return "القطاع الأوسط";
  if (s.includes("بني مالك") || s.includes("bani malik") || s.includes("bany malik")) return "قطاع بني مالك";
  if (s.includes("فرسان") || s.includes("farasan")) return "قطاع فرسان";
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Normalize health center / hospital name for fuzzy matching
// ---------------------------------------------------------------------------
function normalizeHCName(name: string): string {
  return name
    .replace(/^مركز\s+/u, "")
    .replace(/^مستشفى?\s+/u, "")
    .replace(/\s+/g, "")
    .replace(/[ا-ي]/g, c => c.normalize("NFD"))
    .toLowerCase()
    .trim();
}

function fuzzyMatch(target: string, candidates: string[]): number {
  const t = normalizeHCName(target);
  for (let i = 0; i < candidates.length; i++) {
    if (normalizeHCName(candidates[i]!) === t) return i;
  }
  // Partial match: one contains the other
  for (let i = 0; i < candidates.length; i++) {
    const c = normalizeHCName(candidates[i]!);
    if (t.includes(c) || c.includes(t)) return i;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Parse semicolon-separated risk factor string
// ---------------------------------------------------------------------------
function parseList(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ---------------------------------------------------------------------------
// Map hospital unified name → hospital name_ar in DB
// ---------------------------------------------------------------------------
function normalizeHospital(raw: string): string {
  const s = raw.replace(/\s+/g, "");
  if (s.includes("صبيا")) return "مستشفى صبيا العام";
  if (s.includes("جازان") || s.includes("جزان")) return "مستشفى جازان العام";
  if (s.includes("بيش")) return "مستشفى بيش العام";
  if (s.includes("صامطة")) return "مستشفى صامطة العام";
  if (s.includes("أبوعريش") || s.includes("ابوعريش") || s.includes("أبوعريش") || s.includes("عريش")) return "مستشفى أبو عريش العام";
  if (s.includes("ملكفهد") || s.includes("فهدالمركزي") || s.includes("KFCH") || s.includes("kfch") || s.includes("المركزي")) return "مستشفى الملك فهد المركزي";
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Parse attended value
// ---------------------------------------------------------------------------
function parseAttended(raw: string): boolean | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s === "تم الحظور" || s === "تم الحضور" || s === "حضرت" || s === "تم الابلاغ") return true;
  if (s.startsWith("لم") || s.startsWith("لا") || s.startsWith("المريضه الغت") || s.includes("لاترغب") || s.includes("تراجع")) return false;
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("📂 Reading Excel file:", EXCEL_PATH);
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets["البيانات"];
  if (!ws) throw new Error("Sheet 'البيانات' not found");

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  const dataRows = rows.slice(1); // skip header
  console.log(`📋 Found ${dataRows.length} data rows`);

  // Load reference data from DB
  console.log("\n🔍 Loading reference data from DB...");
  const dbSectors = await db.select().from(sectorsTable).orderBy(sectorsTable.id);
  const dbHCs = await db.select().from(healthCentersTable).orderBy(healthCentersTable.id);
  const dbHospitals = await db.select().from(hospitalsTable).orderBy(hospitalsTable.id);
  const dbPatients = await db.select({ id: patientsTable.id, nationalId: patientsTable.nationalId }).from(patientsTable);

  console.log(`  Sectors: ${dbSectors.length}, Health Centers: ${dbHCs.length}, Hospitals: ${dbHospitals.length}, Existing patients: ${dbPatients.length}`);

  // Build lookup maps
  const sectorByNorm = new Map<string, typeof dbSectors[0]>();
  for (const s of dbSectors) sectorByNorm.set(normalizeSector(s.nameAr), s);

  const existingNIDs = new Set(dbPatients.map(p => p.nationalId));
  const patientIdByNID = new Map(dbPatients.map(p => [p.nationalId, p.id]));

  const hospitalByNorm = new Map<string, typeof dbHospitals[0]>();
  for (const h of dbHospitals) {
    hospitalByNorm.set(normalizeHospital(h.nameAr), h);
    hospitalByNorm.set(h.nameAr, h);
  }

  // Stats
  let skippedNoId = 0, skippedBadId = 0, insertedPatients = 0, skippedDupPatients = 0;
  let insertedPregnancies = 0, insertedAppointments = 0;
  let unmatchedHCs: string[] = [];
  let unmatchedSectors: string[] = [];

  // Column indices (0-based, header is row 0)
  const C = {
    sector: 5,
    hcName: 14,
    visitDate: 15,
    lmpDate: 16,
    ga: 17,
    nameAr: 20,
    nationalId: 21,
    address: 22,
    doctorPhone: 23,
    phone: 24,
    riskFactors: 25,
    pregnancyRiskFactors: 26,
    medicalConditions: 27,
    medications: 28,
    isVte: 29,
    enoxaparin: 30,
    refExplained: 31,
    doctorName: 32,
    notes: 33,
    apptDate: 34,
    attended: 35,
    referredHospitalCol: 44, // unified hospital name
    followUpNotes: 39,
    attendanceNote: 35,
  };

  for (const row of dataRows) {
    const r = row as string[];

    // Extract nationalId
    const rawNID = String(r[C.nationalId] ?? "").trim().replace(/\D/g, "");
    if (!rawNID) { skippedNoId++; continue; }
    if (rawNID.length < 8 || rawNID.length > 12) { skippedBadId++; continue; }
    const nationalId = rawNID.padStart(10, "0");

    // Match health center → sector
    const rawHCName = String(r[C.hcName] ?? "").trim();
    const rawSectorName = String(r[C.sector] ?? "").trim();

    let healthCenterId: number | null = null;
    if (rawHCName) {
      const hcNames = dbHCs.map(h => h.nameAr);
      const idx = fuzzyMatch(rawHCName, hcNames);
      if (idx >= 0) {
        healthCenterId = dbHCs[idx]!.id;
      } else {
        if (!unmatchedHCs.includes(rawHCName)) unmatchedHCs.push(rawHCName);
      }
    }

    // If HC not found by name, try matching via sector
    if (!healthCenterId && rawSectorName) {
      const normalizedSector = normalizeSector(rawSectorName);
      const sector = sectorByNorm.get(normalizedSector);
      if (sector) {
        // Pick first HC in this sector as fallback
        const hcInSector = dbHCs.find(h => h.sectorId === sector.id);
        if (hcInSector) healthCenterId = hcInSector.id;
      } else {
        if (!unmatchedSectors.includes(rawSectorName)) unmatchedSectors.push(rawSectorName);
      }
    }

    // If still no health center, skip this row
    if (!healthCenterId) {
      console.warn(`  ⚠️  Row NID=${nationalId}: no health center match for "${rawHCName}" / "${rawSectorName}" — skipping`);
      skippedNoId++;
      continue;
    }

    // Parse patient fields
    const nameAr = String(r[C.nameAr] ?? "").trim() || "غير معروف";
    const phone = String(r[C.phone] ?? "").trim().replace(/\D/g, "") || "0000000000";
    const doctorPhone = String(r[C.doctorPhone] ?? "").trim().replace(/\D/g, "") || null;
    const address = String(r[C.address] ?? "").trim() || null;

    // Parse dates
    const rawVisit = r[C.visitDate];
    const visitDate = typeof rawVisit === "number" ? excelDateToISO(rawVisit) : null;
    if (!visitDate) { skippedNoId++; continue; } // skip if no visit date

    const rawLmp = r[C.lmpDate];
    const lmpDate = typeof rawLmp === "number" ? excelDateToISO(rawLmp) : null;

    const ga = parseGA(String(r[C.ga] ?? ""));

    // Parse pregnancy fields
    const isVte = String(r[C.isVte] ?? "").trim().toLowerCase() === "yes";
    const enoxaparin = String(r[C.enoxaparin] ?? "").trim().toLowerCase() === "yes";
    const refExplainedRaw = String(r[C.refExplained] ?? "").trim().toLowerCase();
    const referralExplained = refExplainedRaw === "yes" ? true : refExplainedRaw === "no" ? false : null;
    const doctorName = String(r[C.doctorName] ?? "").trim() || null;
    const notes = String(r[C.notes] ?? "").trim() || null;
    const medications = String(r[C.medications] ?? "").trim() || null;
    const followUpNotes = String(r[C.followUpNotes] ?? "").trim() || null;

    const riskFactors = parseList(String(r[C.riskFactors] ?? ""));
    const pregnancyRiskFactors = parseList(String(r[C.pregnancyRiskFactors] ?? ""));
    const medicalConditions = parseList(String(r[C.medicalConditions] ?? ""));

    // Hospital
    const rawHospital = String(r[C.referredHospitalCol] ?? "").trim();
    let referredHospitalId: number | null = null;
    let referralRecommendation = "follow_at_center";
    if (rawHospital) {
      const normH = normalizeHospital(rawHospital);
      const hosp = hospitalByNorm.get(normH) || hospitalByNorm.get(rawHospital);
      if (hosp) {
        referredHospitalId = hosp.id;
        referralRecommendation = normH.includes("الملك فهد") || normH.includes("المركزي") || normH.includes("KFCH")
          ? "transfer_kfch"
          : "follow_at_hospital";
      }
    }

    // Appointment
    const rawAppt = r[C.apptDate];
    const appointmentDate = typeof rawAppt === "number" ? excelDateToISO(rawAppt) : null;
    const attendedRaw = String(r[C.attended] ?? "").trim();
    const attended = parseAttended(attendedRaw);
    const attendanceNote = attendedRaw && attended === null ? attendedRaw : (attended === false ? attendedRaw : null);

    // Risk level (default "high" since all are high-risk pregnancies; critical if VTE + major condition)
    const hasCriticalCondition = medicalConditions.some(c =>
      c.includes("قلب") || c.includes("كلى") || c.includes("سرطان")
    );
    const riskLevel = (isVte && hasCriticalCondition) ? "critical" : "high";

    // --- INSERT PATIENT (skip if exists) ---
    let patientId: number;
    if (existingNIDs.has(nationalId)) {
      patientId = patientIdByNID.get(nationalId)!;
      skippedDupPatients++;
    } else {
      try {
        const [inserted] = await db.insert(patientsTable).values({
          nationalId,
          nameAr,
          phone,
          doctorPhone,
          address,
          healthCenterId,
        }).returning({ id: patientsTable.id });
        patientId = inserted!.id;
        existingNIDs.add(nationalId);
        patientIdByNID.set(nationalId, patientId);
        insertedPatients++;
      } catch (e) {
        // Race condition or constraint — try to fetch
        const [existing] = await db.select({ id: patientsTable.id }).from(patientsTable).where(eq(patientsTable.nationalId, nationalId)).limit(1);
        if (existing) {
          patientId = existing.id;
          existingNIDs.add(nationalId);
          patientIdByNID.set(nationalId, patientId);
          skippedDupPatients++;
        } else {
          console.error(`  ❌ Failed to insert patient NID=${nationalId}:`, e);
          continue;
        }
      }
    }

    // --- INSERT PREGNANCY ---
    try {
      const [preg] = await db.insert(pregnanciesTable).values({
        patientId,
        visitDate,
        lmpDate,
        gestationalAge: ga,
        riskLevel,
        riskFactors,
        pregnancyRiskFactors,
        medicalConditions,
        medications,
        isVteHighRisk: isVte,
        enoxaparinPrescribed: enoxaparin,
        referralExplained,
        doctorName,
        referralRecommendation,
        referredHospitalId,
        appointmentDate,
        compliance: "pending",
        notes,
        followUpNotes,
      }).returning({ id: pregnanciesTable.id });
      insertedPregnancies++;

      // --- INSERT APPOINTMENT if date + hospital ---
      if (appointmentDate && referredHospitalId && preg) {
        await db.insert(appointmentsTable).values({
          pregnancyId: preg.id,
          hospitalId: referredHospitalId,
          appointmentDate,
          attended,
          attendanceNote,
        });
        insertedAppointments++;
      }
    } catch (e) {
      console.error(`  ❌ Failed to insert pregnancy for NID=${nationalId}:`, e);
    }
  }

  // --- Summary ---
  console.log("\n" + "=".repeat(50));
  console.log("✅ Import complete!");
  console.log(`   Patients inserted:       ${insertedPatients}`);
  console.log(`   Patients already existed: ${skippedDupPatients}`);
  console.log(`   Pregnancies inserted:     ${insertedPregnancies}`);
  console.log(`   Appointments inserted:    ${insertedAppointments}`);
  console.log(`   Rows skipped (no ID):     ${skippedNoId}`);
  console.log(`   Rows skipped (bad ID):    ${skippedBadId}`);
  if (unmatchedHCs.length) {
    console.log(`\n⚠️  Unmatched health centers (${unmatchedHCs.length}):`);
    unmatchedHCs.forEach(n => console.log(`   - "${n}"`));
  }
  if (unmatchedSectors.length) {
    console.log(`\n⚠️  Unmatched sectors (${unmatchedSectors.length}):`);
    unmatchedSectors.forEach(n => console.log(`   - "${n}"`));
  }
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch(e => { console.error("❌ Fatal error:", e); process.exit(1); });
