import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logAudit } from "./util/audit";
import { ensureCompanyAdmin, ensureCompanyMember } from "./util/rbac";

// Helper function to calculate period boundaries
function calculatePeriodBoundaries(
  periodType: "quarterly" | "yearly" | "monthly",
  startDate?: Date
): { periodStart: number; periodEnd: number } {
  const now = startDate || new Date();
  let periodStart: Date;
  let periodEnd: Date;

  if (periodType === "monthly") {
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (periodType === "quarterly") {
    const quarter = Math.floor(now.getMonth() / 3);
    periodStart = new Date(now.getFullYear(), quarter * 3, 1);
    periodEnd = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
  } else {
    // yearly
    periodStart = new Date(now.getFullYear(), 0, 1);
    periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  }

  return {
    periodStart: periodStart.getTime(),
    periodEnd: periodEnd.getTime(),
  };
}

export const createBudgetPeriod = mutation({
  args: {
    companyId: v.id("companies"),
    periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
    budgetAmount: v.number(),
    periodStart: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    // Calculate period boundaries
    const startDate = args.periodStart ? new Date(args.periodStart) : undefined;
    const { periodStart, periodEnd } = calculatePeriodBoundaries(args.periodType, startDate);

    // Check if a budget period already exists for this period
    const existingPeriod = await ctx.db
      .query("budgetPeriods")
      .withIndex("by_company_and_period", (q) =>
        q
          .eq("companyId", args.companyId)
          .eq("periodStart", periodStart)
          .eq("periodEnd", periodEnd)
      )
      .first();

    if (existingPeriod) {
      throw new Error("Budget period already exists for this time period");
    }

    // Create budget period
    const budgetPeriodId = await ctx.db.insert("budgetPeriods", {
      companyId: args.companyId,
      periodType: args.periodType,
      periodStart,
      periodEnd,
      budgetAmount: args.budgetAmount,
      createdAt: Date.now(),
      createdBy: userId,
    });

    // Create company budget record
    const companyBudgetId = await ctx.db.insert("companyBudgets", {
      companyId: args.companyId,
      budgetPeriodId,
      periodType: args.periodType,
      periodStart,
      periodEnd,
      totalBudget: args.budgetAmount,
      spentAmount: 0,
      status: "active",
      createdAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "create_budget_period",
      entityType: "budgetPeriod",
      entityId: String(budgetPeriodId),
      companyId: String(args.companyId),
      newValues: {
        periodType: args.periodType,
        budgetAmount: args.budgetAmount,
        periodStart,
        periodEnd,
      },
    });

    return { budgetPeriodId, companyBudgetId };
  },
});

export const updateBudgetPeriod = mutation({
  args: {
    budgetPeriodId: v.id("budgetPeriods"),
    budgetAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const budgetPeriod = await ctx.db.get(args.budgetPeriodId);
    if (!budgetPeriod) {
      throw new Error("Budget period not found");
    }

    await ensureCompanyAdmin(ctx, String(budgetPeriod.companyId));

    const oldBudgetAmount = budgetPeriod.budgetAmount;
    await ctx.db.patch(args.budgetPeriodId, {
      budgetAmount: args.budgetAmount,
    });

    // Update company budget
    const companyBudget = await ctx.db
      .query("companyBudgets")
      .withIndex("by_period", (q) => q.eq("budgetPeriodId", args.budgetPeriodId))
      .first();

    if (companyBudget) {
      await ctx.db.patch(companyBudget._id, {
        totalBudget: args.budgetAmount,
      });
    }

    await logAudit(ctx, {
      action: "update_budget_period",
      entityType: "budgetPeriod",
      entityId: String(args.budgetPeriodId),
      companyId: String(budgetPeriod.companyId),
      oldValues: { budgetAmount: oldBudgetAmount },
      newValues: { budgetAmount: args.budgetAmount },
    });
  },
});

export const allocateEmployeeBudget = mutation({
  args: {
    companyMemberId: v.id("companyMembers"),
    budgetPeriodId: v.id("budgetPeriods"),
    allocatedAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const member = await ctx.db.get(args.companyMemberId);
    if (!member) {
      throw new Error("Company member not found");
    }

    await ensureCompanyAdmin(ctx, String(member.companyId));

    const budgetPeriod = await ctx.db.get(args.budgetPeriodId);
    if (!budgetPeriod) {
      throw new Error("Budget period not found");
    }

    if (String(budgetPeriod.companyId) !== String(member.companyId)) {
      throw new Error("Budget period does not belong to this company");
    }

    // Get company budget for this period
    const companyBudget = await ctx.db
      .query("companyBudgets")
      .withIndex("by_period", (q) => q.eq("budgetPeriodId", args.budgetPeriodId))
      .first();

    if (!companyBudget) {
      throw new Error("Company budget not found for this period");
    }

    // Check if employee already has allocation for this period
    const existingAllocation = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_member_and_period", (q) =>
        q
          .eq("companyMemberId", args.companyMemberId)
          .eq("periodStart", budgetPeriod.periodStart)
          .eq("periodEnd", budgetPeriod.periodEnd)
      )
      .first();

    if (existingAllocation) {
      // Update existing allocation
      const oldAmount = existingAllocation.allocatedAmount;
      await ctx.db.patch(existingAllocation._id, {
        allocatedAmount: args.allocatedAmount,
      });

      await logAudit(ctx, {
        action: "update_employee_budget",
        entityType: "employeeBudget",
        entityId: String(existingAllocation._id),
        companyId: String(member.companyId),
        oldValues: { allocatedAmount: oldAmount },
        newValues: { allocatedAmount: args.allocatedAmount },
      });

      return existingAllocation._id;
    } else {
      // Create new allocation
      const employeeBudgetId = await ctx.db.insert("employeeBudgets", {
        companyMemberId: args.companyMemberId,
        budgetPeriodId: args.budgetPeriodId,
        companyBudgetId: companyBudget._id,
        allocatedAmount: args.allocatedAmount,
        spentAmount: 0,
        periodStart: budgetPeriod.periodStart,
        periodEnd: budgetPeriod.periodEnd,
        createdAt: Date.now(),
      });

      // Enable budget allocation for this member
      await ctx.db.patch(args.companyMemberId, {
        budgetAllocationEnabled: true,
      });

      await logAudit(ctx, {
        action: "allocate_employee_budget",
        entityType: "employeeBudget",
        entityId: String(employeeBudgetId),
        companyId: String(member.companyId),
        newValues: {
          companyMemberId: String(args.companyMemberId),
          allocatedAmount: args.allocatedAmount,
        },
      });

      return employeeBudgetId;
    }
  },
});

