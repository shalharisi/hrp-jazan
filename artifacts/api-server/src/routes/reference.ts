import { Router, type IRouter } from "express";
import { db, sectorsTable, hospitalsTable, healthCentersTable, patientsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { ListHealthCentersQueryParams } from "@workspace/api-zod";
import { requireRole } from "../lib/auth";
import { logAudit, buildAuditParams } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

// ─── GET /sectors ─────────────────────────────────────────────────────────────
router.get("/sectors", async (req, res): Promise<void> => {
  const sectors = await db
    .select({
      id: sectorsTable.id,
      nameAr: sectorsTable.nameAr,
      nameEn: sectorsTable.nameEn,
      hospitalId: sectorsTable.hospitalId,
    })
    .from(sectorsTable)
    .orderBy(sectorsTable.id);

  const hospitals = await db.select().from(hospitalsTable);
  const hospitalMap = new Map(hospitals.map((h) => [h.id, h]));

  const healthCenters = await db.select().from(healthCentersTable);
  const centerCountBySector = new Map<number, number>();
  for (const hc of healthCenters) {
    centerCountBySector.set(hc.sectorId, (centerCountBySector.get(hc.sectorId) ?? 0) + 1);
  }

  res.json(
    sectors.map((s) => ({
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn ?? null,
      hospitalId: s.hospitalId,
      hospitalNameAr: hospitalMap.get(s.hospitalId)?.nameAr ?? null,
      healthCenterCount: centerCountBySector.get(s.id) ?? 0,
    })),
  );
});

// ─── GET /hospitals ────────────────────────────────────────────────────────────
router.get("/hospitals", async (req, res): Promise<void> => {
  const hospitals = await db.select().from(hospitalsTable).orderBy(hospitalsTable.id);
  res.json(
    hospitals.map((h) => ({
      id: h.id,
      nameAr: h.nameAr,
      nameEn: h.nameEn,
      isKfch: h.isKfch,
      totalCases: null,
    })),
  );
});

// ─── POST /hospitals (admin only) ─────────────────────────────────────────────
const CreateHospitalBody = z.object({
  nameAr: z.string().min(2, "اسم المستشفى باللعربية مطلوب"),
  nameEn: z.string().min(2, "Hospital English name required"),
  isKfch: z.boolean().default(false),
});

router.post("/hospitals", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateHospitalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [hospital] = await db.insert(hospitalsTable).values(parsed.data).returning();

  logAudit({
    ...buildAuditParams(req),
    action: "CREATE",
    resourceType: "hospital",
    resourceId: String(hospital!.id),
    newValue: hospital,
  }).catch(() => {});

  res.status(201).json({
    id: hospital!.id,
    nameAr: hospital!.nameAr,
    nameEn: hospital!.nameEn,
    isKfch: hospital!.isKfch,
    totalCases: null,
  });
});

// ─── PATCH /hospitals/:id (admin only) ────────────────────────────────────────
const UpdateHospitalBody = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().min(2).optional(),
  isKfch: z.boolean().optional(),
});

router.patch("/hospitals/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateHospitalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Fetch current for audit oldValue
  const [existing] = await db
    .select()
    .from(hospitalsTable)
    .where(eq(hospitalsTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [hospital] = await db
    .update(hospitalsTable)
    .set(parsed.data)
    .where(eq(hospitalsTable.id, id))
    .returning();

  if (!hospital) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  logAudit({
    ...buildAuditParams(req),
    action: "UPDATE",
    resourceType: "hospital",
    resourceId: String(hospital.id),
    oldValue: existing,
    newValue: hospital,
  }).catch(() => {});

  res.json({
    id: hospital.id,
    nameAr: hospital.nameAr,
    nameEn: hospital.nameEn,
    isKfch: hospital.isKfch,
    totalCases: null,
  });
});

// ─── DELETE /hospitals/:id (admin only) ──────────────────────────────────────
router.delete("/hospitals/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [hospital] = await db
    .select()
    .from(hospitalsTable)
    .where(eq(hospitalsTable.id, id))
    .limit(1);
  if (!hospital) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(hospitalsTable).where(eq(hospitalsTable.id, id));

  logAudit({
    ...buildAuditParams(req),
    action: "DELETE",
    resourceType: "hospital",
    resourceId: String(id),
    oldValue: hospital,
  }).catch(() => {});

  res.status(204).send();
});

