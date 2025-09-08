import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface ReportsManagementProps {
  companyId: Id<"companies">;
}

export function ReportsManagement({ companyId }: ReportsManagementProps) {
  const [reportType, setReportType] = useState<"orders" | "vendors">("orders");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [filters, setFilters] = useState({
    department: "",
    status: "",
  });

  const orderReport = useQuery(
    api.reports.getOrderReport,
    reportType === "orders" ? {
      companyId,
      startDate: new Date(dateRange.startDate).getTime(),
      endDate: new Date(dateRange.endDate).getTime(),
      department: filters.department || undefined,
      status: filters.status || undefined,
    } : "skip"
  );

  const vendorReport = useQuery(
    api.reports.getVendorReport,
    reportType === "vendors" ? {
      companyId,
      startDate: new Date(dateRange.startDate).getTime(),
      endDate: new Date(dateRange.endDate).getTime(),
    } : "skip"
  );

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportOrders = () => {
    if (!orderReport?.orders) return;
    
    const exportData = orderReport.orders.map(order => ({
      orderNumber: order.orderNumber,
      employee: order.user?.name || order.user?.email,
      department: order.department || "Unassigned",
      totalAmount: order.totalAmount,
      status: order.status,
      orderDate: new Date(order.orderDate).toLocaleDateString(),
      itemCount: order.items.length,
    }));

    exportToCSV(exportData, 'orders-report');
  };

  const handleExportVendors = () => {
    if (!vendorReport?.purchaseOrders) return;
    
    const exportData = vendorReport.purchaseOrders.map(po => ({
      poNumber: po.poNumber,
      vendor: po.vendor?.name,
      totalAmount: po.totalAmount,
      status: po.status,
      createdDate: new Date(po.createdAt).toLocaleDateString(),
      itemCount: po.items.length,
    }));

    exportToCSV(exportData, 'vendor-report');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
          <p className="text-gray-600">Generate and export detailed reports</p>
        </div>
      </div>

      {/* Report Controls */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as "orders" | "vendors")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="orders">Order Report</option>
              <option value="vendors">Vendor Report</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={reportType === "orders" ? handleExportOrders : handleExportVendors}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Export CSV
            </button>
          </div>
        </div>

        {reportType === "orders" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department Filter
              </label>
              <input
                type="text"
                value={filters.department}
                onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                placeholder="Filter by department"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Filter
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_production">In Production</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Report Results */}
      {reportType === "orders" && orderReport && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-2xl font-bold text-blue-600">
                {orderReport.summary.totalOrders}
              </div>
              <div className="text-sm text-gray-600">Total Orders</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-2xl font-bold text-green-600">
                ${orderReport.summary.totalAmount.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Total Amount</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-2xl font-bold text-purple-600">
                ${orderReport.summary.averageOrderValue.toFixed(2)}
              </div>
              <div className="text-sm text-gray-600">Average Order Value</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-2xl font-bold text-orange-600">
                {Object.keys(orderReport.summary.departmentBreakdown).length}
              </div>
              <div className="text-sm text-gray-600">Departments</div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(orderReport.summary.statusBreakdown).map(([status, count]) => (
                <div key={status} className="text-center">
                  <div className="text-xl font-bold text-gray-900">{count}</div>
                  <div className="text-sm text-gray-600 capitalize">{status.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(orderReport.summary.departmentBreakdown).map(([dept, count]) => (
                <div key={dept} className="text-center">
                  <div className="text-xl font-bold text-gray-900">{count}</div>
                  <div className="text-sm text-gray-600">{dept}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportType === "vendors" && vendorReport && (
        <div className="space-y-6">
          {/* Vendor Performance */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Vendor Performance</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total POs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed POs
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completion Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(vendorReport.vendorPerformance).map(([vendorName, stats]: [string, any]) => (
                    <tr key={vendorName}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {vendorName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stats.totalPOs}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${stats.totalAmount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stats.completedPOs}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {stats.totalPOs > 0 ? ((stats.completedPOs / stats.totalPOs) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
