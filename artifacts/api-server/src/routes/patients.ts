import { Router, type IRouter } from "express";
import { db, patientsTable, healthCentersTable, sectorsTable, pregnanciesTable } from "@workspace/db";
import { eq, like, and, or, sql, count } from "drizzle-orm";
import {
  ListPatientsQueryParams,
  GetPatientParams,
  UpdatePatientParams,
  GetPatientByNidParams,
  CreatePatientBody,
  UpdatePatientBody,
} from "@workspace/api-zod";
import { requireWriteAccess, isCoordinatorSectorMatch } from "../lib/auth";
import { logAudit, buildAuditParams } from "../lib/audit";

const router: IRouter = Router();

// GET /patients
router.get("/patients", async (req, res): Promise<void> => {
  // Coordinator sector enforcement
  if (req.user?.role === "coordinator") {
    if (!req.user.sectorId) {
      res.status(403).json({ error: "حسابك لم يُعيَّن له قطاع بعد — يرجى التواصل مع مسؤول النظام", code: "NO_SECTOR_ASSIGNED" });
      return;
    }
    req.query["sectorId"] = String(req.user.sectorId);
  }

  const params = ListPatientsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { search, sectorId, healthCenterId, limit = 50, offset = 0 } = params.data;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        like(patientsTable.nameAr, `%${search}%`),
        like(patientsTable.nationalId, `%${search}%`),
        like(patientsTable.nameEn, `%${search}%`)
      )
    );
  }

  if (healthCenterId) {
    conditions.push(eq(patientsTable.healthCenterId, healthCenterId));
  }

  if (sectorId) {
    const centersInSector = await db
      .select({ id: healthCentersTable.id })
      .from(healthCentersTable)
      .where(eq(healthCentersTable.sectorId, sectorId));
    const centerIds = centersInSector.map((c) => c.id);
    if (centerIds.length === 0) {
      res.json({ items: [], total: 0 });
      return;
    }
    conditions.push(sql`${patientsTable.healthCenterId} = ANY(ARRAY[${sql.join(centerIds.map(id => sql`${id}`), sql`, `)}]::integer[])`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, patients] = await Promise.all([
    db.select({ count: count() }).from(patientsTable).where(whereClause),
    db.select().from(patientsTable).where(whereClause).limit(limit).offset(offset).orderBy(patientsTable.createdAt),
  ]);

  const total = totalResult[0]?.count ?? 0;

  const centerIds = [...new Set(patients.map((p) => p.healthCenterId))];
  const centers = centerIds.length > 0
    ? await db.select().from(healthCentersTable).where(sql`${healthCentersTable.id} = ANY(ARRAY[${sql.join(centerIds.map(id => sql`${id}`), sql`, `)}]::integer[])`)
    : [];
  const centerMap = new Map(centers.map((c) => [c.id, c]));

  const sectorIdsList = [...new Set(centers.map((c) => c.sectorId))];
  const sectors = sectorIdsList.length > 0
    ? await db.select().from(sectorsTable).where(sql`${sectorsTable.id} = ANY(ARRAY[${sql.join(sectorIdsList.map(id => sql`${id}`), sql`, `)}]::integer[])`)
    : [];
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));

  const pregnancyCounts = patients.length > 0
    ? await db
        .select({ patientId: pregnanciesTable.patientId, count: count() })
        .from(pregnanciesTable)
        .where(sql`${pregnanciesTable.patientId} = ANY(ARRAY[${sql.join(patients.map(p => sql`${p.id}`), sql`, `)}]::integer[])`)
        .groupBy(pregnanciesTable.patientId)
    : [];
  const pregCountMap = new Map(pregnancyCounts.map((pc) => [pc.patientId, pc.count]));

  const items = patients.map((p) => {
    const center = centerMap.get(p.healthCenterId);
    const sector = center ? sectorMap.get(center.sectorId) : undefined;
    const dob = p.dateOfBirth ? new Date(p.dateOfBirth) : null;
    const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

    return {
      id: p.id,
      nationalId: p.nationalId,
      nameAr: p.nameAr,
      nameEn: p.nameEn ?? null,
      dateOfBirth: p.dateOfBirth ?? null,
      age,
      phone: p.phone,
      address: p.address ?? null,
      healthCenterId: p.healthCenterId,
      healthCenterNameAr: center?.nameAr ?? null,
      sectorId: center?.sectorId ?? 0,
      sectorNameAr: sector?.nameAr ?? null,
      totalPregnancies: pregCountMap.get(p.id) ?? 0,
      createdAt: p.createdAt.toISOString(),
    };
  });

  res.json({ items, total });
});

