import { Router, type IRouter } from "express";
import { db, pregnanciesTable, patientsTable, hospitalsTable, appointmentsTable } from "@workspace/db";
import { eq, and, sql, count } from "drizzle-orm";
import {
  ListPregnanciesQueryParams,
  GetPregnancyParams,
  UpdatePregnancyParams,
  CreatePregnancyBody,
  UpdatePregnancyBody,
} from "@workspace/api-zod";
import { calculateCompliance } from "../lib/compliance";

const router: IRouter = Router();

function serializePregnancy(
  p: typeof pregnanciesTable.$inferSelect,
  patient: typeof patientsTable.$inferSelect | undefined,
  hospital: typeof hospitalsTable.$inferSelect | undefined
) {
  return {
    id: p.id,
    patientId: p.patientId,
    patientNameAr: patient?.nameAr ?? null,
    patientNationalId: patient?.nationalId ?? null,
    visitDate: p.visitDate,
    lmpDate: p.lmpDate ?? null,
    gestationalAge: p.gestationalAge ?? null,
    riskLevel: p.riskLevel,
    riskFactors: p.riskFactors ?? [],
    isVteHighRisk: p.isVteHighRisk,
    enoxaparinPrescribed: p.enoxaparinPrescribed,
    doctorName: p.doctorName ?? null,
    referralRecommendation: p.referralRecommendation,
    referredHospitalId: p.referredHospitalId ?? null,
    referredHospitalNameAr: hospital?.nameAr ?? null,
    appointmentDate: p.appointmentDate ?? null,
    compliance: p.compliance,
    workingDaysToAppointment: p.workingDaysToAppointment ?? null,
    notes: p.notes ?? null,
    coordinatorClassification: p.coordinatorClassification ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// GET /pregnancies
router.get("/pregnancies", async (req, res): Promise<void> => {
  const params = ListPregnanciesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { patientId, riskLevel, hospitalId, sectorId, compliance, limit = 50, offset = 0 } = params.data;

  const conditions = [];

  if (patientId) conditions.push(eq(pregnanciesTable.patientId, patientId));
  if (riskLevel) conditions.push(eq(pregnanciesTable.riskLevel, riskLevel));
  if (hospitalId) conditions.push(eq(pregnanciesTable.referredHospitalId, hospitalId));
  if (compliance) conditions.push(eq(pregnanciesTable.compliance, compliance));

  let patientIdsForSector: number[] | null = null;
  if (sectorId) {
    const patientsInSector = await db.execute(
      sql`SELECT p.id FROM patients p JOIN health_centers hc ON p.health_center_id = hc.id WHERE hc.sector_id = ${sectorId}`
    );
    patientIdsForSector = (patientsInSector.rows as { id: number }[]).map((r) => r.id);
    if (patientIdsForSector.length === 0) {
      res.json({ items: [], total: 0 });
      return;
    }
    conditions.push(sql`${pregnanciesTable.patientId} = ANY(ARRAY[${sql.join(patientIdsForSector.map(id => sql`${id}`), sql`, `)}]::integer[])`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, pregnancies] = await Promise.all([
    db.select({ count: count() }).from(pregnanciesTable).where(whereClause),
    db.select().from(pregnanciesTable).where(whereClause).limit(limit).offset(offset).orderBy(pregnanciesTable.createdAt),
  ]);

  const total = totalResult[0]?.count ?? 0;

  // Enrich
  const patientIds = [...new Set(pregnancies.map((p) => p.patientId))];
  const hospitalIds = [...new Set(pregnancies.map((p) => p.referredHospitalId).filter(Boolean) as number[])];

  const [patients, hospitals] = await Promise.all([
    patientIds.length > 0
      ? db.select().from(patientsTable).where(sql`${patientsTable.id} = ANY(ARRAY[${sql.join(patientIds.map(id => sql`${id}`), sql`, `)}]::integer[])`)
      : [],
    hospitalIds.length > 0
      ? db.select().from(hospitalsTable).where(sql`${hospitalsTable.id} = ANY(ARRAY[${sql.join(hospitalIds.map(id => sql`${id}`), sql`, `)}]::integer[])`)
      : [],
  ]);

  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));

  const items = pregnancies.map((p) =>
    serializePregnancy(p, patientMap.get(p.patientId), p.referredHospitalId ? hospitalMap.get(p.referredHospitalId) : undefined)
  );

  res.json({ items, total });
});

// POST /pregnancies
router.post("/pregnancies", async (req, res): Promise<void> => {
  const parsed = CreatePregnancyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { compliance, workingDays } = calculateCompliance(
    parsed.data.visitDate,
    parsed.data.appointmentDate ?? null
  );

  const [pregnancy] = await db
    .insert(pregnanciesTable)
    .values({
      patientId: parsed.data.patientId,
      visitDate: parsed.data.visitDate,
      lmpDate: parsed.data.lmpDate ?? null,
      gestationalAge: parsed.data.gestationalAge ?? null,
      riskLevel: parsed.data.riskLevel,
      riskFactors: parsed.data.riskFactors ?? [],
      isVteHighRisk: parsed.data.isVteHighRisk ?? false,
      enoxaparinPrescribed: parsed.data.enoxaparinPrescribed ?? false,
      doctorName: parsed.data.doctorName ?? null,
      referralRecommendation: parsed.data.referralRecommendation,
      referredHospitalId: parsed.data.referredHospitalId ?? null,
      appointmentDate: parsed.data.appointmentDate ?? null,
      compliance,
      workingDaysToAppointment: workingDays,
      notes: parsed.data.notes ?? null,
      coordinatorClassification: parsed.data.coordinatorClassification ?? null,
    })
    .returning();

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, pregnancy.patientId)).limit(1);
  const hospital = pregnancy.referredHospitalId
    ? (await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, pregnancy.referredHospitalId)).limit(1))[0]
    : undefined;

  res.status(201).json(serializePregnancy(pregnancy, patient, hospital));
});

