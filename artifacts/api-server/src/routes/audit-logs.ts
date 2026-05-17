import { Router, type IRouter } from "express";
import { db, auditLogsTable } from "@workspace/db";
import { desc, eq, and, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { z } from "zod";

const router: IRouter = Router();

const AuditLogsQueryParams = z.object({
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/audit-logs — admin only, returns { items, total }
router.get("/audit-logs", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = AuditLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { userId, action, limit, offset } = parsed.data;

  const conditions = [];
  if (userId) conditions.push(eq(auditLogsTable.userId, userId));
  if (action) conditions.push(eq(auditLogsTable.action, action));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, logs] = await Promise.all([
    db.select({ count: count() }).from(auditLogsTable).where(whereClause),
    db
      .select()
      .from(auditLogsTable)
      .where(whereClause)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;

  res.json({
    items: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
  });
});

export default router;