// POST /patients — requires write access (not viewer)
router.post("/patients", requireWriteAccess, async (req, res): Promise<void> => {
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // ── Coordinator sector enforcement (via healthCenterId → sector lookup) ──
  if (req.user?.role === "coordinator") {
    if (!req.user.sectorId) {
      res.status(403).json({ error: "حسابك لم يُعيَّن له قطاع بعد", code: "NO_SECTOR_ASSIGNED" });
      return;
    }
    const [hc] = await db.select().from(healthCentersTable).where(eq(healthCentersTable.id, parsed.data.healthCenterId)).limit(1);
    if (!hc || String(hc.sectorId) !== String(req.user.sectorId)) {
      res.status(403).json({ error: "لا يمكنك تسجيل حالة في قطاع آخر", code: "SECTOR_FORBIDDEN" });
      return;
    }
  }

  const existing = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.nationalId, parsed.data.nationalId))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Patient with this national ID already exists" });
    return;
  }

  const [patient] = await db
    .insert(patientsTable)
    .values({
      nationalId: parsed.data.nationalId,
      nameAr: parsed.data.nameAr,
      nameEn: parsed.data.nameEn ?? null,
      dateOfBirth: parsed.data.dateOfBirth ?? null,
      phone: parsed.data.phone,
      address: parsed.data.address ?? null,
      healthCenterId: parsed.data.healthCenterId,
    })
    .returning();

  // Audit log
  logAudit({
    ...buildAuditParams(req),
    action: "CREATE",
    resourceType: "patient",
    resourceId: String(patient.id),
    newValue: patient,
  }).catch(() => {});

  const center = await db.select().from(healthCentersTable).where(eq(healthCentersTable.id, patient.healthCenterId)).limit(1);
  const sector = center[0] ? await db.select().from(sectorsTable).where(eq(sectorsTable.id, center[0].sectorId)).limit(1) : [];

  res.status(201).json({
    id: patient.id,
    nationalId: patient.nationalId,
    nameAr: patient.nameAr,
    nameEn: patient.nameEn ?? null,
    dateOfBirth: patient.dateOfBirth ?? null,
    age: null,
    phone: patient.phone,
    address: patient.address ?? null,
    healthCenterId: patient.healthCenterId,
    healthCenterNameAr: center[0]?.nameAr ?? null,
    sectorId: center[0]?.sectorId ?? 0,
    sectorNameAr: sector[0]?.nameAr ?? null,
    totalPregnancies: 0,
    createdAt: patient.createdAt.toISOString(),
  });
});

// GET /patients/by-nid/:nationalId
router.get("/patients/by-nid/:nationalId", async (req, res): Promise<void> => {
  const params = GetPatientByNidParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.nationalId, params.data.nationalId))
    .limit(1);

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const center = await db.select().from(healthCentersTable).where(eq(healthCentersTable.id, patient.healthCenterId)).limit(1);
  const sector = center[0] ? await db.select().from(sectorsTable).where(eq(sectorsTable.id, center[0].sectorId)).limit(1) : [];

  // ── Coordinator sector enforcement ──
  if (!isCoordinatorSectorMatch(req.user!.role, req.user!.sectorId, center[0]?.sectorId)) {
    res.status(403).json({ error: "لا يمكنك الوصول إلى بيانات قطاع آخر", code: "SECTOR_FORBIDDEN" });
    return;
  }

  const pregnancies = await db
    .select()
    .from(pregnanciesTable)
    .where(eq(pregnanciesTable.patientId, patient.id))
    .orderBy(pregnanciesTable.visitDate);

  const dob = patient.dateOfBirth ? new Date(patient.dateOfBirth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  res.json({
    patient: {
      id: patient.id,
      nationalId: patient.nationalId,
      nameAr: patient.nameAr,
      nameEn: patient.nameEn ?? null,
      dateOfBirth: patient.dateOfBirth ?? null,
      age,
      phone: patient.phone,
      address: patient.address ?? null,
      healthCenterId: patient.healthCenterId,
      healthCenterNameAr: center[0]?.nameAr ?? null,
      sectorId: center[0]?.sectorId ?? 0,
      sectorNameAr: sector[0]?.nameAr ?? null,
      totalPregnancies: pregnancies.length,
      createdAt: patient.createdAt.toISOString(),
    },
    pregnancies: pregnancies.map((p) => serializePregnancy(p, patient)),
  });
});

