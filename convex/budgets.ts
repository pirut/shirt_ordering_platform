import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logAudit } from "./util/audit";
import { ensureCompanyAdmin, ensureCompanyMember } from "./util/rbac";
import { Id } from "./_generated/dataModel";

// Helper function to calculate period dates
function calculatePeriodDates(periodType: "monthly" | "quarterly" | "yearly", startDate?: number) {
  const now = startDate || Date.now();
  const date = new Date(now);
  let periodStart: number;
  let periodEnd: number;

  if (periodType === "monthly") {
    periodStart = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  } else if (periodType === "quarterly") {
    const quarter = Math.floor(date.getMonth() / 3);
    periodStart = new Date(date.getFullYear(), quarter * 3, 1).getTime();
    periodEnd = new Date(date.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999).getTime();
  } else {
    // yearly
    periodStart = new Date(date.getFullYear(), 0, 1).getTime();
    periodEnd = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
  }

  return { periodStart, periodEnd };
}

// Create a new company budget
export const createCompanyBudget = mutation({
  args: {
    companyId: v.id("companies"),
    periodType: v.union(v.literal("monthly"), v.literal("quarterly"), v.literal("yearly")),
    totalBudget: v.number(),
    periodStart: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    // Check for overlapping active budgets
    const { periodStart, periodEnd } = calculatePeriodDates(args.periodType, args.periodStart);
    
    const existingBudgets = await ctx.db
      .query("companyBudgets")
      .withIndex("by_company_and_status", (q) => 
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect();

    // Check for overlapping periods
    for (const budget of existingBudgets) {
      if (
        (periodStart >= budget.periodStart && periodStart <= budget.periodEnd) ||
        (periodEnd >= budget.periodStart && periodEnd <= budget.periodEnd) ||
        (periodStart <= budget.periodStart && periodEnd >= budget.periodEnd)
      ) {
        throw new Error("A budget already exists for this period");
      }
    }

    const budgetId = await ctx.db.insert("companyBudgets", {
      companyId: args.companyId,
      periodType: args.periodType,
      periodStart,
      periodEnd,
      totalBudget: args.totalBudget,
      allocatedBudget: 0,
      spentBudget: 0,
      remainingBudget: args.totalBudget,
      status: "active",
      createdAt: Date.now(),
      createdBy: userId,
      notes: args.notes,
    });

    await logAudit(ctx, {
      action: "create_budget",
      entityType: "companyBudget",
      entityId: String(budgetId),
      companyId: String(args.companyId),
      newValues: { periodType: args.periodType, totalBudget: args.totalBudget, periodStart, periodEnd },
    });

    return budgetId;
  },
});

// Get all budgets for a company
export const getCompanyBudgets = query({
  args: {
    companyId: v.id("companies"),
    status: v.optional(v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyMember(ctx, String(args.companyId));

    let query = ctx.db
      .query("companyBudgets")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId));

    if (args.status) {
      query = ctx.db
        .query("companyBudgets")
        .withIndex("by_company_and_status", (q) => 
          q.eq("companyId", args.companyId).eq("status", args.status!)
        );
    }

    const budgets = await query.order("desc").collect();

    // Calculate real-time spent and remaining amounts
    const budgetsWithCalculated = await Promise.all(
      budgets.map(async (budget) => {
        const orders = await ctx.db
          .query("orders")
          .withIndex("by_budget", (q) => q.eq("budgetId", budget._id))
          .filter((q) => 
            q.or(
              q.eq(q.field("status"), "approved"),
              q.eq(q.field("status"), "confirmed"),
              q.eq(q.field("status"), "in_production"),
              q.eq(q.field("status"), "shipped"),
              q.eq(q.field("status"), "delivered")
            )
          )
          .collect();

        const actualSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const actualRemaining = budget.totalBudget - actualSpent;

        return {
          ...budget,
          calculatedSpent: actualSpent,
          calculatedRemaining: actualRemaining,
        };
      })
    );

    return budgetsWithCalculated;
  },
});

