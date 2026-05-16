import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/alerts", async (req, res): Promise<void> => {
  // Coordinator: restrict to their sector only. Admin/doctor/viewer: global view.
  const isCoordinator = req.user?.role === "coordinator";
  if (isCoordinator && !req.user?.sectorId) {
    res.status(403).json({ error: "حسابك لم يُعيَّن له قطاع بعد", code: "NO_SECTOR_ASSIGNED" });
    return;
  }
  const sectorFilter = isCoordinator ? req.user!.sectorId : null;

  const sectorClause = sectorFilter
    ? sql`AND hc.sector_id = ${sectorFilter}`
    : sql``;

  const [vteRows, criticalRows, missedRows] = await Promise.all([
    // VTE high risk without Enoxaparin
    db.execute(sql`
      SELECT
        pr.id as pregnancy_id,
        pa.id as patient_id,
        pa.name_ar as patient_name_ar,
        pa.national_id as patient_national_id,
        pr.risk_level,
        pr.created_at
      FROM pregnancies pr
      JOIN patients pa ON pr.patient_id = pa.id
      JOIN health_centers hc ON pa.health_center_id = hc.id
      WHERE pr.is_vte_high_risk = true AND pr.enoxaparin_prescribed = false
      ${sectorClause}
      ORDER BY pr.created_at DESC
      LIMIT 50
    `),
    // Critical without appointments
    db.execute(sql`
      SELECT
        pr.id as pregnancy_id,
        pa.id as patient_id,
        pa.name_ar as patient_name_ar,
        pa.national_id as patient_national_id,
        pr.risk_level,
        pr.created_at
      FROM pregnancies pr
      JOIN patients pa ON pr.patient_id = pa.id
      JOIN health_centers hc ON pa.health_center_id = hc.id
      WHERE pr.risk_level = 'critical'
      AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.pregnancy_id = pr.id)
      ${sectorClause}
      ORDER BY pr.created_at DESC
      LIMIT 50
    `),
    // Missed appointments
    db.execute(sql`
      SELECT
        pr.id as pregnancy_id,
        pa.id as patient_id,
        pa.name_ar as patient_name_ar,
        pa.national_id as patient_national_id,
        pr.risk_level,
        a.appointment_date as created_at
      FROM appointments a
      JOIN pregnancies pr ON a.pregnancy_id = pr.id
      JOIN patients pa ON pr.patient_id = pa.id
      JOIN health_centers hc ON pa.health_center_id = hc.id
      WHERE a.attended = false
      ${sectorClause}
      ORDER BY a.appointment_date DESC
      LIMIT 50
    `),
  ]);

  type AlertRow = {
    pregnancy_id: number;
    patient_id: number;
    patient_name_ar: string;
    patient_national_id: string;
    risk_level: string;
    created_at: string | Date;
  };

  const alerts = [
    ...(vteRows.rows as AlertRow[]).map((r) => ({
      type: "vte_without_enoxaparin" as const,
      pregnancyId: r.pregnancy_id,
      patientId: r.patient_id,
      patientNameAr: r.patient_name_ar,
      patientNationalId: r.patient_national_id,
      riskLevel: r.risk_level,
      severity: "warning" as const,
      message: "حالة VTE عالية الخطورة بدون Enoxaparin",
      createdAt: new Date(r.created_at).toISOString(),
    })),
    ...(criticalRows.rows as AlertRow[]).map((r) => ({
      type: "critical_without_appointment" as const,
      pregnancyId: r.pregnancy_id,
      patientId: r.patient_id,
      patientNameAr: r.patient_name_ar,
      patientNationalId: r.patient_national_id,
      riskLevel: r.risk_level,
      severity: "critical" as const,
      message: "حالة حرجة بدون موعد محجوز",
      createdAt: new Date(r.created_at).toISOString(),
    })),
    ...(missedRows.rows as AlertRow[]).map((r) => ({
      type: "missed_appointment" as const,
      pregnancyId: r.pregnancy_id,
      patientId: r.patient_id,
      patientNameAr: r.patient_name_ar,
      patientNationalId: r.patient_national_id,
      riskLevel: r.risk_level,
      severity: (r.risk_level === "critical" ? "critical" : "warning") as "critical" | "warning",
      message: "لم تحضر المريضة لموعدها",
      createdAt: new Date(r.created_at).toISOString(),
    })),
  ];

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  res.json({
    alerts,
    totalCount: alerts.length,
    criticalCount,
  });
});

export default router;
