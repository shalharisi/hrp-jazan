import { Router, type IRouter } from "express";
import { db, pregnanciesTable, patientsTable, appointmentsTable, sectorsTable, hospitalsTable, healthCentersTable } from "@workspace/db";
import { eq, sql, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [totalPatients, totalPregnancies, riskCounts, vteCounts, complianceCounts, apptCounts] = await Promise.all([
    db.select({ count: count() }).from(patientsTable),
    db.select({ count: count() }).from(pregnanciesTable),
    db.execute(sql`
      SELECT risk_level, COUNT(*)::int as count FROM pregnancies GROUP BY risk_level
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int as total_vte,
        SUM(CASE WHEN enoxaparin_prescribed = false THEN 1 ELSE 0 END)::int as vte_without_enox
      FROM pregnancies WHERE is_vte_high_risk = true
    `),
    db.execute(sql`
      SELECT compliance, COUNT(*)::int as count FROM pregnancies GROUP BY compliance
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int as total,
        SUM(CASE WHEN attended = true THEN 1 ELSE 0 END)::int as attended,
        SUM(CASE WHEN attended = false THEN 1 ELSE 0 END)::int as missed
      FROM appointments
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

  const vteRow = (vteCounts.rows as { total_vte: number; vte_without_enox: number }[])[0] ?? { total_vte: 0, vte_without_enox: 0 };
  const apptRow = (apptCounts.rows as { total: number; attended: number; missed: number }[])[0] ?? { total: 0, attended: 0, missed: 0 };

  const compliant = compMap.get("compliant") ?? 0;
  const nonCompliant = compMap.get("non_compliant") ?? 0;
  const pending = compMap.get("pending") ?? 0;
  const totalWithAppt = compliant + nonCompliant;

  // Critical without appointments: critical pregnancies that have no appointment in appointments table
  const criticalWithoutAppt = await db.execute(sql`
    SELECT COUNT(*)::int as count FROM pregnancies p
    WHERE p.risk_level = 'critical'
    AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.pregnancy_id = p.id)
  `);
  const criticalNoAppt = ((criticalWithoutAppt.rows as { count: number }[])[0]?.count) ?? 0;

  const attendanceRate = apptRow.total > 0 ? (apptRow.attended / apptRow.total) * 100 : 0;
  const complianceRate = totalWithAppt + pending > 0 ? (compliant / (totalWithAppt + pending)) * 100 : 0;

  res.json({
    totalPatients: totalPatients[0]?.count ?? 0,
    totalPregnancies: totalPregnancies[0]?.count ?? 0,
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

router.get("/dashboard/by-sector", async (_req, res): Promise<void> => {
  const sectors = await db.select().from(sectorsTable).orderBy(sectorsTable.id);

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

      const row = (stats.rows as { total_cases: number; critical_cases: number; high_risk_cases: number; compliant: number; total: number }[])[0] ?? {
        total_cases: 0, critical_cases: 0, high_risk_cases: 0, compliant: 0, total: 0
      };

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
    })
  );

  res.json(result);
});

router.get("/dashboard/by-hospital", async (_req, res): Promise<void> => {
  const hospitals = await db.select().from(hospitalsTable).orderBy(hospitalsTable.id);

  const result = await Promise.all(
    hospitals.map(async (hospital) => {
      const stats = await db.execute(sql`
        SELECT
          COUNT(DISTINCT pr.id)::int as total_referrals
        FROM pregnancies pr
        WHERE pr.referred_hospital_id = ${hospital.id}
      `);

      const apptStats = await db.execute(sql`
        SELECT
          COUNT(*)::int as total,
          SUM(CASE WHEN attended = true THEN 1 ELSE 0 END)::int as attended,
          SUM(CASE WHEN attended = false THEN 1 ELSE 0 END)::int as missed
        FROM appointments
        WHERE hospital_id = ${hospital.id}
      `);

      const row = (stats.rows as { total_referrals: number }[])[0] ?? { total_referrals: 0 };
      const apptRow = (apptStats.rows as { total: number; attended: number; missed: number }[])[0] ?? { total: 0, attended: 0, missed: 0 };
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
    })
  );

  res.json(result);
});

router.get("/dashboard/by-risk-level", async (_req, res): Promise<void> => {
  const totalResult = await db.select({ count: count() }).from(pregnanciesTable);
  const total = totalResult[0]?.count ?? 1;

  const riskStats = await db.execute(sql`
    SELECT risk_level, COUNT(*)::int as count FROM pregnancies GROUP BY risk_level ORDER BY
    CASE risk_level
      WHEN 'low' THEN 1
      WHEN 'medium' THEN 2
      WHEN 'high' THEN 3
      WHEN 'critical' THEN 4
    END
  `);

  const result = (riskStats.rows as { risk_level: string; count: number }[]).map((row) => ({
    riskLevel: row.risk_level,
    count: row.count,
    percentage: Math.round((row.count / (total || 1)) * 1000) / 10,
  }));

  res.json(result);
});

router.get("/dashboard/compliance", async (_req, res): Promise<void> => {
  const complianceStats = await db.execute(sql`
    SELECT compliance, COUNT(*)::int as count FROM pregnancies GROUP BY compliance
  `);

  const compMap = new Map<string, number>();
  for (const row of complianceStats.rows as { compliance: string; count: number }[]) {
    compMap.set(row.compliance, row.count);
  }

  const compliant = compMap.get("compliant") ?? 0;
  const nonCompliant = compMap.get("non_compliant") ?? 0;
  const pending = compMap.get("pending") ?? 0;
  const totalWithAppt = compliant + nonCompliant;
  const complianceRate = totalWithAppt > 0 ? (compliant / totalWithAppt) * 100 : 0;

  const apptStats = await db.execute(sql`
    SELECT
      COUNT(*)::int as total,
      SUM(CASE WHEN attended = true THEN 1 ELSE 0 END)::int as attended
    FROM appointments
  `);
  const apptRow = (apptStats.rows as { total: number; attended: number }[])[0] ?? { total: 0, attended: 0 };
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
