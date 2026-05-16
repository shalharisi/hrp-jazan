import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "hrp-jazan-2026-secret-key-change-in-production";
const JWT_REFRESH_SECRET = process.env["JWT_REFRESH_SECRET"] ?? "hrp-jazan-2026-refresh-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export type UserRole = "admin" | "coordinator" | "doctor" | "viewer";

export interface JwtPayload {
  userId: number;
  username: string;
  role: UserRole;
  nameAr: string;
}

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

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

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

export function requireWriteAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "غير مصرح", code: "UNAUTHORIZED" });
    return;
  }
  if (req.user.role === "viewer") {
    res.status(403).json({ error: "صلاحية القراءة فقط – لا يمكنك إجراء تعديلات", code: "FORBIDDEN" });
    return;
  }
  next();
}
