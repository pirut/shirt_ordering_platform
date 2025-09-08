import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EmployeeOverview } from "./employee/EmployeeOverview";
import { OrderShirts } from "./employee/OrderShirts";
import { MyOrders } from "./employee/MyOrders";

interface EmployeeDashboardProps {
  company: {
    _id?: string;
    name?: string;
    role: "companyAdmin" | "employee";
    orderLimit: number;
  };
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function EmployeeDashboard({ company, activeTab, setActiveTab }: EmployeeDashboardProps) {
  const userOrders = useQuery(api.orders.getUserOrders);
  const orderStats = useQuery(api.orders.getUserOrderStats);

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "order", label: "Order Shirts", icon: "🛒" },
    { id: "my-orders", label: "My Orders", icon: "📦" },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
          <p className="text-sm text-gray-500">Employee Portal</p>
        </div>
        
        <nav className="mt-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-6 py-3 text-left hover:bg-gray-50 transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-50 text-blue-600 border-r-2 border-blue-600"
                  : "text-gray-700"
              }`}
            >
              <span className="mr-3">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {activeTab === "overview" && (
            <EmployeeOverview 
              company={company}
              orders={userOrders || []}
              orderStats={orderStats}
            />
          )}
          {activeTab === "order" && (
            <OrderShirts 
              companyId={company._id as Id<"companies">}
              orderStats={orderStats}
            />
          )}
          {activeTab === "my-orders" && (
            <MyOrders orders={userOrders || []} />
          )}
        </div>
      </div>
    </div>
  );
}
