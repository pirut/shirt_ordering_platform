import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface OverviewProps {
  company: {
    _id?: string;
    name?: string;
    role: "companyAdmin" | "employee";
    orderLimit: number;
  };
  orders: any[];
}

export function Overview({ company, orders }: OverviewProps) {
  const budgetSummary = useQuery(api.budgets.getBudgetSummary, {
    companyId: company._id as Id<"companies">,
  });

  const pendingOrders = orders.filter(order => order.status === "pending").length;
  const inProductionOrders = orders.filter(order => order.status === "in_production").length;
  const completedOrders = orders.filter(order => order.status === "completed").length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || order.totalPrice || 0), 0);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const stats = [
    {
      title: "Total Orders",
      value: orders.length,
      icon: "📦",
      color: "bg-blue-500",
    },
    {
      title: "Pending Orders",
      value: pendingOrders,
      icon: "⏳",
      color: "bg-yellow-500",
    },
    {
      title: "In Production",
      value: inProductionOrders,
      icon: "🏭",
      color: "bg-orange-500",
    },
    {
      title: "Completed",
      value: completedOrders,
      icon: "✅",
      color: "bg-green-500",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
        <p className="text-gray-600">Welcome back! Here's what's happening with your shirt orders.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`${stat.color} rounded-lg p-3 mr-4`}>
                <span className="text-2xl">{stat.icon}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Budget Summary */}
      {budgetSummary && budgetSummary.hasActiveBudget && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow-sm p-6 mb-8 border border-green-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Budget Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(budgetSummary.totalBudget)}</p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Allocated</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(budgetSummary.allocatedBudget)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {((budgetSummary.allocatedBudget / budgetSummary.totalBudget) * 100).toFixed(1)}% of total
              </p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Spent</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(budgetSummary.spentBudget)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {((budgetSummary.spentBudget / budgetSummary.totalBudget) * 100).toFixed(1)}% of total
              </p>
            </div>
            <div className="bg-white rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Remaining</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(budgetSummary.remainingBudget)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {((budgetSummary.remainingBudget / budgetSummary.totalBudget) * 100).toFixed(1)}% of total
              </p>
            </div>
          </div>
          {budgetSummary.budget && (
            <div className="mt-4 text-sm text-gray-600">
              <p>
                Period: {new Date(budgetSummary.budget.periodStart).toLocaleDateString()} - {new Date(budgetSummary.budget.periodEnd).toLocaleDateString()}
              </p>
              <p className="mt-1">
                Type: {budgetSummary.budget.periodType.charAt(0).toUpperCase() + budgetSummary.budget.periodType.slice(1)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
        </div>
        <div className="p-6">
          {orders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No orders yet</p>
          ) : (
            <div className="space-y-4">
              {orders.slice(0, 5).map((order) => (
                <div key={order._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">
                        {order.user?.name?.charAt(0) || order.user?.email?.charAt(0) || "U"}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.shirtType?.name} - {order.variant?.color}
                      </p>
                      <p className="text-sm text-gray-500">
                        {order.user?.name || order.user?.email} • {order.quantity} items
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${order.totalAmount || order.totalPrice}</p>
                    <div className="flex flex-col items-end space-y-1 mt-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        order.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                        order.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                        order.status === "in_production" ? "bg-orange-100 text-orange-800" :
                        order.status === "completed" ? "bg-green-100 text-green-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {order.status.replace("_", " ")}
                      </span>
                      {order.paymentSource && (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          order.paymentSource === "company_budget"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {order.paymentSource === "company_budget" ? "💰 Budget" : "💳 Personal"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
