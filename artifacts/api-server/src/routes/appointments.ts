import { Router, type IRouter } from "express";
import { db, appointmentsTable, hospitalsTable, pregnanciesTable, patientsTable, healthCentersTable, sectorsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  ListAppointmentsQueryParams,
  UpdateAppointmentParams,
  CreateAppointmentBody,
  UpdateAppointmentBody,
} from "@workspace/api-zod";
import { calculateCompliance } from "../lib/compliance";
import { requireWriteAccess } from "../lib/auth";
import { logAudit, buildAuditParams } from "../lib/audit";

const router: IRouter = Router();

function serializeAppointment(
  a: typeof appointmentsTable.$inferSelect,
  hospital: typeof hospitalsTable.$inferSelect | undefined,
  patient?: { nameAr: string; nationalId: string } | undefined,
  sector?: { id: number; nameAr: string } | undefined,
  riskLevel?: string | null,
) {
  return {
    id: a.id,
    pregnancyId: a.pregnancyId,
    hospitalId: a.hospitalId,
    hospitalNameAr: hospital?.nameAr ?? null,
    appointmentDate: a.appointmentDate,
    attended: a.attended ?? null,
    attendanceNote: a.attendanceNote ?? null,
    createdAt: a.createdAt.toISOString(),
    patientNameAr: patient?.nameAr ?? null,
    patientNationalId: patient?.nationalId ?? null,
    sectorId: sector?.id ?? null,
    sectorNameAr: sector?.nameAr ?? null,
    riskLevel: riskLevel ?? null,
  };
}

// ── Helper: resolve sector for a pregnancy (via patient → healthCenter) ───────
async function getPregnancySectorId(pregnancyId: number): Promise<number | null> {
  const [preg] = await db.select({ patientId: pregnanciesTable.patientId }).from(pregnanciesTable).where(eq(pregnanciesTable.id, pregnancyId)).limit(1);
  if (!preg) return null;
  const [patient] = await db.select({ healthCenterId: patientsTable.healthCenterId }).from(patientsTable).where(eq(patientsTable.id, preg.patientId)).limit(1);
  if (!patient) return null;
  const [hc] = await db.select({ sectorId: healthCentersTable.sectorId }).from(healthCentersTable).where(eq(healthCentersTable.id, patient.healthCenterId)).limit(1);
  return hc?.sectorId ?? null;
}

// GET /appointments
router.get("/appointments", async (req, res): Promise<void> => {
  const params = ListAppointmentsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { pregnancyId, hospitalId, attended } = params.data;
  const conditions = [];

  if (pregnancyId) conditions.push(eq(appointmentsTable.pregnancyId, pregnancyId));
  if (hospitalId) conditions.push(eq(appointmentsTable.hospitalId, hospitalId));
  if (attended !== undefined && attended !== null) conditions.push(eq(appointmentsTable.attended, attended));

  // ── Coordinator sector isolation on reads ──
  // Only return appointments whose pregnancy belongs to a patient in the coordinator's sector.
  if (req.user?.role === "coordinator") {
    if (!req.user.sectorId) {
      res.status(403).json({ error: "حسابك لم يُعيَّن له قطاع بعد", code: "NO_SECTOR_ASSIGNED" });
      return;
    }
    const sectorId = req.user.sectorId;
    conditions.push(
      sql`${appointmentsTable.pregnancyId} IN (
        SELECT pr.id FROM pregnancies pr
        JOIN patients pa ON pr.patient_id = pa.id
        JOIN health_centers hc ON pa.health_center_id = hc.id
        WHERE hc.sector_id = ${sectorId}
      )`
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const appointments = await db.select().from(appointmentsTable).where(whereClause).orderBy(appointmentsTable.appointmentDate);

  const hospitalIds = [...new Set(appointments.map((a) => a.hospitalId))];
  const hospitals = hospitalIds.length > 0
    ? await db.select().from(hospitalsTable).where(sql`${hospitalsTable.id} = ANY(ARRAY[${sql.join(hospitalIds.map(id => sql`${id}`), sql`, `)}]::integer[])`)
    : [];
  const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));

  // Enrich with patient, sector, and riskLevel info
  const pregnancyIds = [...new Set(appointments.map((a) => a.pregnancyId))];
  let patientMap = new Map<number, { nameAr: string; nationalId: string; sectorId: number | null; sectorNameAr: string | null; riskLevel: string | null }>();
  if (pregnancyIds.length > 0) {
    const rows = await db
      .select({
        pregnancyId: pregnanciesTable.id,
        patientNameAr: patientsTable.nameAr,
        patientNationalId: patientsTable.nationalId,
        sectorId: sectorsTable.id,
        sectorNameAr: sectorsTable.nameAr,
        riskLevel: pregnanciesTable.riskLevel,
      })
      .from(pregnanciesTable)
      .innerJoin(patientsTable, eq(pregnanciesTable.patientId, patientsTable.id))
      .leftJoin(healthCentersTable, eq(patientsTable.healthCenterId, healthCentersTable.id))
      .leftJoin(sectorsTable, eq(healthCentersTable.sectorId, sectorsTable.id))
      .where(sql`${pregnanciesTable.id} = ANY(ARRAY[${sql.join(pregnancyIds.map(id => sql`${id}`), sql`, `)}]::integer[])`);
    for (const row of rows) {
      patientMap.set(row.pregnancyId, {
        nameAr: row.patientNameAr,
        nationalId: row.patientNationalId,
        sectorId: row.sectorId ?? null,
        sectorNameAr: row.sectorNameAr ?? null,
        riskLevel: row.riskLevel ?? null,
      });
    }
  }

  res.json(appointments.map((a) => {
    const info = patientMap.get(a.pregnancyId);
    return serializeAppointment(
      a,
      hospitalMap.get(a.hospitalId),
      info ? { nameAr: info.nameAr, nationalId: info.nationalId } : undefined,
      info?.sectorId ? { id: info.sectorId, nameAr: info.sectorNameAr ?? "" } : undefined,
      info?.riskLevel ?? null,
    );
  }));
});

