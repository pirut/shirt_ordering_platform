import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface BudgetManagementProps {
  companyId: Id<"companies">;
}

export function BudgetManagement({ companyId }: BudgetManagementProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState<string | null>(null);

  const budgets = useQuery(api.budgets.getCompanyBudgets, { companyId, includeInactive: true });
  const budgetSummary = useQuery(api.budgets.getBudgetSummary, { companyId });

  const createBudget = useMutation(api.budgets.createBudget);
  const updateBudget = useMutation(api.budgets.updateBudget);
  const archiveBudget = useMutation(api.budgets.archiveBudget);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getProgressPercentage = (spent: number, total: number) => {
    if (total === 0) return 0;
    return Math.min((spent / total) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Budget Management</h1>
          <p className="text-gray-600">Manage quarterly, yearly, and monthly budgets for your company</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Budget
        </button>
      </div>

      {/* Budget Summary Cards */}
      {budgetSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {(["monthly", "quarterly", "yearly"] as const).map((periodType) => {
            const budget = budgetSummary[periodType];
            if (!budget) {
              return (
                <div key={periodType} className="bg-white rounded-lg shadow-sm p-6 border-2 border-dashed border-gray-300">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-700 capitalize">{periodType} Budget</h3>
                    <span className="text-sm text-gray-500">Not set</span>
                  </div>
                  <p className="text-sm text-gray-500">No active {periodType} budget</p>
                </div>
              );
            }

            const percentage = getProgressPercentage(budget.spentAmount, budget.amount);
            const remaining = budget.remaining;

            return (
              <div key={periodType} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 capitalize">{periodType} Budget</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    remaining > 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}>
                    {remaining > 0 ? "Active" : "Exceeded"}
                  </span>
                </div>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Spent</span>
                    <span className="font-semibold">
                      {formatCurrency(budget.spentAmount)} / {formatCurrency(budget.amount)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getProgressColor(percentage)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining</span>
                  <span className={`font-semibold ${remaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(remaining)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {formatDate(budget.periodStart)} - {formatDate(budget.periodEnd)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Budget Form */}
      {showCreateForm && (
        <CreateBudgetForm
          companyId={companyId}
          onSubmit={createBudget}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Budgets List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">All Budgets</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remaining
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {budgets?.map((budget) => {
                const remaining = budget.amount - budget.spentAmount;
                const percentage = getProgressPercentage(budget.spentAmount, budget.amount);

                return (
                  <tr key={budget._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {budget.periodType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(budget.periodStart)} - {formatDate(budget.periodEnd)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(budget.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(budget.spentAmount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${remaining >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(remaining)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        budget.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {budget.isActive ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {editingBudget === budget._id ? (
                          <EditBudgetForm
                            budget={budget}
                            onSave={async (amount, periodStart) => {
                              try {
                                await updateBudget({
                                  budgetId: budget._id,
                                  amount,
                                  periodStart,
                                });
                                toast.success("Budget updated successfully!");
                                setEditingBudget(null);
                              } catch (error: any) {
                                toast.error(error.message || "Failed to update budget");
                              }
                            }}
                            onCancel={() => setEditingBudget(null)}
                          />
                        ) : (
                          <>
                            {budget.isActive && (
                              <button
                                onClick={() => setEditingBudget(budget._id)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Edit
                              </button>
                            )}
                            {budget.isActive && (
                              <button
                                onClick={async () => {
                                  if (confirm("Are you sure you want to archive this budget?")) {
                                    try {
                                      await archiveBudget({ budgetId: budget._id });
                                      toast.success("Budget archived successfully!");
                                    } catch (error: any) {
                                      toast.error(error.message || "Failed to archive budget");
                                    }
                                  }
                                }}
                                className="text-red-600 hover:text-red-800"
                              >
                                Archive
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {budgets?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No budgets created yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first budget to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateBudgetForm({
  companyId,
  onSubmit,
  onCancel,
}: {
  companyId: Id<"companies">;
  onSubmit: any;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    periodType: "monthly" as "monthly" | "quarterly" | "yearly",
    amount: "",
    periodStart: new Date().toISOString().split("T")[0],
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid budget amount");
      return;
    }

    setIsLoading(true);
    try {
      const periodStartDate = new Date(formData.periodStart);
      periodStartDate.setHours(0, 0, 0, 0);

      await onSubmit({
        companyId,
        periodType: formData.periodType,
        amount: parseFloat(formData.amount),
        periodStart: periodStartDate.getTime(),
      });

      toast.success("Budget created successfully!");
      onCancel();
      setFormData({
        periodType: "monthly",
        amount: "",
        periodStart: new Date().toISOString().split("T")[0],
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create budget");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Budget</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period Type *
            </label>
            <select
              value={formData.periodType}
              onChange={(e) =>
                setFormData({ ...formData, periodType: e.target.value as "monthly" | "quarterly" | "yearly" })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Amount ($) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period Start Date *
            </label>
            <input
              type="date"
              value={formData.periodStart}
              onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Budget"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EditBudgetForm({
  budget,
  onSave,
  onCancel,
}: {
  budget: any;
  onSave: (amount?: number, periodStart?: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(budget.amount.toString());
  const [periodStart, setPeriodStart] = useState(
    new Date(budget.periodStart).toISOString().split("T")[0]
  );

  const handleSave = async () => {
    const amountNum = amount ? parseFloat(amount) : undefined;
    const periodStartNum = periodStart
      ? new Date(periodStart).setHours(0, 0, 0, 0)
      : undefined;

    if (amountNum !== undefined && amountNum <= 0) {
      toast.error("Budget amount must be greater than 0");
      return;
    }

    await onSave(amountNum, periodStartNum);
  };

  return (
    <div className="flex items-center space-x-2">
      <input
        type="number"
        min="0"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Amount"
      />
      <input
        type="date"
        value={periodStart}
        onChange={(e) => setPeriodStart(e.target.value)}
        className="w-40 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      <button
        onClick={handleSave}
        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
      >
        Cancel
      </button>
    </div>
  );
}

