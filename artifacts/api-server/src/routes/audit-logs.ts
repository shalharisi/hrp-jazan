import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router: IRouter = Router();

// GET /api/audit-logs — admin only
router.get("/audit-logs", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query["limit"] ?? "100"));
  const offset = parseInt(String(req.query["offset"] ?? "0"));

  const logs = await db.select().from(auditLogsTable)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(logs.map(l => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  })));
});

export default router;
