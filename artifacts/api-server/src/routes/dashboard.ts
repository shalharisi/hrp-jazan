import { Router, type IRouter } from "express";
import { db, sectorsTable, hospitalsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Coordinator sector isolation helper ──────────────────────────────────────
// Returns the numeric sectorId for coordinators, null for all other roles.
// Sends a 403 response and returns undefined if coordinator has no sector.
function resolveSectorId(
  req: Parameters<typeof router.get>[1] extends (...args: infer A) => unknown ? A[0] : never,
  res: Parameters<typeof router.get>[1] extends (...args: infer A) => unknown ? A[1] : never,
): number | null | "rejected" {
  if (req.user?.role !== "coordinator") return null;
  if (!req.user.sectorId) {
    res.status(403).json({ error: "حسابك لم يُعيَّن له قطاع بعد", code: "NO_SECTOR_ASSIGNED" });
    return "rejected";
  }
  return Number(req.user.sectorId);
}

// JOIN clause to scope all pregnancy/patient queries to a sector
function sectorJoinSql(sectorId: number | null) {
  if (!sectorId) return sql``;
  return sql`JOIN health_centers _hc ON pa.health_center_id = _hc.id AND _hc.sector_id = ${sectorId}`;
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const sectorId = resolveSectorId(req as never, res as never);
  if (sectorId === "rejected") return;
  const sj = sectorJoinSql(sectorId);

  const [totalPatients, totalPregnancies, riskCounts, vteCounts, complianceCounts, apptCounts] =
    await Promise.all([
      db.execute(sql`SELECT COUNT(*)::int as count FROM patients pa ${sj}`),
      db.execute(
        sql`SELECT COUNT(*)::int as count FROM pregnancies pr JOIN patients pa ON pr.patient_id = pa.id ${sj}`,
      ),
      db.execute(sql`
      SELECT risk_level, COUNT(*)::int as count FROM pregnancies pr
      JOIN patients pa ON pr.patient_id = pa.id ${sj}
      GROUP BY risk_level
    `),
      db.execute(sql`
      SELECT
        COUNT(*)::int as total_vte,
        SUM(CASE WHEN enoxaparin_prescribed = false THEN 1 ELSE 0 END)::int as vte_without_enox
      FROM pregnancies pr
      JOIN patients pa ON pr.patient_id = pa.id ${sj}
      WHERE pr.is_vte_high_risk = true
    `),
      db.execute(sql`
      SELECT compliance, COUNT(*)::int as count FROM pregnancies pr
      JOIN patients pa ON pr.patient_id = pa.id ${sj}
      GROUP BY compliance
    `),
      db.execute(sql`
      SELECT
        COUNT(*)::int as total,
        SUM(CASE WHEN a.attended = true THEN 1 ELSE 0 END)::int as attended,
        SUM(CASE WHEN a.attended = false THEN 1 ELSE 0 END)::int as missed
      FROM appointments a
      JOIN pregnancies pr ON a.pregnancy_id = pr.id
      JOIN patients pa ON pr.patient_id = pa.id ${sj}
    `),
    ]);

  const riskMap = new Map<string, number>();
  for (const row of riskCounts.rows as { risk_level: string; count: number }[]) {
    riskMap.set(row.risk_level, row.count);
  }
  const compMap = new Map<string, number>();
  for (const row of complianceCounts.rows as { compliance: string; count: number }[]) {
    compMap.set(row.compliance, row.count);
  }

  const vteRow = (vteCounts.rows as { total_vte: number; vte_without_enox: number }[])[0] ?? {
    total_vte: 0,
    vte_without_enox: 0,
  };
  const apptRow = (apptCounts.rows as { total: number; attended: number; missed: number }[])[0] ?? {
    total: 0,
    attended: 0,
    missed: 0,
  };

  const compliant = compMap.get("compliant") ?? 0;
  const nonCompliant = compMap.get("non_compliant") ?? 0;
  const pending = compMap.get("pending") ?? 0;
  const totalWithAppt = compliant + nonCompliant;

  const criticalWithoutAppt = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM pregnancies p
    JOIN patients pa ON p.patient_id = pa.id ${sj}
    WHERE p.risk_level = 'critical'
    AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.pregnancy_id = p.id)
  `);
  const criticalNoAppt = (criticalWithoutAppt.rows as { count: number }[])[0]?.count ?? 0;

  const attendanceRate = apptRow.total > 0 ? (apptRow.attended / apptRow.total) * 100 : 0;
  const complianceRate =
    totalWithAppt + pending > 0 ? (compliant / (totalWithAppt + pending)) * 100 : 0;

  res.json({
    totalPatients: (totalPatients.rows as { count: number }[])[0]?.count ?? 0,
    totalPregnancies: (totalPregnancies.rows as { count: number }[])[0]?.count ?? 0,
    totalCritical: riskMap.get("critical") ?? 0,
    totalHighRisk: riskMap.get("high") ?? 0,
    totalVteHighRisk: vteRow.total_vte,
    vteWithoutEnoxaparin: vteRow.vte_without_enox,
    bookingComplianceRate: Math.round(complianceRate * 10) / 10,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    criticalWithoutAppointment: criticalNoAppt,
    pendingAppointments: pending,
  });
});

router.get("/dashboard/by-sector", async (req, res): Promise<void> => {
  const sectorId = resolveSectorId(req as never, res as never);
  if (sectorId === "rejected") return;

  // Coordinator sees only their sector; others see all
  const sectors = await db
    .select()
    .from(sectorsTable)
    .where(sectorId !== null ? eq(sectorsTable.id, sectorId) : undefined)
    .orderBy(sectorsTable.id);

  const result = await Promise.all(
    sectors.map(async (sector) => {
      const stats = await db.execute(sql`
        SELECT
          COUNT(*)::int as total_cases,
          SUM(CASE WHEN pr.risk_level = 'critical' THEN 1 ELSE 0 END)::int as critical_cases,
          SUM(CASE WHEN pr.risk_level = 'high' THEN 1 ELSE 0 END)::int as high_risk_cases,
          SUM(CASE WHEN pr.compliance = 'compliant' THEN 1 ELSE 0 END)::int as compliant,
          COUNT(*)::int as total
        FROM pregnancies pr
        JOIN patients pa ON pr.patient_id = pa.id
        JOIN health_centers hc ON pa.health_center_id = hc.id
        WHERE hc.sector_id = ${sector.id}
      `);
      const row = (
        stats.rows as {
          total_cases: number;
          critical_cases: number;
          high_risk_cases: number;
          compliant: number;
          total: number;
        }[]
      )[0] ?? { total_cases: 0, critical_cases: 0, high_risk_cases: 0, compliant: 0, total: 0 };
      const complianceRate = row.total > 0 ? (row.compliant / row.total) * 100 : 0;
      return {
        sectorId: sector.id,
        sectorNameAr: sector.nameAr,
        sectorNameEn: sector.nameEn,
        totalCases: row.total_cases,
        criticalCases: row.critical_cases,
        highRiskCases: row.high_risk_cases,
        complianceRate: Math.round(complianceRate * 10) / 10,
      };
    }),
  );

  res.json(result);
});

router.get("/dashboard/by-hospital", async (req, res): Promise<void> => {
  const sectorId = resolveSectorId(req as never, res as never);
  if (sectorId === "rejected") return;

  // Coordinator: limit to the hospital(s) that serve their sector
  type HospRow = { id: number; nameAr: string; nameEn: string | null; isKfch: boolean | null };
  let hospitalRows: HospRow[];

  if (sectorId !== null) {
    const rows = await db.execute(sql`
      SELECT DISTINCT h.id, h.name_ar as "nameAr", h.name_en as "nameEn", h.is_kfch as "isKfch"
      FROM hospitals h
      WHERE h.id IN (SELECT s.hospital_id FROM sectors s WHERE s.id = ${sectorId})
      ORDER BY h.id
    `);
    hospitalRows = rows.rows as HospRow[];
  } else {
    const all = await db.select().from(hospitalsTable).orderBy(hospitalsTable.id);
    hospitalRows = all.map((h) => ({
      id: h.id,
      nameAr: h.nameAr,
      nameEn: h.nameEn,
      isKfch: h.isKfch,
    }));
  }

  const result = await Promise.all(
    hospitalRows.map(async (hospital) => {
      const sectorPatientFilter =
        sectorId !== null
          ? sql`AND pr.patient_id IN (
            SELECT pa.id FROM patients pa
            JOIN health_centers hc ON pa.health_center_id = hc.id
            WHERE hc.sector_id = ${sectorId}
          )`
          : sql``;

      const [stats, apptStats] = await Promise.all([
        db.execute(sql`
          SELECT COUNT(DISTINCT pr.id)::int as total_referrals
          FROM pregnancies pr
          WHERE pr.referred_hospital_id = ${hospital.id}
          ${sectorPatientFilter}
        `),
        db.execute(sql`
          SELECT
            COUNT(*)::int as total,
            SUM(CASE WHEN a.attended = true THEN 1 ELSE 0 END)::int as attended,
            SUM(CASE WHEN a.attended = false THEN 1 ELSE 0 END)::int as missed
          FROM appointments a
          JOIN pregnancies pr ON a.pregnancy_id = pr.id
          WHERE a.hospital_id = ${hospital.id}
          ${sectorPatientFilter}
        `),
      ]);

      const row = (stats.rows as { total_referrals: number }[])[0] ?? { total_referrals: 0 };
      const apptRow = (
        apptStats.rows as { total: number; attended: number; missed: number }[]
      )[0] ?? { total: 0, attended: 0, missed: 0 };
      const attendanceRate = apptRow.total > 0 ? (apptRow.attended / apptRow.total) * 100 : 0;

      return {
        hospitalId: hospital.id,
        hospitalNameAr: hospital.nameAr,
        hospitalNameEn: hospital.nameEn,
        isKfch: hospital.isKfch,
        totalReferrals: row.total_referrals,
        attendedAppointments: apptRow.attended,
        missedAppointments: apptRow.missed,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
      };
    }),
  );

  res.json(result);
});

router.get("/dashboard/by-risk-level", async (req, res): Promise<void> => {
  const sectorId = resolveSectorId(req as never, res as never);
  if (sectorId === "rejected") return;
  const sj = sectorJoinSql(sectorId);

  const totalResult = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM pregnancies pr
    JOIN patients pa ON pr.patient_id = pa.id ${sj}
  `);
  const total = (totalResult.rows as { count: number }[])[0]?.count ?? 1;

  const riskStats = await db.execute(sql`
    SELECT risk_level, COUNT(*)::int as count FROM pregnancies pr
    JOIN patients pa ON pr.patient_id = pa.id ${sj}
    GROUP BY risk_level ORDER BY
    CASE risk_level
      WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 WHEN 'critical' THEN 4
    END
  `);

  res.json(
    (riskStats.rows as { risk_level: string; count: number }[]).map((row) => ({
      riskLevel: row.risk_level,
      count: row.count,
      percentage: Math.round((row.count / (total || 1)) * 1000) / 10,
    })),
  );
});