// Get active budget for a company
export const getActiveBudget = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      return null;
    }

    const now = Date.now();
    const budgets = await ctx.db
      .query("companyBudgets")
      .withIndex("by_company_and_status", (q) => 
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect();

    // Find budget that covers current date
    const activeBudget = budgets.find(
      (budget) => budget.periodStart <= now && budget.periodEnd >= now
    );

    if (!activeBudget) {
      return null;
    }

    // Calculate real-time spent
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_budget", (q) => q.eq("budgetId", activeBudget._id))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "in_production"),
          q.eq(q.field("status"), "shipped"),
          q.eq(q.field("status"), "delivered")
        )
      )
      .collect();

    const actualSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const actualRemaining = activeBudget.totalBudget - actualSpent;

    return {
      ...activeBudget,
      calculatedSpent: actualSpent,
      calculatedRemaining: actualRemaining,
    };
  },
});

// Allocate budget to an employee
export const allocateEmployeeBudget = mutation({
  args: {
    companyBudgetId: v.id("companyBudgets"),
    memberId: v.id("companyMembers"),
    allocatedAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const budget = await ctx.db.get(args.companyBudgetId);
    if (!budget) {
      throw new Error("Budget not found");
    }

    await ensureCompanyAdmin(ctx, String(budget.companyId));

    if (budget.status !== "active") {
      throw new Error("Can only allocate from active budgets");
    }

    const member = await ctx.db.get(args.memberId);
    if (!member || String(member.companyId) !== String(budget.companyId)) {
      throw new Error("Member does not belong to this company");
    }

    // Check if allocation already exists
    const existingAllocation = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_member_and_budget", (q) => 
        q.eq("memberId", args.memberId).eq("companyBudgetId", args.companyBudgetId)
      )
      .first();

    if (existingAllocation) {
      throw new Error("Budget already allocated to this employee. Use updateEmployeeBudget instead.");
    }

    // Calculate current allocated amount
    const allAllocations = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_company_budget", (q) => q.eq("companyBudgetId", args.companyBudgetId))
      .collect();

    const currentAllocated = allAllocations.reduce((sum, alloc) => sum + alloc.allocatedAmount, 0);
    const newTotalAllocated = currentAllocated + args.allocatedAmount;

    if (newTotalAllocated > budget.totalBudget) {
      throw new Error("Total allocated amount exceeds budget");
    }

    // Create employee budget allocation
    const employeeBudgetId = await ctx.db.insert("employeeBudgets", {
      companyBudgetId: args.companyBudgetId,
      memberId: args.memberId,
      allocatedAmount: args.allocatedAmount,
      spentAmount: 0,
      remainingAmount: args.allocatedAmount,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update company budget allocated amount
    await ctx.db.patch(args.companyBudgetId, {
      allocatedBudget: newTotalAllocated,
      remainingBudget: budget.totalBudget - newTotalAllocated,
    });

    await logAudit(ctx, {
      action: "allocate_employee_budget",
      entityType: "employeeBudget",
      entityId: String(employeeBudgetId),
      companyId: String(budget.companyId),
      newValues: { memberId: String(args.memberId), allocatedAmount: args.allocatedAmount },
    });

    return employeeBudgetId;
  },
});

// Update employee budget allocation
export const updateEmployeeBudget = mutation({
  args: {
    employeeBudgetId: v.id("employeeBudgets"),
    allocatedAmount: v.number(),
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

    const budget = await ctx.db.get(employeeBudget.companyBudgetId);
    if (!budget) {
      throw new Error("Company budget not found");
    }

    await ensureCompanyAdmin(ctx, String(budget.companyId));

    if (budget.status !== "active") {
      throw new Error("Can only update allocations for active budgets");
    }

    // Calculate new total allocated amount
    const allAllocations = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_company_budget", (q) => q.eq("companyBudgetId", employeeBudget.companyBudgetId))
      .collect();

    const currentAllocated = allAllocations.reduce((sum, alloc) => {
      if (alloc._id === args.employeeBudgetId) {
        return sum; // Exclude current allocation
      }
      return sum + alloc.allocatedAmount;
    }, 0);

    const newTotalAllocated = currentAllocated + args.allocatedAmount;

    if (newTotalAllocated > budget.totalBudget) {
      throw new Error("Total allocated amount exceeds budget");
    }

    // Check if employee has already spent more than new allocation
    if (employeeBudget.spentAmount > args.allocatedAmount) {
      throw new Error("Cannot reduce allocation below spent amount");
    }

    const oldAllocatedAmount = employeeBudget.allocatedAmount;

    // Update employee budget
    await ctx.db.patch(args.employeeBudgetId, {
      allocatedAmount: args.allocatedAmount,
      remainingAmount: args.allocatedAmount - employeeBudget.spentAmount,
      updatedAt: Date.now(),
    });

    // Update company budget allocated amount
    await ctx.db.patch(employeeBudget.companyBudgetId, {
      allocatedBudget: newTotalAllocated,
      remainingBudget: budget.totalBudget - newTotalAllocated,
    });

    await logAudit(ctx, {
      action: "update_employee_budget",
      entityType: "employeeBudget",
      entityId: String(args.employeeBudgetId),
      companyId: String(budget.companyId),
      oldValues: { allocatedAmount: oldAllocatedAmount },
      newValues: { allocatedAmount: args.allocatedAmount },
    });
  },
});

// Get employee budget for current active period
export const getEmployeeBudget = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      return null;
    }

    // Get active budget
    const activeBudget = await ctx.db
      .query("companyBudgets")
      .withIndex("by_company_and_status", (q) => 
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect();

    const now = Date.now();
    const currentBudget = activeBudget.find(
      (budget) => budget.periodStart <= now && budget.periodEnd >= now
    );

    if (!currentBudget) {
      return null;
    }

    // Get employee budget allocation
    const employeeBudget = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_member_and_budget", (q) => 
        q.eq("memberId", membership._id).eq("companyBudgetId", currentBudget._id)
      )
      .first();

    if (!employeeBudget) {
      return null;
    }

    // Calculate real-time spent from orders
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => 
        q.and(
          q.eq(q.field("employeeBudgetId"), employeeBudget._id),
          q.or(
            q.eq(q.field("status"), "approved"),
            q.eq(q.field("status"), "confirmed"),
            q.eq(q.field("status"), "in_production"),
            q.eq(q.field("status"), "shipped"),
            q.eq(q.field("status"), "delivered")
          )
        )
      )
      .collect();

    const actualSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const actualRemaining = employeeBudget.allocatedAmount - actualSpent;

    return {
      ...employeeBudget,
      budget: currentBudget,
      calculatedSpent: actualSpent,
      calculatedRemaining: actualRemaining,
    };
  },
});

