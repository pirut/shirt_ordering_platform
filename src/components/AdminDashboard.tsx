import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Overview } from "./admin/Overview";
import { ShirtManagement } from "./admin/ShirtManagement";
import { TeamManagement } from "./admin/TeamManagement";
import { OrderManagement } from "./admin/OrderManagement";
import { VendorManagement } from "./admin/VendorManagement";
import { BudgetManagement } from "./admin/BudgetManagement";

interface AdminDashboardProps {
  company: {
    _id?: string;
    name?: string;
    role: "companyAdmin" | "employee";
    orderLimit: number;
  };
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function AdminDashboard({ company, activeTab, setActiveTab }: AdminDashboardProps) {
  const companyOrders = useQuery(api.orders.getCompanyOrders, { 
    companyId: company._id as Id<"companies"> 
  });

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "shirts", label: "Shirt Catalog", icon: "👕" },
    { id: "team", label: "Team", icon: "👥" },
    { id: "orders", label: "Orders", icon: "📦" },
    { id: "vendors", label: "Vendors", icon: "🏢" },
    { id: "budgets", label: "Budgets", icon: "💰" },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
          <p className="text-sm text-gray-500">Admin Dashboard</p>
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
            <Overview 
              company={company} 
              orders={companyOrders || []} 
            />
          )}
          {activeTab === "shirts" && (
            <ShirtManagement companyId={company._id as Id<"companies">} />
          )}
          {activeTab === "team" && (
            <TeamManagement companyId={company._id as Id<"companies">} />
          )}
          {activeTab === "orders" && (
            <OrderManagement 
              companyId={company._id as Id<"companies">} 
              orders={companyOrders || []} 
            />
          )}
          {activeTab === "vendors" && (
            <VendorManagement companyId={company._id as Id<"companies">} />
          )}
          {activeTab === "budgets" && (
            <BudgetManagement companyId={company._id as Id<"companies">} />
          )}
        </div>
      </div>
    </div>
  );
}
