import type { Request, Response, NextFunction } from "express";
import { db, auditLogsTable } from "@workspace/db";

export async function logAudit(params: {
  userId?: number;
  username?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId ?? null,
      username: params.username ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
    });
  } catch {
    // Audit logging failures must not break the request
  }
}

/**
 * Lightweight audit middleware for POST routes (CREATE).
 * Records newValue from request body.
 *
 * For PATCH (UPDATE) routes with oldValue tracking, use logAudit() directly
 * inside the route handler after fetching the existing record, so you can
 * capture both oldValue and newValue accurately.
 */
export function auditMiddleware(resourceType: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();

    // Only auto-log POST (CREATE). PATCH/DELETE should log inline with old/new values.
    if (method !== "POST") {
      next();
      return;
    }

    const userId = req.user?.userId;
    const username = req.user?.username;
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ?? req.socket?.remoteAddress;
    const userAgent = req.headers["user-agent"];

    logAudit({
      userId,
      username,
      action: "CREATE",
      resourceType,
      resourceId: String(req.params["id"] ?? ""),
      ipAddress,
      userAgent,
      newValue: req.body,
    }).catch(() => {});

    next();
  };
}

/**
 * Build audit log params from a request for inline usage in route handlers.
 * Call after you have fetched both oldRecord and the updated result.
 */
export function buildAuditParams(
  req: Request,
  action: "UPDATE" | "DELETE" | "CREATE",
  resourceType: string,
  resourceId: string | number,
  oldValue: unknown,
  newValue: unknown
) {
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ?? req.socket?.remoteAddress;
  return {
    userId: req.user?.userId,
    username: req.user?.username,
    action,
    resourceType,
    resourceId: String(resourceId),
    ipAddress,
    userAgent: req.headers["user-agent"],
    oldValue,
    newValue,
  };
}