// Check if budget has sufficient funds
export const checkBudgetAvailability = query({
  args: {
    companyId: v.id("companies"),
    amount: v.number(),
    memberId: v.optional(v.id("companyMembers")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { available: false, reason: "Not authenticated" };
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      return { available: false, reason: "Not a company member" };
    }

    const memberIdToCheck = args.memberId || membership._id;
    const memberToCheck = memberIdToCheck !== membership._id 
      ? await ctx.db.get(memberIdToCheck)
      : membership;
    
    if (!memberToCheck) {
      return { available: false, reason: "Member not found" };
    }

    // Get active budget
    const now = Date.now();
    const activeBudgets = await ctx.db
      .query("companyBudgets")
      .withIndex("by_company_and_status", (q) => 
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect();

    const currentBudget = activeBudgets.find(
      (budget) => budget.periodStart <= now && budget.periodEnd >= now
    );

    if (!currentBudget) {
      return { available: false, reason: "No active budget period" };
    }

    // Get employee budget allocation
    const employeeBudget = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_member_and_budget", (q) => 
        q.eq("memberId", memberIdToCheck).eq("companyBudgetId", currentBudget._id)
      )
      .first();

    if (!employeeBudget) {
      return { available: false, reason: "No budget allocation for this employee" };
    }

    // Calculate real-time spent - get orders for this employee budget
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_budget", (q) => q.eq("budgetId", currentBudget._id))
      .filter((q) => 
        q.and(
          q.eq(q.field("employeeBudgetId"), employeeBudget._id),
          q.or(
            q.eq(q.field("status"), "approved"),
            q.eq(q.field("status"), "confirmed"),
            q.eq(q.field("status"), "in_production"),
            q.eq(q.field("status"), "shipped"),
            q.eq(q.field("status"), "delivered")
          )
        )
      )
      .collect();

    const actualSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const actualRemaining = employeeBudget.allocatedAmount - actualSpent;

    if (actualRemaining >= args.amount) {
      return {
        available: true,
        remaining: actualRemaining,
        employeeBudgetId: employeeBudget._id,
        budgetId: currentBudget._id,
      };
    } else {
      return {
        available: false,
        reason: "Insufficient budget",
        remaining: actualRemaining,
        employeeBudgetId: employeeBudget._id,
        budgetId: currentBudget._id,
      };
    }
  },
});

