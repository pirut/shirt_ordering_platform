import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AdminDashboard } from "./AdminDashboard";
import { EmployeeDashboard } from "./EmployeeDashboard";
import { VendorDashboard } from "./vendor/VendorDashboard";
import { ViewToggle } from "./ViewToggle";
import { AccountManagement } from "./AccountManagement";

interface DashboardProps {
  company: {
    _id?: string;
    name?: string;
    role: "companyAdmin" | "employee";
    orderLimit: number;
  };
}

export function Dashboard({ company }: DashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [currentView, setCurrentView] = useState<"admin" | "employee">(
    company.role === "companyAdmin" ? "admin" : "employee"
  );
  
  const vendor = useQuery(api.vendors.getVendorByEmail);

  // If user is a vendor, show vendor dashboard
  if (vendor) {
    return <VendorDashboard vendor={vendor} />;
  }

  const handleViewChange = (view: "admin" | "employee") => {
    setCurrentView(view);
    setActiveTab("overview"); // Reset to overview when switching views
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Bar with View Toggle */}
      <div className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">{company.name}</h1>
          <ViewToggle
            currentView={currentView}
            onViewChange={handleViewChange}
            userRole={company.role}
          />
        </div>
        <button
          onClick={() => setActiveTab("account")}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === "account"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          Account Settings
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "account" ? (
          <div className="h-full overflow-auto">
            <AccountManagement />
          </div>
        ) : currentView === "admin" ? (
          <AdminDashboard company={company} activeTab={activeTab} setActiveTab={setActiveTab} />
        ) : (
          <EmployeeDashboard company={company} activeTab={activeTab} setActiveTab={setActiveTab} />
        )}
      </div>
    </div>
  );
}
