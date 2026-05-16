import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

// ---------------------------------------------------------------------------
// Secret management — never use in-code defaults for production
// ---------------------------------------------------------------------------

function resolveSecret(name: string): string {
  const val = process.env[name];
  if (val) return val;

  if (process.env["NODE_ENV"] === "production") {
    throw new Error(
      `Environment variable ${name} is required in production. ` +
      `Set it as a Replit secret in the Secrets tab.`
    );
  }

  // Development only: generate a random ephemeral secret with a loud warning.
  // Tokens will be invalidated on server restart. Set the env var to persist sessions.
  const ephemeral = crypto.randomBytes(64).toString("hex");
  logger.warn(
    { envVar: name },
    `${name} is not set. Using a random ephemeral secret — sessions will be lost on restart. ` +
    `Set ${name} as a Replit secret for persistent sessions.`
  );
  return ephemeral;
}

const JWT_SECRET = resolveSecret("JWT_SECRET");
const JWT_REFRESH_SECRET = resolveSecret("JWT_REFRESH_SECRET");
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "coordinator" | "doctor" | "viewer";

export interface JwtPayload {
  userId: number;
  username: string;
  role: UserRole;
  nameAr: string;
  sectorId?: string | null;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
}

// ---------------------------------------------------------------------------
// Express augmentation
// ---------------------------------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "غير مصرح – يرجى تسجيل الدخول", code: "UNAUTHORIZED" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "انتهت صلاحية الجلسة – يرجى تسجيل الدخول مجدداً", code: "TOKEN_EXPIRED" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "غير مصرح", code: "UNAUTHORIZED" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "ليس لديك صلاحية للوصول إلى هذا المورد", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}

/**
 * Block mutation methods (POST/PATCH/PUT/DELETE) for viewer role.
 * GET and HEAD requests pass through for all authenticated users.
 */
export function requireWriteAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "غير مصرح", code: "UNAUTHORIZED" });
    return;
  }
  const mutationMethods = ["POST", "PATCH", "PUT", "DELETE"];
  if (mutationMethods.includes(req.method.toUpperCase()) && req.user.role === "viewer") {
    res.status(403).json({ error: "صلاحية القراءة فقط – لا يمكنك إجراء تعديلات", code: "FORBIDDEN" });
    return;
  }
  next();
}

/**
 * Enforce sector-based data scoping for coordinator role.
 *
 * Rules:
 * - Coordinators MUST have a sectorId assigned. If not, access is denied.
 * - GET list requests: sectorId query param is overridden with user's sectorId.
 * - Mutations: body sectorId must match user's sectorId (or absent — caller injects it).
 *
 * Note: record-level (by-id) sector checks are done inline in individual route handlers
 * because they require a DB lookup to determine the record's sector.
 */
export function coordinatorSectorGuard(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "غير مصرح", code: "UNAUTHORIZED" });
    return;
  }

  // Only restrict coordinator role
  if (req.user.role !== "coordinator") {
    next();
    return;
  }

  const userSectorId = req.user.sectorId;

  // Coordinators without an assigned sector cannot access sector-scoped resources
  if (!userSectorId) {
    res.status(403).json({
      error: "حسابك لم يُعيَّن له قطاع بعد — يرجى التواصل مع مسؤول النظام",
      code: "NO_SECTOR_ASSIGNED",
    });
    return;
  }

  // For list GET requests: inject the coordinator's sectorId (override client value)
  if (req.method.toUpperCase() === "GET") {
    req.query["sectorId"] = String(userSectorId);
    next();
    return;
  }

  // For mutation requests: reject if body explicitly targets a different sector
  if (["POST", "PATCH", "PUT"].includes(req.method.toUpperCase())) {
    if (req.body && typeof req.body === "object") {
      if (req.body.sectorId && String(req.body.sectorId) !== String(userSectorId)) {
        res.status(403).json({ error: "لا يمكنك تعديل بيانات قطاع آخر", code: "SECTOR_FORBIDDEN" });
        return;
      }
    }
  }

  next();
}

/**
 * Verify that a patient's health center belongs to the coordinator's sector.
 * Used inline in GET /patients/:id and PATCH /patients/:id handlers.
 */
export function isCoordinatorSectorMatch(
  userRole: UserRole,
  userSectorId: string | null | undefined,
  patientSectorId: number | string | null | undefined
): boolean {
  if (userRole !== "coordinator") return true; // non-coordinators pass
  if (!userSectorId) return false; // coordinator without sector — deny
  return String(patientSectorId) === String(userSectorId);
}
