import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface EmployeeOverviewProps {
  company: {
    _id?: string;
    name?: string;
    role: "companyAdmin" | "employee";
    orderLimit: number;
  };
  orders: any[];
  orderStats: {
    totalOrdered: number;
    orderLimit: number;
    remainingLimit: number;
    orders: number;
  } | null | undefined;
}

export function EmployeeOverview({ company, orders, orderStats }: EmployeeOverviewProps) {
  const employeeBudget = useQuery(api.budgets.getEmployeeBudget, {});
  const recentOrders = orders.slice(0, 3);
  const pendingOrders = orders.filter(order => order.status === "pending").length;
  const completedOrders = orders.filter(order => order.status === "completed").length;

  const stats = [
    {
      title: "Total Ordered",
      value: orderStats?.totalOrdered || 0,
      icon: "📦",
      color: "bg-blue-500",
    },
    {
      title: "Order Limit",
      value: orderStats?.orderLimit || 0,
      icon: "🎯",
      color: "bg-purple-500",
    },
    {
      title: "Remaining",
      value: orderStats?.remainingLimit || 0,
      icon: "⚡",
      color: "bg-green-500",
    },
    {
      title: "Completed",
      value: completedOrders,
      icon: "✅",
      color: "bg-emerald-500",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back!</h1>
        <p className="text-gray-600">Here's your shirt ordering overview for {company.name}</p>
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

      {/* Budget Status */}
      {employeeBudget && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Budget Status</h2>
            <span className="text-sm text-gray-500">
              {employeeBudget.budgetPeriod?.periodType && (
                <>Current {employeeBudget.budgetPeriod.periodType} period</>
              )}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">Allocated</p>
              <p className="text-lg font-semibold text-gray-900">
                ${employeeBudget.allocatedAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Spent</p>
              <p className="text-lg font-semibold text-gray-900">
                ${employeeBudget.spentAmount.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Remaining</p>
              <p className={`text-lg font-semibold ${
                employeeBudget.remainingAmount < 0 
                  ? "text-red-600" 
                  : employeeBudget.remainingAmount < employeeBudget.allocatedAmount * 0.2
                  ? "text-yellow-600"
                  : "text-green-600"
              }`}>
                ${employeeBudget.remainingAmount.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                employeeBudget.remainingAmount < 0 
                  ? "bg-red-500" 
                  : employeeBudget.remainingAmount < employeeBudget.allocatedAmount * 0.2
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width: `${Math.min(
                  (employeeBudget.spentAmount / employeeBudget.allocatedAmount) * 100,
                  100
                )}%`
              }}
            ></div>
          </div>
          {employeeBudget.remainingAmount < employeeBudget.allocatedAmount * 0.2 && employeeBudget.remainingAmount >= 0 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Low budget warning: You have less than 20% of your budget remaining.
              </p>
            </div>
          )}
          {employeeBudget.remainingAmount < 0 && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                ❌ Budget exceeded: You have exceeded your allocated budget.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Order Limit Progress */}
      {orderStats && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Order Limit Usage</h2>
            <span className="text-sm text-gray-500">
              {orderStats.totalOrdered} of {orderStats.orderLimit} used
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                orderStats.remainingLimit <= 0 
                  ? "bg-red-500" 
                  : orderStats.remainingLimit <= orderStats.orderLimit * 0.2
                  ? "bg-yellow-500"
                  : "bg-green-500"
              }`}
              style={{
                width: `${Math.min((orderStats.totalOrdered / orderStats.orderLimit) * 100, 100)}%`
              }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>0</span>
            <span>{orderStats.orderLimit}</span>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
        </div>
        <div className="p-6">
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No orders yet</p>
              <p className="text-gray-400 text-sm mt-1">Start by ordering some shirts!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">👕</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.shirtType?.name} - {order.variant?.color}
                      </p>
                      <p className="text-sm text-gray-500">
                        {order.variant?.sleeveLength} • Size {order.size} • Qty: {order.quantity}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">${order.totalPrice}</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      order.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                      order.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                      order.status === "in_production" ? "bg-orange-100 text-orange-800" :
                      order.status === "completed" ? "bg-green-100 text-green-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {order.status.replace("_", " ")}
                    </span>
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
