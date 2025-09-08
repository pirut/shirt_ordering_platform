import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ensureCompanyAdmin } from "./util/rbac";

export const getOrderReport = query({
  args: {
    companyId: v.id("companies"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    department: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    let ordersQuery = ctx.db
      .query("orders")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId));

    const orders = await ordersQuery.collect();

    // Filter by date range
    let filteredOrders = orders;
    if (args.startDate) {
      filteredOrders = filteredOrders.filter(order => order.orderDate >= args.startDate!);
    }
    if (args.endDate) {
      filteredOrders = filteredOrders.filter(order => order.orderDate <= args.endDate!);
    }
    if (args.status) {
      filteredOrders = filteredOrders.filter(order => order.status === args.status);
    }

    // Get user details and filter by department
    const ordersWithDetails = await Promise.all(
      filteredOrders.map(async (order) => {
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

    // Filter by department if specified
    const finalOrders = args.department 
      ? ordersWithDetails.filter(order => order.department === args.department)
      : ordersWithDetails;

    // Calculate summary statistics
    const totalOrders = finalOrders.length;
    const totalAmount = finalOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const averageOrderValue = totalOrders > 0 ? totalAmount / totalOrders : 0;

    const statusBreakdown = finalOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const departmentBreakdown = finalOrders.reduce((acc, order) => {
      const dept = order.department || "Unassigned";
      acc[dept] = (acc[dept] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      orders: finalOrders,
      summary: {
        totalOrders,
        totalAmount,
        averageOrderValue,
        statusBreakdown,
        departmentBreakdown,
      },
    };
  },
});

export const getVendorReport = query({
  args: {
    companyId: v.id("companies"),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    const pos = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    // Filter by date range
    let filteredPOs = pos;
    if (args.startDate) {
      filteredPOs = filteredPOs.filter(po => po.createdAt >= args.startDate!);
    }
    if (args.endDate) {
      filteredPOs = filteredPOs.filter(po => po.createdAt <= args.endDate!);
    }

    const posWithVendors = await Promise.all(
      filteredPOs.map(async (po) => {
        const vendor = await ctx.db.get(po.vendorId);
        return {
          ...po,
          vendor,
        };
      })
    );

    const vendorPerformance = posWithVendors.reduce((acc, po) => {
      const vendorName = po.vendor?.name || "Unknown";
      if (!acc[vendorName]) {
        acc[vendorName] = {
          totalPOs: 0,
          totalAmount: 0,
          completedPOs: 0,
          onTimePOs: 0,
        };
      }
      
      acc[vendorName].totalPOs += 1;
      acc[vendorName].totalAmount += po.totalAmount;
      
      if (po.status === "completed") {
        acc[vendorName].completedPOs += 1;
      }
      
      return acc;
    }, {} as Record<string, any>);

    return {
      purchaseOrders: posWithVendors,
      vendorPerformance,
    };
  },
});