router.get("/dashboard/compliance", async (req, res): Promise<void> => {
  const sectorId = resolveSectorId(req as never, res as never);
  if (sectorId === "rejected") return;
  const sj = sectorJoinSql(sectorId);

  const [complianceStats, apptStats] = await Promise.all([
    db.execute(sql`
      SELECT compliance, COUNT(*)::int as count FROM pregnancies pr
      JOIN patients pa ON pr.patient_id = pa.id ${sj}
      GROUP BY compliance
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int as total,
        SUM(CASE WHEN a.attended = true THEN 1 ELSE 0 END)::int as attended
      FROM appointments a
      JOIN pregnancies pr ON a.pregnancy_id = pr.id
      JOIN patients pa ON pr.patient_id = pa.id ${sj}
    `),
  ]);

  const compMap = new Map<string, number>();
  for (const row of complianceStats.rows as { compliance: string; count: number }[]) {
    compMap.set(row.compliance, row.count);
  }

  const compliant = compMap.get("compliant") ?? 0;
  const nonCompliant = compMap.get("non_compliant") ?? 0;
  const pending = compMap.get("pending") ?? 0;
  const totalWithAppt = compliant + nonCompliant;
  const complianceRate = totalWithAppt > 0 ? (compliant / totalWithAppt) * 100 : 0;

  const apptRow = (apptStats.rows as { total: number; attended: number }[])[0] ?? {
    total: 0,
    attended: 0,
  };
  const attendanceRate = apptRow.total > 0 ? (apptRow.attended / apptRow.total) * 100 : 0;

  res.json({
    compliant,
    nonCompliant,
    pending,
    totalWithAppointment: totalWithAppt,
    complianceRate: Math.round(complianceRate * 10) / 10,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
  });
});

export default router;
