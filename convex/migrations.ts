import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

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

/**
 * Initialize budgets for existing companies
 * This creates a default monthly budget for each company and allocates budgets to employees
 * based on their current orderLimit values (converted to a monetary amount)
 */
export const initializeBudgetsForExistingCompanies = internalMutation({
  args: {
    defaultBudgetAmount: v.optional(v.number()),
    budgetPerEmployee: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const defaultBudget = args.defaultBudgetAmount || 10000; // $10,000 default
    const budgetPerEmployee = args.budgetPerEmployee || 500; // $500 per employee default

    // Get all active companies
    const companies = await ctx.db
      .query("companies")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const results = [];

    for (const company of companies) {
      try {
        // Check if company already has a budget period
        const existingPeriod = await ctx.db
          .query("budgetPeriods")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .first();

        if (existingPeriod) {
          results.push({
            companyId: company._id,
            companyName: company.name,
            status: "skipped",
            reason: "Budget period already exists",
          });
          continue;
        }

        // Calculate current month period
        const { periodStart, periodEnd } = calculatePeriodBoundaries("monthly");

        // Create budget period
        const budgetPeriodId = await ctx.db.insert("budgetPeriods", {
          companyId: company._id,
          periodType: "monthly",
          periodStart,
          periodEnd,
          budgetAmount: defaultBudget,
          createdAt: Date.now(),
          createdBy: company.adminId,
        });

        // Create company budget
        const companyBudgetId = await ctx.db.insert("companyBudgets", {
          companyId: company._id,
          budgetPeriodId,
          periodType: "monthly",
          periodStart,
          periodEnd,
          totalBudget: defaultBudget,
          spentAmount: 0,
          status: "active",
          createdAt: Date.now(),
        });

        // Get all active employees for this company
        const employees = await ctx.db
          .query("companyMembers")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .filter((q) =>
            q.and(
              q.eq(q.field("role"), "employee"),
              q.eq(q.field("isActive"), true)
            )
          )
          .collect();

        let allocatedTotal = 0;
        const employeeAllocations = [];

        // Allocate budget to each employee
        for (const employee of employees) {
          // Use orderLimit as a rough estimate, but default to budgetPerEmployee
          // If orderLimit is very high (like for admins), use default
          const allocation =
            employee.orderLimit > 0 && employee.orderLimit < 1000
              ? employee.orderLimit * 50 // Rough conversion: assume $50 per item
              : budgetPerEmployee;

          const employeeBudgetId = await ctx.db.insert("employeeBudgets", {
            companyMemberId: employee._id,
            budgetPeriodId,
            companyBudgetId,
            allocatedAmount: allocation,
            spentAmount: 0,
            periodStart,
            periodEnd,
            createdAt: Date.now(),
          });

          // Enable budget allocation for this member
          await ctx.db.patch(employee._id, {
            budgetAllocationEnabled: true,
          });

          allocatedTotal += allocation;
          employeeAllocations.push({
            employeeId: employee._id,
            allocation,
          });
        }

        results.push({
          companyId: company._id,
          companyName: company.name,
          status: "success",
          budgetPeriodId,
          companyBudgetId,
          totalBudget: defaultBudget,
          allocatedTotal,
          employeeCount: employees.length,
          employeeAllocations,
        });
      } catch (error: any) {
        results.push({
          companyId: company._id,
          companyName: company.name,
          status: "error",
          error: error.message,
        });
      }
    }

    return {
      processed: companies.length,
      results,
    };
  },
});

/**
 * Get all companies that need budget initialization
 */
export const getCompaniesNeedingBudgetInit = internalQuery({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db
      .query("companies")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const companiesNeedingInit = [];

    for (const company of companies) {
      const existingPeriod = await ctx.db
        .query("budgetPeriods")
        .withIndex("by_company", (q) => q.eq("companyId", company._id))
        .first();

      if (!existingPeriod) {
        const employeeCount = await ctx.db
          .query("companyMembers")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .filter((q) =>
            q.and(
              q.eq(q.field("role"), "employee"),
              q.eq(q.field("isActive"), true)
            )
          )
          .collect()
          .then((employees) => employees.length);

        companiesNeedingInit.push({
          companyId: company._id,
          name: company.name,
          employeeCount,
        });
      }
    }

    return companiesNeedingInit;
  },
});

