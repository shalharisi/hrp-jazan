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

export function auditMiddleware(resourceType: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const method = req.method.toUpperCase();
    let action: string;

    if (method === "POST") action = "CREATE";
    else if (method === "PATCH" || method === "PUT") action = "UPDATE";
    else if (method === "DELETE") action = "DELETE";
    else {
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
      action,
      resourceType,
      resourceId: String(req.params["id"] ?? ""),
      ipAddress,
      userAgent,
      newValue: req.body,
    }).catch(() => {});

    next();
  };
}