export const getCompanyBudgets = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    const budgets = await ctx.db
      .query("companyBudgets")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .order("desc")
      .collect();

    return budgets;
  },
});

export const getEmployeeBudget = query({
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

    const now = Date.now();

    // Get current active budget period for this employee
    const employeeBudget = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_member_and_period", (q) =>
        q
          .eq("companyMemberId", membership._id)
          .lte("periodStart", now)
          .gte("periodEnd", now)
      )
      .first();

    if (!employeeBudget) {
      return null;
    }

    const budgetPeriod = await ctx.db.get(employeeBudget.budgetPeriodId);
    const companyBudget = await ctx.db.get(employeeBudget.companyBudgetId);

    return {
      ...employeeBudget,
      budgetPeriod,
      companyBudget,
      remainingAmount: employeeBudget.allocatedAmount - employeeBudget.spentAmount,
    };
  },
});

export const checkBudgetAvailability = query({
  args: {
    companyId: v.id("companies"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyMember(ctx, String(args.companyId));

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) =>
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership || !membership.budgetAllocationEnabled) {
      return { available: false, reason: "Budget allocation not enabled for this employee" };
    }

    const now = Date.now();

    // Get current active budget
    const employeeBudget = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_member_and_period", (q) =>
        q
          .eq("companyMemberId", membership._id)
          .lte("periodStart", now)
          .gte("periodEnd", now)
      )
      .first();

    if (!employeeBudget) {
      return { available: false, reason: "No active budget period found" };
    }

    const remainingAmount = employeeBudget.allocatedAmount - employeeBudget.spentAmount;

    if (remainingAmount < args.amount) {
      return {
        available: false,
        reason: `Insufficient budget. Remaining: $${remainingAmount.toFixed(2)}, Required: $${args.amount.toFixed(2)}`,
        remainingAmount,
      };
    }

    return {
      available: true,
      remainingAmount,
      employeeBudgetId: employeeBudget._id,
    };
  },
});

