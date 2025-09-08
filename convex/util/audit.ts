import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "../_generated/server";

type AuditParams = {
  action: string;
  entityType: string;
  entityId: string;
  companyId?: string;
  oldValues?: unknown;
  newValues?: unknown;
};

export async function logAudit(
  ctx: MutationCtx,
  { action, entityType, entityId, companyId, oldValues, newValues }: AuditParams
) {
  const userId = await getAuthUserId(ctx);
  await ctx.db.insert("auditLogs", {
    userId: userId!,
    companyId: companyId as any,
    action,
    entityType,
    entityId,
    oldValues,
    newValues,
    timestamp: Date.now(),
  });
}