// POST /appointments — requires write access (not viewer)
router.post("/appointments", requireWriteAccess, async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // ── Coordinator sector enforcement (via pregnancyId → patient → sector) ──
  if (req.user?.role === "coordinator") {
    if (!req.user.sectorId) {
      res.status(403).json({ error: "حسابك لم يُعيَّن له قطاع بعد", code: "NO_SECTOR_ASSIGNED" });
      return;
    }
    const pregnancySectorId = await getPregnancySectorId(parsed.data.pregnancyId);
    if (pregnancySectorId === null || String(pregnancySectorId) !== String(req.user.sectorId)) {
      res.status(403).json({ error: "لا يمكنك إضافة موعد لحالة من قطاع آخر", code: "SECTOR_FORBIDDEN" });
      return;
    }
  }

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      pregnancyId: parsed.data.pregnancyId,
      hospitalId: parsed.data.hospitalId,
      appointmentDate: parsed.data.appointmentDate,
      attendanceNote: parsed.data.attendanceNote ?? null,
    })
    .returning();

  // Update pregnancy appointment date and recalculate compliance
  const [pregnancy] = await db.select().from(pregnanciesTable).where(eq(pregnanciesTable.id, parsed.data.pregnancyId)).limit(1);
  if (pregnancy) {
    const { compliance, workingDays } = calculateCompliance(pregnancy.visitDate, parsed.data.appointmentDate);
    await db
      .update(pregnanciesTable)
      .set({ appointmentDate: parsed.data.appointmentDate, compliance, workingDaysToAppointment: workingDays })
      .where(eq(pregnanciesTable.id, parsed.data.pregnancyId));
  }

  // Audit log
  logAudit({
    ...buildAuditParams(req),
    action: "CREATE",
    resourceType: "appointment",
    resourceId: String(appointment.id),
    newValue: appointment,
  }).catch(() => {});

  const [hospital] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, appointment.hospitalId)).limit(1);
  res.status(201).json(serializeAppointment(appointment, hospital));
});

// PATCH /appointments/:id — requires write access (not viewer)
router.patch("/appointments/:id", requireWriteAccess, async (req, res): Promise<void> => {
  const params = UpdateAppointmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Fetch current record for oldValue audit and sector check
  const [existing] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, params.data.id)).limit(1);
  if (!existing) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  // ── Coordinator sector enforcement ──
  if (req.user?.role === "coordinator") {
    if (!req.user.sectorId) {
      res.status(403).json({ error: "حسابك لم يُعيَّن له قطاع", code: "NO_SECTOR_ASSIGNED" });
      return;
    }
    const pregnancySectorId = await getPregnancySectorId(existing.pregnancyId);
    if (pregnancySectorId === null || String(pregnancySectorId) !== String(req.user.sectorId)) {
      res.status(403).json({ error: "لا يمكنك تعديل موعد من قطاع آخر", code: "SECTOR_FORBIDDEN" });
      return;
    }
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.appointmentDate != null) updateData.appointmentDate = parsed.data.appointmentDate;
  if (parsed.data.attended !== undefined) updateData.attended = parsed.data.attended;
  if (parsed.data.attendanceNote !== undefined) updateData.attendanceNote = parsed.data.attendanceNote;

  const [appointment] = await db
    .update(appointmentsTable)
    .set(updateData)
    .where(eq(appointmentsTable.id, params.data.id))
    .returning();

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  // If appointment date changed, recalculate compliance on pregnancy
  if (parsed.data.appointmentDate) {
    const [preg] = await db.select().from(pregnanciesTable).where(eq(pregnanciesTable.id, appointment.pregnancyId)).limit(1);
    if (preg) {
      const { compliance, workingDays } = calculateCompliance(preg.visitDate, parsed.data.appointmentDate);
      await db
        .update(pregnanciesTable)
        .set({ appointmentDate: parsed.data.appointmentDate, compliance, workingDaysToAppointment: workingDays })
        .where(eq(pregnanciesTable.id, appointment.pregnancyId));
    }
  }

  // Audit log
  logAudit({
    ...buildAuditParams(req),
    action: "UPDATE",
    resourceType: "appointment",
    resourceId: String(appointment.id),
    oldValue: existing,
    newValue: appointment,
  }).catch(() => {});

  const [hospital] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, appointment.hospitalId)).limit(1);
  res.json(serializeAppointment(appointment, hospital));
});

export default router;
