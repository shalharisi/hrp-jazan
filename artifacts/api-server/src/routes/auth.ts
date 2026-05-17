import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  requireAuth,
  type JwtPayload,
} from "../lib/auth";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router: IRouter = Router();

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Build a JWT payload from a DB user record.
 * sectorId is included so coordinator sector enforcement works server-side.
 */
function buildPayload(user: typeof usersTable.$inferSelect): JwtPayload {
  return {
    userId: user.id,
    username: user.username,
    role: user.role as JwtPayload["role"],
    nameAr: user.nameAr,
    sectorId: user.sectorId ?? null,
  };
}

// POST /api/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "بيانات غير صحيحة" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await logAudit({
      username,
      action: "LOGIN_FAILED",
      resourceType: "auth",
      ipAddress:
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    return;
  }

  const payload = buildPayload(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  // Update last login
  await db.update(usersTable).set({ lastLogin: new Date() }).where(eq(usersTable.id, user.id));

  await logAudit({
    userId: user.id,
    username: user.username,
    action: "LOGIN",
    resourceType: "auth",
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  // Set refresh token as httpOnly cookie
  res.cookie("hrp_refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      nameAr: user.nameAr,
      nameEn: user.nameEn ?? null,
      consentGivenAt: user.consentGivenAt?.toISOString() ?? null,
    },
  });
});

// POST /api/auth/logout — public endpoint; must clear cookie even with expired/missing token.
// requireAuth is intentionally omitted so logout always works.
router.post("/auth/logout", async (req, res): Promise<void> => {
  // Audit if we can identify the user (best-effort, not required)
  const bearerUser = req.user; // may be undefined since no requireAuth
  if (bearerUser) {
    await logAudit({
      userId: bearerUser.userId,
      username: bearerUser.username,
      action: "LOGOUT",
      resourceType: "auth",
      ipAddress:
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket?.remoteAddress,
    });
  }

  res.clearCookie("hrp_refresh_token", { httpOnly: true, sameSite: "strict" });
  res.json({ success: true });
});

// POST /api/auth/refresh
router.post("/auth/refresh", async (req, res): Promise<void> => {
  const token = req.cookies?.["hrp_refresh_token"];
  if (!token) {
    res.status(401).json({ error: "لا يوجد رمز تحديث", code: "NO_REFRESH_TOKEN" });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);
    // Re-fetch user from DB to get latest role + sectorId
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive) {
      res.status(401).json({ error: "الحساب غير نشط", code: "ACCOUNT_INACTIVE" });
      return;
    }

    const newPayload = buildPayload(user);
    const accessToken = generateAccessToken(newPayload);
    res.json({ accessToken });
  } catch {
    res.clearCookie("hrp_refresh_token");
    res.status(401).json({ error: "انتهت صلاحية الجلسة", code: "REFRESH_EXPIRED" });
  }
});

// GET /api/auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "المستخدم غير موجود" });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    nameAr: user.nameAr,
    nameEn: user.nameEn ?? null,
    isActive: user.isActive,
    lastLogin: user.lastLogin?.toISOString() ?? null,
    consentGivenAt: user.consentGivenAt?.toISOString() ?? null,
  });
});

// POST /api/auth/change-password — public endpoint (verifies current password)
const ChangePasswordBody = z.object({
  username: z.string().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"),
});

router.post("/auth/change-password", async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.errors[0]?.message ?? "بيانات غير صحيحة";
    res.status(400).json({ error: msg });
    return;
  }

  const { username, currentPassword, newPassword } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور الحالية غير صحيحة" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    await logAudit({
      userId: user.id,
      username: user.username,
      action: "CHANGE_PASSWORD_FAILED",
      resourceType: "auth",
      ipAddress:
        (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور الحالية غير صحيحة" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));

  await logAudit({
    userId: user.id,
    username: user.username,
    action: "CHANGE_PASSWORD",
    resourceType: "auth",
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.socket?.remoteAddress,
    userAgent: req.headers["user-agent"],
  });

  res.json({ success: true });
});

// POST /api/auth/consent
router.post("/auth/consent", requireAuth, async (req, res): Promise<void> => {
  await db
    .update(usersTable)
    .set({ consentGivenAt: new Date() })
    .where(eq(usersTable.id, req.user!.userId));
  res.json({ success: true, consentGivenAt: new Date().toISOString() });
});

export default router;
