import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface BudgetManagementProps {
  companyId: Id<"companies">;
}

export function BudgetManagement({ companyId }: BudgetManagementProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "create" | "allocate" | "reports">("overview");
  
  const budgets = useQuery(api.budgets.getCompanyBudgets, { companyId });
  const budgetSummary = useQuery(api.budgets.getBudgetSummary, { companyId });
  const members = useQuery(api.companies.getCompanyMembers, { companyId });
  const createBudget = useMutation(api.budgets.createCompanyBudget);
  const allocateBudget = useMutation(api.budgets.allocateEmployeeBudget);
  const updateBudgetStatus = useMutation(api.budgets.updateBudgetStatus);

  const tabs = [
    { id: "overview" as const, label: "Budget Overview", icon: "📊" },
    { id: "create" as const, label: "Create Budget", icon: "➕" },
    { id: "allocate" as const, label: "Allocate Budgets", icon: "👥" },
    { id: "reports" as const, label: "Reports", icon: "📈" },
  ];

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Budget Management</h1>
        <p className="text-gray-600">Manage company budgets and employee allocations</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <BudgetOverview
          budgets={budgets || []}
          budgetSummary={budgetSummary}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          updateBudgetStatus={updateBudgetStatus}
        />
      )}

      {activeTab === "create" && (
        <CreateBudgetForm
          companyId={companyId}
          onCreate={createBudget}
          existingBudgets={budgets || []}
          formatDate={formatDate}
        />
      )}

      {activeTab === "allocate" && (
        <AllocateBudgets
          companyId={companyId}
          budgets={budgets || []}
          members={members || []}
          onAllocate={allocateBudget}
          formatCurrency={formatCurrency}
        />
      )}

      {activeTab === "reports" && (
        <BudgetReports
          budgetSummary={budgetSummary}
          formatCurrency={formatCurrency}
        />
      )}
    </div>
  );
}

