import { useState } from "react";

interface ViewToggleProps {
  currentView: "admin" | "employee";
  onViewChange: (view: "admin" | "employee") => void;
  userRole: "companyAdmin" | "employee";
}

export function ViewToggle({ currentView, onViewChange, userRole }: ViewToggleProps) {
  if (userRole !== "companyAdmin") return null;

  return (
    <div className="flex items-center space-x-2 bg-white rounded-lg p-1 shadow-sm border">
      <button
        onClick={() => onViewChange("admin")}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          currentView === "admin"
            ? "bg-blue-600 text-white"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Admin View
      </button>
      <button
        onClick={() => onViewChange("employee")}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          currentView === "employee"
            ? "bg-blue-600 text-white"
            : "text-gray-600 hover:text-gray-900"
        }`}
      >
        Employee View
      </button>
    </div>
  );
}
