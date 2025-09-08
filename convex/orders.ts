import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logAudit } from "./util/audit";
import { ensureCompanyMember, ensureCompanyAdmin, ensureVendorForCompany } from "./util/rbac";

export const createOrderFromCart = mutation({
  args: {
    companyId: v.id("companies"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get cart items for this company
    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user_and_company", (q) => 
        q.eq("userId", userId).eq("companyId", args.companyId)
      )
      .collect();

    if (cartItems.length === 0) {
      throw new Error("Cart is empty");
    }

    await ensureCompanyMember(ctx, String(args.companyId));

    // Calculate total and prepare order items
    let totalAmount = 0;
    const orderItems = [];

    for (const cartItem of cartItems) {
      const shirtType = await ctx.db.get(cartItem.shirtTypeId);
      const variant = await ctx.db.get(cartItem.variantId);

      if (!shirtType || !variant) {
        throw new Error("Invalid cart item");
      }

      // Check if size is available
      if (!variant.availableSizes.includes(cartItem.size)) {
        throw new Error(`Size ${cartItem.size} not available for ${shirtType.name}`);
      }

      const unitPrice = shirtType.basePrice + variant.priceModifier;
      const itemTotalPrice = unitPrice * cartItem.quantity;
      totalAmount += itemTotalPrice;

      orderItems.push({
        shirtTypeId: cartItem.shirtTypeId,
        variantId: cartItem.variantId,
        size: cartItem.size,
        quantity: cartItem.quantity,
        unitPrice,
        totalPrice: itemTotalPrice,
        personalization: cartItem.personalization,
      });
    }

    const orderNumber = `ORD-${Date.now()}`;
    const status = "pending_approval";

    // Create the order
    const orderId = await ctx.db.insert("orders", {
      companyId: args.companyId,
      userId,
      orderNumber,
      items: orderItems,
      totalAmount,
      status,
      orderDate: Date.now(),
      notes: args.notes,
    });

    await logAudit(ctx, {
      action: "create_order",
      entityType: "order",
      entityId: String(orderId),
      companyId: String(args.companyId),
      newValues: { orderNumber, totalAmount, items: orderItems.length },
    });

    // Clear the cart
    for (const cartItem of cartItems) {
      await ctx.db.delete(cartItem._id);
    }

    return orderId;
  },
});

export const getUserOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return orders;
  },
});

export const getCompanyOrders = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(v.union(
      v.literal("pending_approval"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("confirmed"),
      v.literal("in_production"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin or vendor
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => q.eq("companyId", args.companyId).eq("userId", userId))
      .first();
    if (!membership) {
      await ensureVendorForCompany(ctx, String(args.companyId));
    }

    let ordersQuery = ctx.db
      .query("orders")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId));

    if (args.status) {
      ordersQuery = ctx.db
        .query("orders")
        .withIndex("by_company_and_status", (q) => 
          q.eq("companyId", args.companyId).eq("status", args.status!)
        );
    }

    const orders = await ordersQuery.order("desc").collect();

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const user = await ctx.db.get(order.userId);
        
        return {
          ...order,
          user,
        };
      })
    );

    return ordersWithDetails;
  },
});

export const getVendorOrders = query({
  args: {
    vendorId: v.id("vendors"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    // Check if current user is this vendor (by email)
    const user = await ctx.db.get(userId);
    if (!user || !user.email || user.email !== vendor.email) {
      throw new Error("Not authorized");
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_company", (q) => q.eq("companyId", vendor.companyId))
      .filter((q) => q.neq(q.field("status"), "pending_approval")) // Vendors only see confirmed+ orders
      .order("desc")
      .collect();

    return orders;
  },
});

export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending_approval"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("confirmed"),
      v.literal("in_production"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // Check if user is companyAdmin or a vendor for this company
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => q.eq("companyId", order.companyId).eq("userId", userId))
      .first();
    if (!membership) {
      await ensureVendorForCompany(ctx, String(order.companyId));
    }

    // Only company admins can cancel orders
    if (args.status === "cancelled" && (!membership || membership.role !== "companyAdmin")) {
      throw new Error("Not authorized to cancel orders");
    }

    const oldStatus = order.status;
    await ctx.db.patch(args.orderId, {
      status: args.status,
    });

    await logAudit(ctx, {
      action: "update_order_status",
      entityType: "order",
      entityId: String(args.orderId),
      companyId: String(order.companyId),
      oldValues: { status: oldStatus },
      newValues: { status: args.status },
    });
  },
});

export const bulkUpdateOrderStatus = mutation({
  args: {
    orderIds: v.array(v.id("orders")),
    status: v.union(
      v.literal("pending_approval"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("confirmed"),
      v.literal("in_production"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user has permission for all orders
    for (const orderId of args.orderIds) {
      const order = await ctx.db.get(orderId);
      if (!order) continue;

      const membership = await ctx.db
        .query("companyMembers")
        .withIndex("by_company_and_user", (q) => 
          q.eq("companyId", order.companyId).eq("userId", userId)
        )
        .first();

      if (!membership || membership.role !== "companyAdmin") {
        throw new Error("Not authorized for all selected orders");
      }
    }

    // Update all orders
    for (const orderId of args.orderIds) {
      await ctx.db.patch(orderId, {
        status: args.status,
      });
    }
  },
});

export const getUserOrderStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) {
      return null;
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect();

    const totalOrdered = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const remainingLimit = membership.orderLimit - totalOrdered;

    return {
      totalOrdered,
      orderLimit: membership.orderLimit,
      remainingLimit,
      orders: orders.length,
    };
  },
});