// Deduct budget when order is approved
export const deductBudget = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.paymentSource !== "company_budget" || !order.employeeBudgetId || !order.budgetId) {
      return; // Not a budget order, nothing to deduct
    }

    const employeeBudget = await ctx.db.get(order.employeeBudgetId);
    if (!employeeBudget) {
      throw new Error("Employee budget not found");
    }

    const companyBudget = await ctx.db.get(order.budgetId);
    if (!companyBudget) {
      throw new Error("Company budget not found");
    }

    // Calculate current spent amount
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_budget", (q) => q.eq("budgetId", order.budgetId))
      .filter((q) => 
        q.and(
          q.eq(q.field("employeeBudgetId"), order.employeeBudgetId),
          q.or(
            q.eq(q.field("status"), "approved"),
            q.eq(q.field("status"), "confirmed"),
            q.eq(q.field("status"), "in_production"),
            q.eq(q.field("status"), "shipped"),
            q.eq(q.field("status"), "delivered")
          )
        )
      )
      .collect();

    const employeeSpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const employeeRemaining = employeeBudget.allocatedAmount - employeeSpent;

    const companySpent = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const companyRemaining = companyBudget.totalBudget - companySpent;

    // Update employee budget
    await ctx.db.patch(order.employeeBudgetId, {
      spentAmount: employeeSpent,
      remainingAmount: employeeRemaining,
      updatedAt: Date.now(),
    });

    // Update company budget
    await ctx.db.patch(order.budgetId, {
      spentBudget: companySpent,
      remainingBudget: companyRemaining,
    });
  },
});

// Get budget summary for admin
export const getBudgetSummary = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    const activeBudgets = await ctx.db
      .query("companyBudgets")
      .withIndex("by_company_and_status", (q) => 
        q.eq("companyId", args.companyId).eq("status", "active")
      )
      .collect();

    const now = Date.now();
    const currentBudget = activeBudgets.find(
      (budget) => budget.periodStart <= now && budget.periodEnd >= now
    );

    if (!currentBudget) {
      return {
        hasActiveBudget: false,
        totalBudget: 0,
        allocatedBudget: 0,
        spentBudget: 0,
        remainingBudget: 0,
        employeeAllocations: [],
      };
    }

    // Get all employee allocations
    const employeeAllocations = await ctx.db
      .query("employeeBudgets")
      .withIndex("by_company_budget", (q) => q.eq("companyBudgetId", currentBudget._id))
      .collect();

    // Calculate real-time spent
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_budget", (q) => q.eq("budgetId", currentBudget._id))
      .filter((q) => 
        q.or(
          q.eq(q.field("status"), "approved"),
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "in_production"),
          q.eq(q.field("status"), "shipped"),
          q.eq(q.field("status"), "delivered")
        )
      )
      .collect();

    const totalSpent = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalRemaining = currentBudget.totalBudget - totalSpent;

    // Calculate per-employee spending
    const allocationsWithSpending = await Promise.all(
      employeeAllocations.map(async (alloc) => {
        const employeeOrders = orders.filter((o) => o.employeeBudgetId === alloc._id);
        const employeeSpent = employeeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const employeeRemaining = alloc.allocatedAmount - employeeSpent;

        const member = await ctx.db.get(alloc.memberId);
        const user = member ? await ctx.db.get(member.userId) : null;

        return {
          ...alloc,
          member,
          user,
          calculatedSpent: employeeSpent,
          calculatedRemaining: employeeRemaining,
        };
      })
    );

    return {
      hasActiveBudget: true,
      budget: currentBudget,
      totalBudget: currentBudget.totalBudget,
      allocatedBudget: currentBudget.allocatedBudget,
      spentBudget: totalSpent,
      remainingBudget: totalRemaining,
      employeeAllocations: allocationsWithSpending,
    };
  },
});

// Update budget status (mark as completed or cancelled)
export const updateBudgetStatus = mutation({
  args: {
    budgetId: v.id("companyBudgets"),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("cancelled")),
  },
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

    const oldStatus = budget.status;
    await ctx.db.patch(args.budgetId, {
      status: args.status,
    });

    await logAudit(ctx, {
      action: "update_budget_status",
      entityType: "companyBudget",
      entityId: String(args.budgetId),
      companyId: String(budget.companyId),
      oldValues: { status: oldStatus },
      newValues: { status: args.status },
    });
  },
});

