import { Router, type IRouter } from "express";
import { db, appointmentsTable, hospitalsTable, pregnanciesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  ListAppointmentsQueryParams,
  UpdateAppointmentParams,
  CreateAppointmentBody,
  UpdateAppointmentBody,
} from "@workspace/api-zod";
import { calculateCompliance } from "../lib/compliance";
import { requireWriteAccess, coordinatorSectorGuard } from "../lib/auth";

const router: IRouter = Router();

function serializeAppointment(
  a: typeof appointmentsTable.$inferSelect,
  hospital: typeof hospitalsTable.$inferSelect | undefined
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
  };
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

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const appointments = await db.select().from(appointmentsTable).where(whereClause).orderBy(appointmentsTable.appointmentDate);

  const hospitalIds = [...new Set(appointments.map((a) => a.hospitalId))];
  const hospitals = hospitalIds.length > 0
    ? await db.select().from(hospitalsTable).where(sql`${hospitalsTable.id} = ANY(ARRAY[${sql.join(hospitalIds.map(id => sql`${id}`), sql`, `)}]::integer[])`)
    : [];
  const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));

  res.json(appointments.map((a) => serializeAppointment(a, hospitalMap.get(a.hospitalId))));
});

// POST /appointments — requires write access (not viewer) + sector guard
router.post("/appointments", requireWriteAccess, coordinatorSectorGuard, async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
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
    const [pregnancy] = await db.select().from(pregnanciesTable).where(eq(pregnanciesTable.id, appointment.pregnancyId)).limit(1);
    if (pregnancy) {
      const { compliance, workingDays } = calculateCompliance(pregnancy.visitDate, parsed.data.appointmentDate);
      await db
        .update(pregnanciesTable)
        .set({ appointmentDate: parsed.data.appointmentDate, compliance, workingDaysToAppointment: workingDays })
        .where(eq(pregnanciesTable.id, appointment.pregnancyId));
    }
  }

  const [hospital] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, appointment.hospitalId)).limit(1);
  res.json(serializeAppointment(appointment, hospital));
});

export default router;
