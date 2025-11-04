import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logAudit } from "./util/audit";
import { ensureCompanyAdmin } from "./util/rbac";
import { internal } from "./_generated/api";

/**
 * Calculate the end date for a budget period based on the start date and period type
 */
function calculatePeriodEnd(periodStart: number, periodType: "monthly" | "quarterly" | "yearly"): number {
  const startDate = new Date(periodStart);
  const endDate = new Date(startDate);

  switch (periodType) {
    case "monthly":
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case "quarterly":
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case "yearly":
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
  }

  return endDate.getTime();
}

/**
 * Check if a date falls within a budget period
 */
function isDateInPeriod(date: number, periodStart: number, periodEnd: number): boolean {
  return date >= periodStart && date <= periodEnd;
}

/**
 * Create a new budget for a company
 */
export const createBudget = mutation({
  args: {
    companyId: v.id("companies"),
    periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
    periodStart: v.number(),
    amount: v.number(),
  },
  returns: v.id("budgets"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    // Validate amount
    if (args.amount <= 0) {
      throw new Error("Budget amount must be greater than 0");
    }

    // Validate period start
    const now = Date.now();
    if (args.periodStart < now - 86400000) { // Allow 1 day in the past for timezone issues
      throw new Error("Period start cannot be in the past");
    }

    // Calculate period end
    const periodEnd = calculatePeriodEnd(args.periodStart, args.periodType);

    // Check for overlapping active budgets of the same period type
    const existingBudgets = await ctx.db
      .query("budgets")
      .withIndex("by_company_and_period", (q) =>
        q.eq("companyId", args.companyId).eq("periodType", args.periodType)
      )
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    for (const budget of existingBudgets) {
      // Check if periods overlap
      const overlaps =
        isDateInPeriod(args.periodStart, budget.periodStart, budget.periodEnd) ||
        isDateInPeriod(periodEnd, budget.periodStart, budget.periodEnd) ||
        isDateInPeriod(budget.periodStart, args.periodStart, periodEnd) ||
        isDateInPeriod(budget.periodEnd, args.periodStart, periodEnd);

      if (overlaps) {
        throw new Error(
          `An active ${args.periodType} budget already exists for this period`
        );
      }
    }

    const budgetId = await ctx.db.insert("budgets", {
      companyId: args.companyId,
      periodType: args.periodType,
      periodStart: args.periodStart,
      periodEnd,
      amount: args.amount,
      spentAmount: 0,
      createdAt: Date.now(),
      isActive: true,
    });

    await logAudit(ctx, {
      action: "create_budget",
      entityType: "budget",
      entityId: String(budgetId),
      companyId: String(args.companyId),
      newValues: {
        periodType: args.periodType,
        amount: args.amount,
        periodStart: args.periodStart,
        periodEnd,
      },
    });

    return budgetId;
  },
});

/**
 * Update a budget's amount or period
 */
export const updateBudget = mutation({
  args: {
    budgetId: v.id("budgets"),
    amount: v.optional(v.number()),
    periodStart: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const budget = await ctx.db.get(args.budgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    await ensureCompanyAdmin(ctx, String(budget.companyId));

    const updates: {
      amount?: number;
      periodStart?: number;
      periodEnd?: number;
    } = {};

    if (args.amount !== undefined) {
      if (args.amount <= 0) {
        throw new Error("Budget amount must be greater than 0");
      }
      if (args.amount < budget.spentAmount) {
        throw new Error("Budget amount cannot be less than already spent amount");
      }
      updates.amount = args.amount;
    }

    if (args.periodStart !== undefined) {
      const periodEnd = calculatePeriodEnd(args.periodStart, budget.periodType);
      updates.periodStart = args.periodStart;
      updates.periodEnd = periodEnd;
    }

    if (Object.keys(updates).length === 0) {
      return null;
    }

    const oldValues = {
      amount: budget.amount,
      periodStart: budget.periodStart,
      periodEnd: budget.periodEnd,
    };

    await ctx.db.patch(args.budgetId, updates);

    await logAudit(ctx, {
      action: "update_budget",
      entityType: "budget",
      entityId: String(args.budgetId),
      companyId: String(budget.companyId),
      oldValues,
      newValues: updates,
    });

    return null;
  },
});

/**
 * Archive a budget (deactivate it)
 */
export const archiveBudget = mutation({
  args: {
    budgetId: v.id("budgets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const budget = await ctx.db.get(args.budgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    await ensureCompanyAdmin(ctx, String(budget.companyId));

    await ctx.db.patch(args.budgetId, {
      isActive: false,
    });

    await logAudit(ctx, {
      action: "archive_budget",
      entityType: "budget",
      entityId: String(args.budgetId),
      companyId: String(budget.companyId),
      oldValues: { isActive: true },
      newValues: { isActive: false },
    });

    return null;
  },
});

/**
 * Get all budgets for a company (active and historical)
 */
export const getCompanyBudgets = query({
  args: {
    companyId: v.id("companies"),
    includeInactive: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({
      _id: v.id("budgets"),
      _creationTime: v.number(),
      companyId: v.id("companies"),
      periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
      periodStart: v.number(),
      periodEnd: v.number(),
      amount: v.number(),
      spentAmount: v.number(),
      createdAt: v.number(),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is company admin or member
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) =>
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not authorized");
    }

    let budgetsQuery = ctx.db
      .query("budgets")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId));

    if (!args.includeInactive) {
      budgetsQuery = budgetsQuery.filter((q) => q.eq(q.field("isActive"), true));
    }

    const budgets = await budgetsQuery.order("desc").collect();

    return budgets;
  },
});