export const deductBudget = mutation({
  args: {
    employeeBudgetId: v.id("employeeBudgets"),
    amount: v.number(),
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const employeeBudget = await ctx.db.get(args.employeeBudgetId);
    if (!employeeBudget) {
      throw new Error("Employee budget not found");
    }

    const member = await ctx.db.get(employeeBudget.companyMemberId);
    if (!member) {
      throw new Error("Company member not found");
    }

    // Verify the order belongs to this member
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (String(order.userId) !== String(member.userId)) {
      throw new Error("Order does not belong to this employee");
    }

    // Check availability
    const remainingAmount = employeeBudget.allocatedAmount - employeeBudget.spentAmount;
    if (remainingAmount < args.amount) {
      throw new Error(`Insufficient budget. Remaining: $${remainingAmount.toFixed(2)}`);
    }

    // Deduct from employee budget
    await ctx.db.patch(args.employeeBudgetId, {
      spentAmount: employeeBudget.spentAmount + args.amount,
    });

    // Deduct from company budget
    const companyBudget = await ctx.db.get(employeeBudget.companyBudgetId);
    if (companyBudget) {
      await ctx.db.patch(employeeBudget.companyBudgetId, {
        spentAmount: companyBudget.spentAmount + args.amount,
      });
    }

    await logAudit(ctx, {
      action: "deduct_budget",
      entityType: "employeeBudget",
      entityId: String(args.employeeBudgetId),
      companyId: String(member.companyId),
      newValues: {
        amount: args.amount,
        orderId: String(args.orderId),
        previousSpent: employeeBudget.spentAmount,
        newSpent: employeeBudget.spentAmount + args.amount,
      },
    });
  },
});

export const getBudgetStats = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    const now = Date.now();

    // Get current active budgets
    const activeBudgets = await ctx.db
      .query("companyBudgets")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "active"),
          q.lte(q.field("periodStart"), now),
          q.gte(q.field("periodEnd"), now)
        )
      )
      .collect();

    const totalBudget = activeBudgets.reduce((sum, b) => sum + b.totalBudget, 0);
    const totalSpent = activeBudgets.reduce((sum, b) => sum + b.spentAmount, 0);
    const remainingBudget = totalBudget - totalSpent;

    // Get employee budget allocations
    const allEmployeeBudgets = await ctx.db
      .query("employeeBudgets")
      .collect();
    
    const employeeBudgets = allEmployeeBudgets.filter((eb) =>
      activeBudgets.some((ab) => String(ab._id) === String(eb.companyBudgetId))
    );

    const totalAllocated = employeeBudgets.reduce(
      (sum, eb) => sum + eb.allocatedAmount,
      0
    );
    const totalEmployeeSpent = employeeBudgets.reduce(
      (sum, eb) => sum + eb.spentAmount,
      0
    );

    return {
      totalBudget,
      totalSpent,
      remainingBudget,
      utilizationPercentage: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0,
      totalAllocated,
      totalEmployeeSpent,
      activePeriodCount: activeBudgets.length,
      employeeCount: employeeBudgets.length,
    };
  },
});

