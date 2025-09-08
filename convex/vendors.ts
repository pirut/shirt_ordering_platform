import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logAudit } from "./util/audit";
import { ensureCompanyAdmin, getCurrentVendorMembership } from "./util/rbac";

export const createVendor = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    const vendorId = await ctx.db.insert("vendors", {
      companyId: args.companyId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      capabilities: [],
      isActive: true,
    });
    await logAudit(ctx, {
      action: "create_vendor",
      entityType: "vendor",
      entityId: String(vendorId),
      companyId: String(args.companyId),
      newValues: { name: args.name, email: args.email },
    });
    return vendorId;
  },
});

export const getCompanyVendors = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    return await ctx.db
      .query("vendors")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getVendorByEmail = query({
  args: {},
  handler: async (ctx) => {
    const vm = await getCurrentVendorMembership(ctx);
    if (!vm) return null;
    const vendor = await ctx.db.get(vm.vendorId);
    if (!vendor?.isActive) return null;
    return vendor;
  },
});

export const createInvoice = mutation({
  args: {
    poId: v.id("purchaseOrders"),
    amount: v.number(),
    dueDate: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const po = await ctx.db.get(args.poId);
    if (!po) {
      throw new Error("Purchase order not found");
    }

    await ensureCompanyAdmin(ctx, String(po.companyId));

    const invoiceNumber = `INV-${Date.now()}`;

    const invoiceId = await ctx.db.insert("invoices", {
      vendorId: po.vendorId,
      companyId: po.companyId,
      purchaseOrderId: args.poId,
      amount: args.amount,
      status: "draft",
      invoiceNumber,
      createdAt: Date.now(),
      dueDate: args.dueDate,
      notes: args.notes,
    });

    await logAudit(ctx, {
      action: "create_invoice",
      entityType: "invoice",
      entityId: String(invoiceId),
      companyId: String(po.companyId),
      newValues: { invoiceNumber, amount: args.amount, poId: String(args.poId) },
    });

    return invoiceId;
  },
});

export const getCompanyInvoices = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .collect();

    const invoicesWithVendors = await Promise.all(
      invoices.map(async (invoice) => {
        const vendor = await ctx.db.get(invoice.vendorId);
        return {
          ...invoice,
          vendor,
        };
      })
    );

    return invoicesWithVendors;
  },
});

export const getVendorInvoices = query({
  args: {
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    const vm = await getCurrentVendorMembership(ctx);
    if (!vm || String(vm.vendorId) !== String(args.vendorId)) {
      throw new Error("Not authorized");
    }

    return await ctx.db
      .query("invoices")
      .withIndex("by_vendor", (q) => q.eq("vendorId", args.vendorId))
      .order("desc")
      .collect();
  },
});

export const updateInvoiceStatus = mutation({
  args: {
    invoiceId: v.id("invoices"),
    status: v.union(v.literal("draft"), v.literal("sent"), v.literal("paid")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) {
      throw new Error("Invoice not found");
    }

    await ensureCompanyAdmin(ctx, String(invoice.companyId));

    const before = await ctx.db.get(args.invoiceId);
    await ctx.db.patch(args.invoiceId, {
      status: args.status,
    });

    await logAudit(ctx, {
      action: "update_invoice_status",
      entityType: "invoice",
      entityId: String(args.invoiceId),
      companyId: String(invoice.companyId),
      oldValues: { status: before?.status },
      newValues: { status: args.status },
    });
  },
});
