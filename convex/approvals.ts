import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal, api } from "./_generated/api";
import { ensureCompanyAdmin } from "./util/rbac";
import { logAudit } from "./util/audit";

export const getPendingApprovals = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_company_and_status", (q) => 
        q.eq("companyId", args.companyId).eq("status", "pending_approval")
      )
      .order("desc")
      .collect();

    const ordersWithDetails = await Promise.all(
      orders.map(async (order) => {
        const user = await ctx.db.get(order.userId);
        const member = await ctx.db
          .query("companyMembers")
          .withIndex("by_company_and_user", (q) => 
            q.eq("companyId", args.companyId).eq("userId", order.userId)
          )
          .first();
        
        return {
          ...order,
          user,
          department: member?.department,
        };
      })
    );

    return ordersWithDetails;
  },
});

export const approveOrder = mutation({
  args: {
    orderId: v.id("orders"),
    notes: v.optional(v.string()),
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

    await ensureCompanyAdmin(ctx, String(order.companyId));

    await ctx.db.patch(args.orderId, {
      status: "approved",
      approvalStatus: "approved",
      approvedBy: userId,
      approvedAt: Date.now(),
      notes: args.notes,
    });

    // Deduct from budget if using company budget
    if (order.paymentType === "company_budget" && order.budgetPeriodId) {
      // Get employee budget for this period
      const membership = await ctx.db
        .query("companyMembers")
        .withIndex("by_company_and_user", (q) =>
          q.eq("companyId", order.companyId).eq("userId", order.userId)
        )
        .first();

      if (membership) {
        const budgetPeriod = await ctx.db.get(order.budgetPeriodId);
        if (budgetPeriod) {
          const employeeBudget = await ctx.db
            .query("employeeBudgets")
            .withIndex("by_member_and_period", (q) =>
              q
                .eq("companyMemberId", membership._id)
                .eq("periodStart", budgetPeriod.periodStart)
                .eq("periodEnd", budgetPeriod.periodEnd)
            )
            .first();

          if (employeeBudget) {
            await ctx.runMutation(api.budgets.deductBudget, {
              employeeBudgetId: employeeBudget._id,
              amount: order.totalAmount,
              orderId: args.orderId,
            });
          }
        }
      }
    }

    // Create notification for employee
    await ctx.db.insert("notifications", {
      userId: order.userId,
      companyId: order.companyId,
      type: "order_approved",
      title: "Order Approved",
      message: `Your order #${order.orderNumber} has been approved.`,
      data: { orderId: args.orderId },
      isRead: false,
      createdAt: Date.now(),
    });

    // Log audit trail
    await ctx.db.insert("auditLogs", {
      userId,
      companyId: order.companyId,
      action: "approve_order",
      entityType: "order",
      entityId: args.orderId,
      newValues: { status: "approved", approvedBy: userId },
      timestamp: Date.now(),
    });

    // Schedule PO creation
    await ctx.scheduler.runAfter(0, internal.purchaseOrders.createPOForOrder, {
      orderId: args.orderId,
    });
  },
});

export const rejectOrder = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.string(),
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

    await ensureCompanyAdmin(ctx, String(order.companyId));

    await ctx.db.patch(args.orderId, {
      status: "rejected",
      approvalStatus: "rejected",
      approvedBy: userId,
      approvedAt: Date.now(),
      rejectionReason: args.reason,
    });

    // Create notification for employee
    await ctx.db.insert("notifications", {
      userId: order.userId,
      companyId: order.companyId,
      type: "order_rejected",
      title: "Order Rejected",
      message: `Your order #${order.orderNumber} has been rejected: ${args.reason}`,
      data: { orderId: args.orderId },
      isRead: false,
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "reject_order",
      entityType: "order",
      entityId: String(args.orderId),
      companyId: String(order.companyId),
      newValues: { status: "rejected", rejectionReason: args.reason },
    });
  },
});

export const bulkApproveOrders = mutation({
  args: {
    orderIds: v.array(v.id("orders")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    for (const orderId of args.orderIds) {
      const order = await ctx.db.get(orderId);
      if (!order) continue;

      // Check authorization for each order
      try {
        await ensureCompanyAdmin(ctx, String(order.companyId));
      } catch {
        continue;
      }

      await ctx.db.patch(orderId, {
        status: "approved",
        approvalStatus: "approved",
        approvedBy: userId,
        approvedAt: Date.now(),
        notes: args.notes,
      });

      // Create notification
      await ctx.db.insert("notifications", {
        userId: order.userId,
        companyId: order.companyId,
        type: "order_approved",
        title: "Order Approved",
        message: `Your order #${order.orderNumber} has been approved.`,
        data: { orderId },
        isRead: false,
        createdAt: Date.now(),
      });

      // Schedule PO creation
      await ctx.scheduler.runAfter(0, internal.purchaseOrders.createPOForOrder, {
        orderId,
      });

      await logAudit(ctx, {
        action: "approve_order",
        entityType: "order",
        entityId: String(orderId),
        companyId: String(order.companyId),
        newValues: { status: "approved", bulk: true },
      });
    }
  },
});