/**
 * Get the active budget for a company based on the current date and period type
 */
export const getActiveBudget = internalQuery({
  args: {
    companyId: v.id("companies"),
    periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
  },
  returns: v.union(
    v.object({
      _id: v.id("budgets"),
      _creationTime: v.number(),
      companyId: v.id("companies"),
      periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
      periodStart: v.number(),
      periodEnd: v.number(),
      amount: v.number(),
      spentAmount: v.number(),
      createdAt: v.number(),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) =>
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not authorized");
    }

    const now = Date.now();
    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_company_and_period", (q) =>
        q.eq("companyId", args.companyId).eq("periodType", args.periodType)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("isActive"), true),
          q.lte(q.field("periodStart"), now),
          q.gte(q.field("periodEnd"), now)
        )
      )
      .collect();

    // Return the first matching budget (should be only one due to overlap prevention)
    return budgets[0] || null;
  },
});

/**
 * Public query to get active budget (wrapper around internal query)
 */
export const getActiveBudgetPublic = query({
  args: {
    companyId: v.id("companies"),
    periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
  },
  returns: v.union(
    v.object({
      _id: v.id("budgets"),
      _creationTime: v.number(),
      companyId: v.id("companies"),
      periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
      periodStart: v.number(),
      periodEnd: v.number(),
      amount: v.number(),
      spentAmount: v.number(),
      createdAt: v.number(),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) =>
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not authorized");
    }

    return await ctx.runQuery(internal.budgets.getActiveBudget, args);
  },
});

/**
 * Calculate total spending from approved/confirmed orders for a budget
 */