// GET /patients/:id
router.get("/patients/:id", async (req, res): Promise<void> => {
  const params = GetPatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, params.data.id))
    .limit(1);

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const [center] = await db.select().from(healthCentersTable).where(eq(healthCentersTable.id, patient.healthCenterId)).limit(1);
  const [sector] = center ? await db.select().from(sectorsTable).where(eq(sectorsTable.id, center.sectorId)).limit(1) : [undefined];

  if (!isCoordinatorSectorMatch(req.user!.role, req.user!.sectorId, center?.sectorId)) {
    res.status(403).json({ error: "لا يمكنك الوصول إلى بيانات قطاع آخر", code: "SECTOR_FORBIDDEN" });
    return;
  }

  const pregCount = await db.select({ count: count() }).from(pregnanciesTable).where(eq(pregnanciesTable.patientId, patient.id));

  const dob = patient.dateOfBirth ? new Date(patient.dateOfBirth) : null;
  const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  res.json({
    id: patient.id,
    nationalId: patient.nationalId,
    nameAr: patient.nameAr,
    nameEn: patient.nameEn ?? null,
    dateOfBirth: patient.dateOfBirth ?? null,
    age,
    phone: patient.phone,
    address: patient.address ?? null,
    healthCenterId: patient.healthCenterId,
    healthCenterNameAr: center?.nameAr ?? null,
    sectorId: center?.sectorId ?? 0,
    sectorNameAr: sector?.nameAr ?? null,
    totalPregnancies: pregCount[0]?.count ?? 0,
    createdAt: patient.createdAt.toISOString(),
  });
});

// PATCH /patients/:id — requires write access (not viewer)
router.patch("/patients/:id", requireWriteAccess, async (req, res): Promise<void> => {
  const params = UpdatePatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(patientsTable).where(eq(patientsTable.id, params.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const [existingCenter] = await db.select().from(healthCentersTable).where(eq(healthCentersTable.id, existing.healthCenterId)).limit(1);
  if (!isCoordinatorSectorMatch(req.user!.role, req.user!.sectorId, existingCenter?.sectorId)) {
    res.status(403).json({ error: "لا يمكنك تعديل بيانات قطاع آخر", code: "SECTOR_FORBIDDEN" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.nameAr != null) updateData.nameAr = parsed.data.nameAr;
  if (parsed.data.nameEn !== undefined) updateData.nameEn = parsed.data.nameEn;
  if (parsed.data.dateOfBirth !== undefined) updateData.dateOfBirth = parsed.data.dateOfBirth;
  if (parsed.data.phone != null) updateData.phone = parsed.data.phone;
  if (parsed.data.address !== undefined) updateData.address = parsed.data.address;
  if (parsed.data.healthCenterId != null) updateData.healthCenterId = parsed.data.healthCenterId;

  const [patient] = await db
    .update(patientsTable)
    .set(updateData)
    .where(eq(patientsTable.id, params.data.id))
    .returning();

  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  logAudit({
    ...buildAuditParams(req),
    action: "UPDATE",
    resourceType: "patient",
    resourceId: String(patient.id),
    oldValue: existing,
    newValue: patient,
  }).catch(() => {});

  const [center] = await db.select().from(healthCentersTable).where(eq(healthCentersTable.id, patient.healthCenterId)).limit(1);
  const [sector] = center ? await db.select().from(sectorsTable).where(eq(sectorsTable.id, center.sectorId)).limit(1) : [undefined];

  res.json({
    id: patient.id,
    nationalId: patient.nationalId,
    nameAr: patient.nameAr,
    nameEn: patient.nameEn ?? null,
    dateOfBirth: patient.dateOfBirth ?? null,
    age: null,
    phone: patient.phone,
    address: patient.address ?? null,
    healthCenterId: patient.healthCenterId,
    healthCenterNameAr: center?.nameAr ?? null,
    sectorId: center?.sectorId ?? 0,
    sectorNameAr: sector?.nameAr ?? null,
    totalPregnancies: null,
    createdAt: patient.createdAt.toISOString(),
  });
});

function serializePregnancy(p: typeof pregnanciesTable.$inferSelect, patient: typeof patientsTable.$inferSelect) {
  return {
    id: p.id,
    patientId: p.patientId,
    patientNameAr: patient.nameAr,
    patientNationalId: patient.nationalId,
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
    referredHospitalNameAr: null,
    appointmentDate: p.appointmentDate ?? null,
    compliance: p.compliance,
    workingDaysToAppointment: p.workingDaysToAppointment ?? null,
    notes: p.notes ?? null,
    coordinatorClassification: p.coordinatorClassification ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export default router;
