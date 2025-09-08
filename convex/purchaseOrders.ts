import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getCurrentVendorMembership, ensureCompanyAdmin } from "./util/rbac";

export const createPOForOrder = internalMutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "approved") {
      return;
    }

    // Find appropriate vendor (simplified - in real app, this would be more complex)
    const vendor = await ctx.db
      .query("vendors")
      .withIndex("by_company", (q) => q.eq("companyId", order.companyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!vendor) {
      return;
    }

    const poNumber = `PO-${Date.now()}`;

    const poItems = order.items.map(item => ({
      ...item,
      status: "pending" as const,
    }));

    const poId = await ctx.db.insert("purchaseOrders", {
      companyId: order.companyId,
      vendorId: vendor._id,
      orderIds: [args.orderId],
      poNumber,
      items: poItems,
      totalAmount: order.totalAmount,
      status: "sent",
      createdAt: Date.now(),
      sentAt: Date.now(),
    });

    // Update order status
    await ctx.db.patch(args.orderId, {
      status: "confirmed",
    });

    // Create notification for vendor
    const vendorUser = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), vendor.email))
      .first();

    if (vendorUser) {
      await ctx.db.insert("notifications", {
        userId: vendorUser._id,
        companyId: order.companyId,
        type: "po_created",
        title: "New Purchase Order",
        message: `Purchase Order ${poNumber} has been created.`,
        data: { poId },
        isRead: false,
        createdAt: Date.now(),
      });
    }
  },
});

export const getVendorPOs = query({
  args: {},
  handler: async (ctx) => {
    const vm = await getCurrentVendorMembership(ctx);
    if (!vm) return [];
    const vendor = await ctx.db.get(vm.vendorId);
    if (!vendor) return [];

    const pos = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_vendor", (q) => q.eq("vendorId", vendor._id))
      .order("desc")
      .collect();

    const posWithDetails = await Promise.all(
      pos.map(async (po) => {
        const company = await ctx.db.get(po.companyId);
        return {
          ...po,
          company,
          vendor,
        };
      })
    );

    return posWithDetails;
  },
});

export const updatePOItemStatus = mutation({
  args: {
    poId: v.id("purchaseOrders"),
    itemIndex: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("art_proof"),
      v.literal("approved"),
      v.literal("in_production"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.poId);
    if (!po) {
      throw new Error("Purchase order not found");
    }
    const vm = await getCurrentVendorMembership(ctx);
    if (!vm || String(vm.vendorId) !== String(po.vendorId)) throw new Error("Not authorized");

    const updatedItems = [...po.items];
    if (args.itemIndex >= 0 && args.itemIndex < updatedItems.length) {
      updatedItems[args.itemIndex].status = args.status;
    }

    await ctx.db.patch(args.poId, {
      items: updatedItems,
    });

    // Update overall PO status if all items are completed
    const allCompleted = updatedItems.every(item => item.status === "completed");
    if (allCompleted) {
      await ctx.db.patch(args.poId, {
        status: "completed",
      });
    }
  },
});

export const getCompanyPOs = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    await ensureCompanyAdmin(ctx, String(args.companyId));

    const pos = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .collect();

    const posWithDetails = await Promise.all(
      pos.map(async (po) => {
        const vendor = await ctx.db.get(po.vendorId);
        return {
          ...po,
          vendor,
        };
      })
    );

    return posWithDetails;
  },
});
