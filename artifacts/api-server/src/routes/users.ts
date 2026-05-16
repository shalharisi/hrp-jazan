import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

const CreateUserBody = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  role: z.enum(["admin", "coordinator", "doctor", "viewer"]),
  nameAr: z.string().min(1),
  nameEn: z.string().optional(),
  sectorId: z.string().optional(),
});

const UpdateUserBody = z.object({
  role: z.enum(["admin", "coordinator", "doctor", "viewer"]).optional(),
  nameAr: z.string().min(1).optional(),
  nameEn: z.string().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  sectorId: z.string().optional(),
});

// GET /api/users — admin only
router.get("/users", requireAuth, requireRole("admin"), async (_req, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    username: usersTable.username,
    role: usersTable.role,
    nameAr: usersTable.nameAr,
    nameEn: usersTable.nameEn,
    isActive: usersTable.isActive,
    lastLogin: usersTable.lastLogin,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);

  res.json(users.map(u => ({
    ...u,
    lastLogin: u.lastLogin?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  })));
});

// POST /api/users — admin only
router.post("/users", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const [user] = await db.insert(usersTable).values({
    username: parsed.data.username,
    passwordHash,
    role: parsed.data.role,
    nameAr: parsed.data.nameAr,
    nameEn: parsed.data.nameEn ?? null,
    sectorId: parsed.data.sectorId ?? null,
  }).returning();

  await logAudit({
    userId: req.user?.userId,
    username: req.user?.username,
    action: "CREATE",
    resourceType: "user",
    resourceId: String(user.id),
    newValue: { username: user.username, role: user.role },
  });

  res.status(201).json({
    id: user.id,
    username: user.username,
    role: user.role,
    nameAr: user.nameAr,
    nameEn: user.nameEn ?? null,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  });
});

// PATCH /api/users/:id — admin only
router.patch("/users/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params["id"] ?? ""));
  if (isNaN(id)) { res.status(400).json({ error: "معرف غير صحيح" }); return; }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.role != null) updateData["role"] = parsed.data.role;
  if (parsed.data.nameAr != null) updateData["nameAr"] = parsed.data.nameAr;
  if (parsed.data.nameEn !== undefined) updateData["nameEn"] = parsed.data.nameEn;
  if (parsed.data.isActive !== undefined) updateData["isActive"] = parsed.data.isActive;
  if (parsed.data.sectorId !== undefined) updateData["sectorId"] = parsed.data.sectorId;
  if (parsed.data.password) {
    updateData["passwordHash"] = await bcrypt.hash(parsed.data.password, 12);
  }

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }

  await logAudit({
    userId: req.user?.userId,
    username: req.user?.username,
    action: "UPDATE",
    resourceType: "user",
    resourceId: String(id),
    newValue: { role: user.role, isActive: user.isActive },
  });

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    nameAr: user.nameAr,
    nameEn: user.nameEn ?? null,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  });
});

export default router;
