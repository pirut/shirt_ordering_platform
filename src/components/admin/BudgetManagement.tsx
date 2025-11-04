import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface BudgetManagementProps {
  companyId: Id<"companies">;
}

export function BudgetManagement({ companyId }: BudgetManagementProps) {
  const [showCreateBudgetForm, setShowCreateBudgetForm] = useState(false);
  const [showAllocateForm, setShowAllocateForm] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Id<"budgetPeriods"> | null>(null);

  const budgets = useQuery(api.budgets.getCompanyBudgets, { companyId });
  const members = useQuery(api.companies.getCompanyMembers, { companyId });
  const budgetStats = useQuery(api.budgets.getBudgetStats, { companyId });
  const createBudgetPeriod = useMutation(api.budgets.createBudgetPeriod);
  const allocateEmployeeBudget = useMutation(api.budgets.allocateEmployeeBudget);

  const activeBudgets = budgets?.filter(
    (b) => b.status === "active" && Date.now() >= b.periodStart && Date.now() <= b.periodEnd
  ) || [];

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

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Budget Management</h1>
          <p className="text-gray-600">Manage company budgets and employee allocations</p>
        </div>
        <button
          onClick={() => setShowCreateBudgetForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Budget Period
        </button>
      </div>

      {/* Budget Stats Overview */}
      {budgetStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="bg-blue-100 rounded-lg p-3 mr-4">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(budgetStats.totalBudget)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="bg-green-100 rounded-lg p-3 mr-4">
                <span className="text-2xl">💵</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Remaining</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(budgetStats.remainingBudget)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="bg-orange-100 rounded-lg p-3 mr-4">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Utilization</p>
                <p className="text-2xl font-bold text-gray-900">
                  {budgetStats.utilizationPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="bg-purple-100 rounded-lg p-3 mr-4">
                <span className="text-2xl">👥</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Employees</p>
                <p className="text-2xl font-bold text-gray-900">
                  {budgetStats.employeeCount}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Budget Form */}
      {showCreateBudgetForm && (
        <CreateBudgetForm
          companyId={companyId}
          onSubmit={createBudgetPeriod}
          onCancel={() => setShowCreateBudgetForm(false)}
        />
      )}

      {/* Budget Periods List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Budget Periods</h2>
        </div>
        <div className="p-6">
          {budgets && budgets.length > 0 ? (
            <div className="space-y-4">
              {budgets.map((budget) => {
                const period = budgets.find((b) => b.budgetPeriodId === budget.budgetPeriodId);
                const utilization = (budget.spentAmount / budget.totalBudget) * 100;

                return (
                  <div
                    key={budget._id}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 capitalize">
                          {budget.periodType} Budget
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(budget.periodStart)} - {formatDate(budget.periodEnd)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          budget.status === "active"
                            ? "bg-green-100 text-green-800"
                            : budget.status === "completed"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {budget.status}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Budget:</span>
                        <span className="font-medium">{formatCurrency(budget.totalBudget)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Spent:</span>
                        <span className="font-medium">{formatCurrency(budget.spentAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Remaining:</span>
                        <span className="font-medium">
                          {formatCurrency(budget.totalBudget - budget.spentAmount)}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span>Utilization</span>
                          <span>{utilization.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              utilization > 90 ? "bg-red-500" : utilization > 70 ? "bg-orange-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(utilization, 100)}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedPeriod(budget.budgetPeriodId);
                          setShowAllocateForm(true);
                        }}
                        className="mt-3 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Allocate to Employees
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No budget periods created yet</p>
          )}
        </div>
      </div>

      {/* Allocate Budget Form */}
      {showAllocateForm && selectedPeriod && (
        <AllocateBudgetForm
          companyId={companyId}
          budgetPeriodId={selectedPeriod}
          members={members || []}
          onSubmit={allocateEmployeeBudget}
          onCancel={() => {
            setShowAllocateForm(false);
            setSelectedPeriod(null);
          }}
        />
      )}
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
    periodType: "monthly" as "quarterly" | "yearly" | "monthly",
    budgetAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.budgetAmount <= 0) {
      toast.error("Budget amount must be greater than 0");
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit({
        companyId,
        periodType: formData.periodType,
        budgetAmount: formData.budgetAmount,
      });
      toast.success("Budget period created successfully!");
      onCancel();
    } catch (error: any) {
      toast.error(error.message || "Failed to create budget period");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Budget Period</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Period Type *
          </label>
          <select
            value={formData.periodType}
            onChange={(e) =>
              setFormData({ ...formData, periodType: e.target.value as any })
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
            value={formData.budgetAmount}
            onChange={(e) =>
              setFormData({ ...formData, budgetAmount: parseFloat(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.00"
            required
          />
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

function AllocateBudgetForm({
  companyId,
  budgetPeriodId,
  members,
  onSubmit,
  onCancel,
}: {
  companyId: Id<"companies">;
  budgetPeriodId: Id<"budgetPeriods">;
  members: any[];
  onSubmit: any;
  onCancel: () => void;
}) {
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const employees = members.filter((m) => m.role === "employee" && m.isActive);

  const handleAllocationChange = (memberId: string, amount: number) => {
    setAllocations({ ...allocations, [memberId]: amount });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    try {
      const promises = Object.entries(allocations)
        .filter(([_, amount]) => amount > 0)
        .map(([memberId, amount]) =>
          onSubmit({
            companyMemberId: memberId as Id<"companyMembers">,
            budgetPeriodId,
            allocatedAmount: amount,
          })
        );

      await Promise.all(promises);
      toast.success("Budget allocations updated successfully!");
      onCancel();
    } catch (error: any) {
      toast.error(error.message || "Failed to allocate budgets");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Allocate Budget to Employees</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Employee
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Allocation ($)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((member) => (
                <tr key={member._id}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-blue-600 font-semibold text-sm">
                          {member.user?.name?.charAt(0) || member.user?.email?.charAt(0) || "U"}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {member.user?.name || "No name"}
                        </div>
                        <div className="text-sm text-gray-500">{member.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={allocations[member._id] || 0}
                      onChange={(e) =>
                        handleAllocationChange(member._id, parseFloat(e.target.value) || 0)
                      }
                      className="w-32 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {employees.length === 0 && (
            <p className="text-gray-500 text-center py-8">No employees found</p>
          )}
        </div>
        <div className="flex space-x-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Saving..." : "Save Allocations"}
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

