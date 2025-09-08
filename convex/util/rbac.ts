import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

export async function ensureCompanyMember(
  ctx: QueryCtx | MutationCtx,
  companyId: string
) {
  const userId = await requireAuth(ctx);
  const membership = await ctx.db
    .query("companyMembers")
    .withIndex("by_company_and_user", (q) => q.eq("companyId", companyId as any).eq("userId", userId))
    .first();
  if (!membership) throw new Error("Not authorized");
  return { userId, membership };
}

export async function ensureCompanyAdmin(
  ctx: QueryCtx | MutationCtx,
  companyId: string
) {
  const { userId, membership } = await ensureCompanyMember(ctx, companyId);
  if (membership.role !== "companyAdmin") throw new Error("Not authorized");
  return { userId, membership };
}

export async function getCurrentVendorMembership(ctx: QueryCtx | MutationCtx) {
  const userId = await requireAuth(ctx);
  const vm = await ctx.db
    .query("vendorMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  return vm || null;
}

export async function ensureVendorForCompany(
  ctx: QueryCtx | MutationCtx,
  companyId: string
) {
  const vm = await getCurrentVendorMembership(ctx);
  if (!vm) throw new Error("Not authorized");
  const vendor = await ctx.db.get(vm.vendorId);
  if (!vendor || String(vendor.companyId) !== String(companyId)) throw new Error("Not authorized");
  return { vendorMember: vm, vendor };
}

