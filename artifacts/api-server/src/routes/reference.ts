import { Router, type IRouter } from "express";
import { db, sectorsTable, hospitalsTable, healthCentersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ListHealthCentersQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

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

export default router;
