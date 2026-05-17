import type { Request } from "express";
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
  } catch (err) {
    // Audit logging failures must never break the request, but must be visible.
    // eslint-disable-next-line no-console
    console.error("[audit] logAudit failed — record dropped:", {
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Extract common audit fields from a request.
 * Spread into logAudit() and add action/resourceType/resourceId/oldValue/newValue.
 *
 * Example:
 *   logAudit({ ...buildAuditParams(req), action: "CREATE", resourceType: "patient", ... })
 */
export function buildAuditParams(req: Request) {
  const ipAddress =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ?? req.socket?.remoteAddress;
  return {
    userId: req.user?.userId,
    username: req.user?.username,
    ipAddress,
    userAgent: req.headers["user-agent"],
  };
}