// GET /pregnancies/:id
router.get("/pregnancies/:id", async (req, res): Promise<void> => {
  const params = GetPregnancyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pregnancy] = await db
    .select()
    .from(pregnanciesTable)
    .where(eq(pregnanciesTable.id, params.data.id))
    .limit(1);

  if (!pregnancy) {
    res.status(404).json({ error: "Pregnancy not found" });
    return;
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, pregnancy.patientId)).limit(1);
  const hospital = pregnancy.referredHospitalId
    ? (await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, pregnancy.referredHospitalId)).limit(1))[0]
    : undefined;

  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.pregnancyId, pregnancy.id))
    .orderBy(appointmentsTable.appointmentDate);

  const apptHospitalIds = [...new Set(appts.map((a) => a.hospitalId))];
  const apptHospitals = apptHospitalIds.length > 0
    ? await db.select().from(hospitalsTable).where(sql`${hospitalsTable.id} = ANY(ARRAY[${sql.join(apptHospitalIds.map(id => sql`${id}`), sql`, `)}]::integer[])`)
    : [];
  const apptHospitalMap = new Map(apptHospitals.map((h) => [h.id, h]));

  const appointments = appts.map((a) => ({
    id: a.id,
    pregnancyId: a.pregnancyId,
    hospitalId: a.hospitalId,
    hospitalNameAr: apptHospitalMap.get(a.hospitalId)?.nameAr ?? null,
    appointmentDate: a.appointmentDate,
    attended: a.attended ?? null,
    attendanceNote: a.attendanceNote ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  res.json({
    pregnancy: serializePregnancy(pregnancy, patient, hospital),
    patient: patient ? {
      id: patient.id,
      nationalId: patient.nationalId,
      nameAr: patient.nameAr,
      nameEn: patient.nameEn ?? null,
      dateOfBirth: patient.dateOfBirth ?? null,
      age: null,
      phone: patient.phone,
      address: patient.address ?? null,
      healthCenterId: patient.healthCenterId,
      healthCenterNameAr: null,
      sectorId: 0,
      sectorNameAr: null,
      totalPregnancies: null,
      createdAt: patient.createdAt.toISOString(),
    } : null,
    appointments,
  });
});

// PATCH /pregnancies/:id
router.patch("/pregnancies/:id", async (req, res): Promise<void> => {
  const params = UpdatePregnancyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePregnancyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Get current to compute compliance
  const [current] = await db.select().from(pregnanciesTable).where(eq(pregnanciesTable.id, params.data.id)).limit(1);
  if (!current) {
    res.status(404).json({ error: "Pregnancy not found" });
    return;
  }

  const visitDate = parsed.data.visitDate ?? current.visitDate;
  const appointmentDate = parsed.data.appointmentDate !== undefined ? parsed.data.appointmentDate : current.appointmentDate;
  const { compliance, workingDays } = calculateCompliance(visitDate, appointmentDate);

  const updateData: Record<string, unknown> = { compliance, workingDaysToAppointment: workingDays };
  if (parsed.data.visitDate != null) updateData.visitDate = parsed.data.visitDate;
  if (parsed.data.lmpDate !== undefined) updateData.lmpDate = parsed.data.lmpDate;
  if (parsed.data.gestationalAge !== undefined) updateData.gestationalAge = parsed.data.gestationalAge;
  if (parsed.data.riskLevel != null) updateData.riskLevel = parsed.data.riskLevel;
  if (parsed.data.riskFactors != null) updateData.riskFactors = parsed.data.riskFactors;
  if (parsed.data.isVteHighRisk !== undefined) updateData.isVteHighRisk = parsed.data.isVteHighRisk;
  if (parsed.data.enoxaparinPrescribed !== undefined) updateData.enoxaparinPrescribed = parsed.data.enoxaparinPrescribed;
  if (parsed.data.doctorName !== undefined) updateData.doctorName = parsed.data.doctorName;
  if (parsed.data.referralRecommendation != null) updateData.referralRecommendation = parsed.data.referralRecommendation;
  if (parsed.data.referredHospitalId !== undefined) updateData.referredHospitalId = parsed.data.referredHospitalId;
  if (parsed.data.appointmentDate !== undefined) updateData.appointmentDate = parsed.data.appointmentDate;
  if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
  if (parsed.data.coordinatorClassification !== undefined) updateData.coordinatorClassification = parsed.data.coordinatorClassification;

  const [pregnancy] = await db
    .update(pregnanciesTable)
    .set(updateData)
    .where(eq(pregnanciesTable.id, params.data.id))
    .returning();

  if (!pregnancy) {
    res.status(404).json({ error: "Pregnancy not found" });
    return;
  }

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, pregnancy.patientId)).limit(1);
  const hospital = pregnancy.referredHospitalId
    ? (await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, pregnancy.referredHospitalId)).limit(1))[0]
    : undefined;

  res.json(serializePregnancy(pregnancy, patient, hospital));
});

export default router;
