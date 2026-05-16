import { Router, type IRouter } from "express";
import { db, sectorsTable, hospitalsTable, healthCentersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListHealthCentersQueryParams } from "@workspace/api-zod";
import { requireRole } from "../lib/auth";
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

  const result = sectors.map((s) => {
    const hospital = hospitalMap.get(s.hospitalId);
    return {
      id: s.id,
      nameAr: s.nameAr,
      nameEn: s.nameEn,
      hospitalId: s.hospitalId,
      hospitalNameAr: hospital?.nameAr ?? null,
      hospitalNameEn: hospital?.nameEn ?? null,
      healthCenterCount: centerCountBySector.get(s.id) ?? 0,
    };
  });

  res.json(result);
});

// ─── GET /hospitals ────────────────────────────────────────────────────────────
router.get("/hospitals", async (_req, res): Promise<void> => {
  const hospitals = await db.select().from(hospitalsTable).orderBy(hospitalsTable.id);
  res.json(hospitals.map((h) => ({
    id: h.id,
    nameAr: h.nameAr,
    nameEn: h.nameEn,
    isKfch: h.isKfch,
    totalCases: null,
  })));
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

  const [hospital] = await db
    .insert(hospitalsTable)
    .values(parsed.data)
    .returning();

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
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateHospitalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [hospital] = await db
    .update(hospitalsTable)
    .set(parsed.data)
    .where(eq(hospitalsTable.id, id))
    .returning();

  if (!hospital) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ id: hospital.id, nameAr: hospital.nameAr, nameEn: hospital.nameEn, isKfch: hospital.isKfch, totalCases: null });
});

// ─── GET /health-centers ───────────────────────────────────────────────────────
router.get("/health-centers", async (req, res): Promise<void> => {
  const params = ListHealthCentersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db
    .select({
      id: healthCentersTable.id,
      nameAr: healthCentersTable.nameAr,
      nameEn: healthCentersTable.nameEn,
      sectorId: healthCentersTable.sectorId,
    })
    .from(healthCentersTable);

  const centers = params.data.sectorId
    ? await query.where(eq(healthCentersTable.sectorId, params.data.sectorId)).orderBy(healthCentersTable.nameAr)
    : await query.orderBy(healthCentersTable.nameAr);

  const sectors = await db.select().from(sectorsTable);
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));

  const result = centers.map((c) => ({
    id: c.id,
    nameAr: c.nameAr,
    nameEn: c.nameEn ?? null,
    sectorId: c.sectorId,
    sectorNameAr: sectorMap.get(c.sectorId)?.nameAr ?? null,
  }));

  res.json(result);
});

// ─── POST /health-centers (admin only) ────────────────────────────────────────
const CreateHealthCenterBody = z.object({
  nameAr: z.string().min(2, "اسم المركز باللعربية مطلوب"),
  nameEn: z.string().optional(),
  sectorId: z.number().int().positive("يرجى اختيار القطاع"),
});

router.post("/health-centers", requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateHealthCenterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify sector exists
  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, parsed.data.sectorId)).limit(1);
  if (!sector) {
    res.status(400).json({ error: "القطاع المحدد غير موجود" });
    return;
  }

  const [center] = await db
    .insert(healthCentersTable)
    .values(parsed.data)
    .returning();

  res.status(201).json({
    id: center!.id,
    nameAr: center!.nameAr,
    nameEn: center!.nameEn ?? null,
    sectorId: center!.sectorId,
    sectorNameAr: sector.nameAr,
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
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateHealthCenterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.nameAr) updateData["nameAr"] = parsed.data.nameAr;
  if (parsed.data.nameEn !== undefined) updateData["nameEn"] = parsed.data.nameEn;
  if (parsed.data.sectorId) updateData["sectorId"] = parsed.data.sectorId;

  const [center] = await db
    .update(healthCentersTable)
    .set(updateData)
    .where(eq(healthCentersTable.id, id))
    .returning();

  if (!center) { res.status(404).json({ error: "Not found" }); return; }

  const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, center.sectorId)).limit(1);

  res.json({
    id: center.id,
    nameAr: center.nameAr,
    nameEn: center.nameEn ?? null,
    sectorId: center.sectorId,
    sectorNameAr: sector?.nameAr ?? null,
  });
});

// ─── DELETE /hospitals/:id (admin only) ──────────────────────────────────────
router.delete("/hospitals/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Check no patients reference a health center in a sector using this hospital
  // (Hospital is linked via sectors, not directly to patients)
  const [hospital] = await db.select().from(hospitalsTable).where(eq(hospitalsTable.id, id)).limit(1);
  if (!hospital) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(hospitalsTable).where(eq(hospitalsTable.id, id));
  res.status(204).send();
});

// ─── DELETE /health-centers/:id (admin only) ─────────────────────────────────
router.delete("/health-centers/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  // Check no patients are registered at this health center
  const { patientsTable: pt } = await import("@workspace/db");
  const { count: countFn } = await import("drizzle-orm");
  const [usage] = await db.select({ n: countFn() }).from(pt).where(eq(pt.healthCenterId, id));
  if ((usage?.n ?? 0) > 0) {
    res.status(409).json({
      error: `لا يمكن حذف المركز لأن ${usage!.n} حالة مسجلة فيه. انقل الحالات أولاً.`,
      code: "CENTER_IN_USE",
    });
    return;
  }

  await db.delete(healthCentersTable).where(eq(healthCentersTable.id, id));
  res.status(204).send();
});

export default router;
