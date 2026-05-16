import { Router, type IRouter } from "express";
import { db, patientsTable, pregnanciesTable, healthCentersTable, sectorsTable, hospitalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

function escCsv(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escCsv).join(",");
}

// GET /api/export/patients.csv — admin / coordinator
router.get(
  "/export/patients.csv",
  requireAuth,
  requireRole("admin", "coordinator", "doctor"),
  async (req, res): Promise<void> => {
    // Coordinator sector restriction
    let sectorFilter: number | null = null;
    if (req.user!.role === "coordinator") {
      if (!req.user!.sectorId) {
        res.status(403).json({ error: "لا يوجد قطاع مُعيَّن لحسابك", code: "NO_SECTOR_ASSIGNED" });
        return;
      }
      sectorFilter = Number(req.user!.sectorId);
    }

    const patients = await db.select().from(patientsTable).orderBy(patientsTable.id);
    const centers = await db.select().from(healthCentersTable);
    const sectors = await db.select().from(sectorsTable);
    const centerMap = new Map(centers.map((c) => [c.id, c]));
    const sectorMap = new Map(sectors.map((s) => [s.id, s]));

    const headers = [
      "م", "الاسم", "الهوية الوطنية", "تاريخ الميلاد", "الجوال",
      "المركز الصحي", "القطاع", "تاريخ التسجيل",
      "ID", "Name", "National ID", "DOB", "Phone", "Health Center", "Sector", "Registered At",
    ];

    const rows: string[] = [headers.join(",")];

    for (const p of patients) {
      const center = centerMap.get(p.healthCenterId);
      const sector = center ? sectorMap.get(center.sectorId) : null;

      if (sectorFilter && sector?.id !== sectorFilter) continue;

      rows.push(toCsvRow([
        p.id,
        p.nameAr,
        p.nationalId,
        p.dateOfBirth ?? "",
        p.phone,
        center?.nameAr ?? "",
        sector?.nameAr ?? "",
        new Date(p.createdAt).toLocaleDateString("ar-SA"),
        p.id,
        p.nameEn ?? p.nameAr,
        p.nationalId,
        p.dateOfBirth ?? "",
        p.phone,
        center?.nameEn ?? center?.nameAr ?? "",
        sector?.nameEn ?? sector?.nameAr ?? "",
        new Date(p.createdAt).toISOString().split("T")[0],
      ]));
    }

    const csv = "\uFEFF" + rows.join("\r\n"); // BOM for Excel Arabic
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="patients_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send(csv);
  }
);

// GET /api/export/pregnancies.csv — admin / coordinator / doctor
router.get(
  "/export/pregnancies.csv",
  requireAuth,
  requireRole("admin", "coordinator", "doctor"),
  async (req, res): Promise<void> => {
    let sectorFilter: number | null = null;
    if (req.user!.role === "coordinator") {
      if (!req.user!.sectorId) {
        res.status(403).json({ error: "لا يوجد قطاع مُعيَّن لحسابك", code: "NO_SECTOR_ASSIGNED" });
        return;
      }
      sectorFilter = Number(req.user!.sectorId);
    }

    const [pregnancies, patients, centers, sectors, hospitals] = await Promise.all([
      db.select().from(pregnanciesTable).orderBy(pregnanciesTable.id),
      db.select().from(patientsTable),
      db.select().from(healthCentersTable),
      db.select().from(sectorsTable),
      db.select().from(hospitalsTable),
    ]);

    const patientMap = new Map(patients.map((p) => [p.id, p]));
    const centerMap = new Map(centers.map((c) => [c.id, c]));
    const sectorMap = new Map(sectors.map((s) => [s.id, s]));
    const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));

    const riskAr: Record<string, string> = {
      low: "منخفض", medium: "متوسط", high: "عالي", critical: "حرج",
    };
    const complianceAr: Record<string, string> = {
      compliant: "ملتزم", non_compliant: "غير ملتزم", pending: "بانتظار موعد",
    };
    const referralAr: Record<string, string> = {
      follow_at_center: "متابعة في المركز",
      follow_at_hospital: "متابعة في المستشفى",
      transfer_kfch: "تحويل لـ KFCH",
    };

    const headers = [
      "م", "اسم الحامل", "الهوية", "تاريخ الزيارة", "درجة الخطورة",
      "خطر التجلط", "إينوكسابارين", "توصية الإحالة", "تاريخ الموعد",
      "الالتزام", "أيام العمل", "المستشفى المُحوَّل إليه", "القطاع",
      "ID", "Patient", "Nat.ID", "Visit Date", "Risk Level",
      "VTE", "Enoxaparin", "Referral", "Appt Date", "Compliance", "Working Days", "Hospital", "Sector",
    ];

    const rows: string[] = [headers.join(",")];

    for (const pg of pregnancies) {
      const patient = patientMap.get(pg.patientId);
      if (!patient) continue;
      const center = centerMap.get(patient.healthCenterId);
      const sector = center ? sectorMap.get(center.sectorId) : null;
      if (sectorFilter && sector?.id !== sectorFilter) continue;
      const hospital = pg.referredHospitalId ? hospitalMap.get(pg.referredHospitalId) : null;

      rows.push(toCsvRow([
        pg.id,
        patient.nameAr,
        patient.nationalId,
        pg.visitDate,
        riskAr[pg.riskLevel] ?? pg.riskLevel,
        pg.isVteHighRisk ? "نعم" : "لا",
        pg.enoxaparinPrescribed ? "نعم" : "لا",
        referralAr[pg.referralRecommendation] ?? pg.referralRecommendation,
        pg.appointmentDate ?? "",
        complianceAr[pg.compliance] ?? pg.compliance,
        pg.workingDaysToAppointment ?? "",
        hospital?.nameAr ?? "",
        sector?.nameAr ?? "",
        pg.id,
        patient.nameEn ?? patient.nameAr,
        patient.nationalId,
        pg.visitDate,
        pg.riskLevel,
        pg.isVteHighRisk ? "Yes" : "No",
        pg.enoxaparinPrescribed ? "Yes" : "No",
        pg.referralRecommendation,
        pg.appointmentDate ?? "",
        pg.compliance,
        pg.workingDaysToAppointment ?? "",
        hospital?.nameEn ?? hospital?.nameAr ?? "",
        sector?.nameEn ?? sector?.nameAr ?? "",
      ]));
    }

    const csv = "\uFEFF" + rows.join("\r\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="pregnancies_${new Date().toISOString().split("T")[0]}.csv"`);
    res.send(csv);
  }
);

export default router;