function BudgetOverview({
  budgets,
  budgetSummary,
  formatCurrency,
  formatDate,
  updateBudgetStatus,
}: {
  budgets: any[];
  budgetSummary: any;
  formatCurrency: (amount: number) => string;
  formatDate: (timestamp: number) => string;
  updateBudgetStatus: any;
}) {
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  const handleStatusUpdate = async (budgetId: string, status: "active" | "completed" | "cancelled") => {
    setProcessingStatus(budgetId);
    try {
      await updateBudgetStatus({
        budgetId: budgetId as Id<"companyBudgets">,
        status,
      });
      toast.success("Budget status updated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    } finally {
      setProcessingStatus(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Budget Summary */}
      {budgetSummary && budgetSummary.hasActiveBudget && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Budget Period</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(budgetSummary.totalBudget)}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Allocated</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(budgetSummary.allocatedBudget)}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Spent</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(budgetSummary.spentBudget)}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Remaining</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(budgetSummary.remainingBudget)}</p>
            </div>
          </div>
          {budgetSummary.budget && (
            <div className="mt-4 text-sm text-gray-600">
              <p>
                Period: {formatDate(budgetSummary.budget.periodStart)} - {formatDate(budgetSummary.budget.periodEnd)}
              </p>
              <p className="mt-1">
                Type: {budgetSummary.budget.periodType.charAt(0).toUpperCase() + budgetSummary.budget.periodType.slice(1)}
              </p>
            </div>
          )}
        </div>
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
                  Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Allocated
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
              {budgets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No budgets created yet
                  </td>
                </tr>
              ) : (
                budgets.map((budget) => {
                  const spent = budget.calculatedSpent ?? budget.spentBudget;
                  const remaining = budget.calculatedRemaining ?? budget.remainingBudget;
                  const percentage = (spent / budget.totalBudget) * 100;

                  return (
                    <tr key={budget._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(budget.periodStart)} - {formatDate(budget.periodEnd)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {budget.periodType.charAt(0).toUpperCase() + budget.periodType.slice(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(budget.totalBudget)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(budget.allocatedBudget)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(spent)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
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
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {budget.status === "active" && (
                          <button
                            onClick={() => handleStatusUpdate(budget._id, "completed")}
                            disabled={processingStatus === budget._id}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                          >
                            {processingStatus === budget._id ? "Processing..." : "Complete"}
                          </button>
                        )}
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-orange-500" : "bg-green-500"
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CreateBudgetForm({
  companyId,
  onCreate,
  existingBudgets,
  formatDate,
}: {
  companyId: Id<"companies">;
  onCreate: any;
  existingBudgets: any[];
  formatDate: (timestamp: number) => string;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    periodType: "quarterly" as "monthly" | "quarterly" | "yearly",
    totalBudget: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const totalBudget = parseFloat(formData.totalBudget);
      if (isNaN(totalBudget) || totalBudget <= 0) {
        toast.error("Please enter a valid budget amount");
        return;
      }

      await onCreate({
        companyId,
        periodType: formData.periodType,
        totalBudget,
        notes: formData.notes || undefined,
      });

      toast.success("Budget created successfully!");
      setFormData({
        periodType: "quarterly",
        totalBudget: "",
        notes: "",
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to create budget");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPeriodInfo = (type: string) => {
    const now = new Date();
    let start: Date, end: Date;

    if (type === "monthly") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (type === "quarterly") {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
    } else {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    return { start, end };
  };

  const periodInfo = getPeriodInfo(formData.periodType);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create New Budget</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Budget Period Type
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
          <p className="mt-2 text-sm text-gray-500">
            Period: {formatDate(periodInfo.start.getTime())} - {formatDate(periodInfo.end.getTime())}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Total Budget Amount ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.totalBudget}
            onChange={(e) => setFormData({ ...formData, totalBudget: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter budget amount"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (Optional)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Any additional notes about this budget..."
          />
        </div>

        {existingBudgets.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Make sure the new budget period doesn't overlap with existing active budgets.
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating..." : "Create Budget"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AllocateBudgets({
  companyId,
  budgets,
  members,
  onAllocate,
  formatCurrency,
}: {
  companyId: Id<"companies">;
  budgets: any[];
  members: any[];
  onAllocate: any;
  formatCurrency: (amount: number) => string;
}) {
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeBudgets = budgets.filter((b) => b.status === "active");
  const currentBudget = activeBudgets.find(
    (b) => b.periodStart <= Date.now() && b.periodEnd >= Date.now()
  ) || (activeBudgets.length > 0 ? activeBudgets[0] : null);

  const employees = members.filter((m) => m.role === "employee");

  const handleAllocate = async (memberId: string, amount: string) => {
    if (!selectedBudget || !currentBudget) {
      toast.error("Please select a budget");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAllocate({
        companyBudgetId: selectedBudget as Id<"companyBudgets">,
        memberId: memberId as Id<"companyMembers">,
        allocatedAmount: amountNum,
      });
      toast.success("Budget allocated successfully!");
      setAllocations({ ...allocations, [memberId]: "" });
    } catch (error: any) {
      toast.error(error.message || "Failed to allocate budget");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (activeBudgets.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <p className="text-gray-500">No active budgets available. Create a budget first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Budget Period
        </label>
        <select
          value={selectedBudget || currentBudget?._id || ""}
          onChange={(e) => setSelectedBudget(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {activeBudgets.map((budget) => (
            <option key={budget._id} value={budget._id}>
              {new Date(budget.periodStart).toLocaleDateString()} - {new Date(budget.periodEnd).toLocaleDateString()} ({formatCurrency(budget.calculatedRemaining ?? budget.remainingBudget)} remaining)
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Allocate Budget to Employees</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Allocation Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No employees found
                  </td>
                </tr>
              ) : (
                employees.map((member) => (
                  <tr key={member._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {member.user?.name || member.user?.email || "Unknown"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {member.department || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={allocations[member._id] || ""}
                        onChange={(e) =>
                          setAllocations({ ...allocations, [member._id]: e.target.value })
                        }
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleAllocate(member._id, allocations[member._id] || "0")}
                        disabled={isSubmitting || !allocations[member._id] || parseFloat(allocations[member._id] || "0") <= 0}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Allocate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BudgetReports({
  budgetSummary,
  formatCurrency,
}: {
  budgetSummary: any;
  formatCurrency: (amount: number) => string;
}) {
  if (!budgetSummary || !budgetSummary.hasActiveBudget) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 text-center">
        <p className="text-gray-500">No active budget to generate reports for.</p>
      </div>
    );
  }

  const { employeeAllocations } = budgetSummary;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Budget Utilization</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Allocated</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(budgetSummary.allocatedBudget)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {((budgetSummary.allocatedBudget / budgetSummary.totalBudget) * 100).toFixed(1)}% of total budget
            </p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-orange-600">
              {formatCurrency(budgetSummary.spentBudget)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {((budgetSummary.spentBudget / budgetSummary.totalBudget) * 100).toFixed(1)}% of total budget
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Total Remaining</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(budgetSummary.remainingBudget)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {((budgetSummary.remainingBudget / budgetSummary.totalBudget) * 100).toFixed(1)}% of total budget
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Employee Budget Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Allocated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Spent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Remaining
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilization
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employeeAllocations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No budget allocations yet
                  </td>
                </tr>
              ) : (
                employeeAllocations.map((alloc: any) => {
                  const spent = alloc.calculatedSpent ?? alloc.spentAmount;
                  const remaining = alloc.calculatedRemaining ?? alloc.remainingAmount;
                  const percentage = alloc.allocatedAmount > 0 
                    ? (spent / alloc.allocatedAmount) * 100 
                    : 0;

                  return (
                    <tr key={alloc._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {alloc.user?.name || alloc.user?.email || "Unknown"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(alloc.allocatedAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatCurrency(spent)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {formatCurrency(remaining)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className={`h-2 rounded-full ${
                                percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-orange-500" : "bg-green-500"
                              }`}
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600">{percentage.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