export const calculateBudgetSpending = internalQuery({
  args: {
    budgetId: v.id("budgets"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const budget = await ctx.db.get(args.budgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    // Get all orders that:
    // 1. Belong to the company
    // 2. Use company budget as payment source
    // 3. Are approved or higher status
    // 4. Fall within the budget period
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_company", (q) => q.eq("companyId", budget.companyId))
      .filter((q) =>
        q.and(
          q.eq(q.field("paymentSource"), "company_budget"),
          q.or(
            q.eq(q.field("status"), "approved"),
            q.eq(q.field("status"), "confirmed"),
            q.eq(q.field("status"), "in_production"),
            q.eq(q.field("status"), "shipped"),
            q.eq(q.field("status"), "delivered")
          ),
          q.gte(q.field("orderDate"), budget.periodStart),
          q.lte(q.field("orderDate"), budget.periodEnd)
        )
      )
      .collect();

    const totalSpending = orders.reduce((sum, order) => sum + order.totalAmount, 0);

    return totalSpending;
  },
});

/**
 * Check if an order amount fits within the remaining budget
 */
export const checkBudgetAvailability = query({
  args: {
    companyId: v.id("companies"),
    periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
    orderAmount: v.number(),
  },
  returns: v.object({
    available: v.boolean(),
    budget: v.union(
      v.object({
        _id: v.id("budgets"),
        amount: v.number(),
        spentAmount: v.number(),
        remaining: v.number(),
      }),
      v.null()
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) =>
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not authorized");
    }

    const activeBudget = await ctx.runQuery(internal.budgets.getActiveBudget, {
      companyId: args.companyId,
      periodType: args.periodType,
    });

    if (!activeBudget) {
      return {
        available: false,
        budget: null,
      };
    }

    // Recalculate spending to ensure accuracy
    const actualSpending = await ctx.runQuery(internal.budgets.calculateBudgetSpending, {
      budgetId: activeBudget._id,
    });

    const remaining = activeBudget.amount - actualSpending;
    const available = remaining >= args.orderAmount;

    return {
      available,
      budget: {
        _id: activeBudget._id,
        amount: activeBudget.amount,
        spentAmount: actualSpending,
        remaining,
      },
    };
  },
});

/**
 * Get budget summary for dashboard
 */
export const getBudgetSummary = query({
  args: {
    companyId: v.id("companies"),
  },
  returns: v.object({
    monthly: v.union(
      v.object({
        _id: v.id("budgets"),
        amount: v.number(),
        spentAmount: v.number(),
        remaining: v.number(),
        periodStart: v.number(),
        periodEnd: v.number(),
      }),
      v.null()
    ),
    quarterly: v.union(
      v.object({
        _id: v.id("budgets"),
        amount: v.number(),
        spentAmount: v.number(),
        remaining: v.number(),
        periodStart: v.number(),
        periodEnd: v.number(),
      }),
      v.null()
    ),
    yearly: v.union(
      v.object({
        _id: v.id("budgets"),
        amount: v.number(),
        spentAmount: v.number(),
        remaining: v.number(),
        periodStart: v.number(),
        periodEnd: v.number(),
      }),
      v.null()
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) =>
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not authorized");
    }

    const [monthly, quarterly, yearly] = await Promise.all([
      ctx.runQuery(internal.budgets.getActiveBudget, {
        companyId: args.companyId,
        periodType: "monthly",
      }),
      ctx.runQuery(internal.budgets.getActiveBudget, {
        companyId: args.companyId,
        periodType: "quarterly",
      }),
      ctx.runQuery(internal.budgets.getActiveBudget, {
        companyId: args.companyId,
        periodType: "yearly",
      }),
    ]);

    const processBudget = async (budget: typeof monthly) => {
      if (!budget) return null;
      const actualSpending = await ctx.runQuery(internal.budgets.calculateBudgetSpending, {
        budgetId: budget._id,
      });
      return {
        _id: budget._id,
        amount: budget.amount,
        spentAmount: actualSpending,
        remaining: budget.amount - actualSpending,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
      };
    };

    return {
      monthly: await processBudget(monthly),
      quarterly: await processBudget(quarterly),
      yearly: await processBudget(yearly),
    };
  },
});

/**
 * Get budget history
 */
export const getBudgetHistory = query({
  args: {
    companyId: v.id("companies"),
    periodType: v.optional(v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly"))),
  },
  returns: v.array(
    v.object({
      _id: v.id("budgets"),
      _creationTime: v.number(),
      periodType: v.union(v.literal("quarterly"), v.literal("yearly"), v.literal("monthly")),
      periodStart: v.number(),
      periodEnd: v.number(),
      amount: v.number(),
      spentAmount: v.number(),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) =>
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not authorized");
    }

    let budgetsQuery = ctx.db
      .query("budgets")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId));

    if (args.periodType) {
      budgetsQuery = budgetsQuery.filter((q) => q.eq(q.field("periodType"), args.periodType!));
    }

    const budgets = await budgetsQuery.order("desc").collect();

    // Calculate actual spending for each budget
    const budgetsWithSpending = await Promise.all(
      budgets.map(async (budget) => {
        const actualSpending = await ctx.runQuery(internal.budgets.calculateBudgetSpending, {
          budgetId: budget._id,
        });
        return {
          ...budget,
          spentAmount: actualSpending,
        };
      })
    );

    return budgetsWithSpending;
  },
});

/**
 * Internal function to debit budget when order is approved
 */
export const debitBudget = internalMutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.paymentSource !== "company_budget") {
      return null; // Not a budget order
    }

    // Find the active budget for each period type that covers this order date
    const periodTypes: Array<"monthly" | "quarterly" | "yearly"> = ["monthly", "quarterly", "yearly"];
    
    for (const periodType of periodTypes) {
      const budgets = await ctx.db
        .query("budgets")
        .withIndex("by_company_and_period", (q) =>
          q.eq("companyId", order.companyId).eq("periodType", periodType)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("isActive"), true),
            q.lte(q.field("periodStart"), order.orderDate),
            q.gte(q.field("periodEnd"), order.orderDate)
          )
        )
        .collect();

      if (budgets.length > 0) {
        // Update all matching budgets (should typically be only one)
        for (const budget of budgets) {
          const actualSpending = await ctx.runQuery(internal.budgets.calculateBudgetSpending, {
            budgetId: budget._id,
          });
          
          await ctx.db.patch(budget._id, {
            spentAmount: actualSpending,
          });
        }
        break; // Only debit from one budget type (prefer monthly, then quarterly, then yearly)
      }
    }

    return null;
  },
});

/**
 * Internal function to refund budget when order is cancelled
 */
export const refundBudget = internalMutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.paymentSource !== "company_budget") {
      return null; // Not a budget order
    }

    // Recalculate spending for all budgets that might have included this order
    const periodTypes: Array<"monthly" | "quarterly" | "yearly"> = ["monthly", "quarterly", "yearly"];
    
    for (const periodType of periodTypes) {
      const budgets = await ctx.db
        .query("budgets")
        .withIndex("by_company_and_period", (q) =>
          q.eq("companyId", order.companyId).eq("periodType", periodType)
        )
        .filter((q) =>
          q.and(
            q.eq(q.field("isActive"), true),
            q.lte(q.field("periodStart"), order.orderDate),
            q.gte(q.field("periodEnd"), order.orderDate)
          )
        )
        .collect();

      if (budgets.length > 0) {
        // Recalculate spending for all matching budgets
        for (const budget of budgets) {
          const actualSpending = await ctx.runQuery(internal.budgets.calculateBudgetSpending, {
            budgetId: budget._id,
          });
          
          await ctx.db.patch(budget._id, {
            spentAmount: actualSpending,
          });
        }
        break;
      }
    }

    return null;
  },
});