// ─── GET /health-centers ───────────────────────────────────────────────────────
router.get("/health-centers", async (req, res): Promise<void> => {
  const params = ListHealthCentersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { sectorId } = params.data;

  let centers;
  if (sectorId) {
    centers = await db
      .select()
      .from(healthCentersTable)
      .where(eq(healthCentersTable.sectorId, sectorId))
      .orderBy(healthCentersTable.nameAr);
  } else {
    centers = await db.select().from(healthCentersTable).orderBy(healthCentersTable.nameAr);
  }

  const sectors = await db.select().from(sectorsTable);
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));

  res.json(
    centers.map((c) => ({
      id: c.id,
      nameAr: c.nameAr,
      nameEn: c.nameEn ?? null,
      sectorId: c.sectorId,
      sectorNameAr: sectorMap.get(c.sectorId)?.nameAr ?? null,
    })),
  );
});

// ─── POST /health-centers (admin only) ────────────────────────────────────────
const CreateHealthCenterBody = z.object({
  nameAr: z.string().min(2, "الاسم بالعربية مطلوب"),
  nameEn: z.string().optional(),
  sectorId: z.number().int().positive(),
});

router.post("/health-centers", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateHealthCenterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [center] = await db
    .insert(healthCentersTable)
    .values({
      nameAr: parsed.data.nameAr,
      nameEn: parsed.data.nameEn ?? null,
      sectorId: parsed.data.sectorId,
    })
    .returning();

  logAudit({
    ...buildAuditParams(req),
    action: "CREATE",
    resourceType: "health_center",
    resourceId: String(center!.id),
    newValue: center,
  }).catch(() => {});

  const [sector] = await db
    .select()
    .from(sectorsTable)
    .where(eq(sectorsTable.id, center!.sectorId))
    .limit(1);

  res.status(201).json({
    id: center!.id,
    nameAr: center!.nameAr,
    nameEn: center!.nameEn ?? null,
    sectorId: center!.sectorId,
    sectorNameAr: sector?.nameAr ?? null,
  });
});

// ─── PATCH /health-centers/:id (admin only) ───────────────────────────────────
const UpdateHealthCenterBody = z.object({
  nameAr: z.string().min(2).optional(),
  nameEn: z.string().optional(),
  sectorId: z.number().int().positive().optional(),
});

router.patch("/health-centers/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateHealthCenterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Fetch current for audit oldValue
  const [existing] = await db
    .select()
    .from(healthCentersTable)
    .where(eq(healthCentersTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.nameAr) updateData["nameAr"] = parsed.data.nameAr;
  if (parsed.data.nameEn !== undefined) updateData["nameEn"] = parsed.data.nameEn;
  if (parsed.data.sectorId) updateData["sectorId"] = parsed.data.sectorId;

  const [center] = await db
    .update(healthCentersTable)
    .set(updateData)
    .where(eq(healthCentersTable.id, id))
    .returning();

  if (!center) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  logAudit({
    ...buildAuditParams(req),
    action: "UPDATE",
    resourceType: "health_center",
    resourceId: String(center.id),
    oldValue: existing,
    newValue: center,
  }).catch(() => {});

  const [sector] = await db
    .select()
    .from(sectorsTable)
    .where(eq(sectorsTable.id, center.sectorId))
    .limit(1);

  res.json({
    id: center.id,
    nameAr: center.nameAr,
    nameEn: center.nameEn ?? null,
    sectorId: center.sectorId,
    sectorNameAr: sector?.nameAr ?? null,
  });
});

// ─── DELETE /health-centers/:id (admin only) ─────────────────────────────────
router.delete("/health-centers/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  // Check no patients are registered at this health center
  const [usage] = await db
    .select({ n: count() })
    .from(patientsTable)
    .where(eq(patientsTable.healthCenterId, id));
  if ((usage?.n ?? 0) > 0) {
    res.status(409).json({
      error: `لا يمكن حذف المركز لأن ${usage!.n} حالة مسجلة فيه. انقل الحالات أولاً.`,
      code: "CENTER_IN_USE",
    });
    return;
  }

  const [existing] = await db
    .select()
    .from(healthCentersTable)
    .where(eq(healthCentersTable.id, id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  await db.delete(healthCentersTable).where(eq(healthCentersTable.id, id));

  logAudit({
    ...buildAuditParams(req),
    action: "DELETE",
    resourceType: "health_center",
    resourceId: String(id),
    oldValue: existing,
  }).catch(() => {});

  res.status(204).send();
});

export default router;
