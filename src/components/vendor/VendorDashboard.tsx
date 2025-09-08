import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface VendorDashboardProps {
  vendor: {
    _id: string;
    name: string;
    email: string;
    companyId: string;
  };
}

export function VendorDashboard({ vendor }: VendorDashboardProps) {
  const [activeTab, setActiveTab] = useState("orders");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const orders = useQuery(api.orders.getVendorOrders, { 
    vendorId: vendor._id as Id<"vendors"> 
  });
  const invoices = useQuery(api.vendors.getVendorInvoices, { 
    vendorId: vendor._id as Id<"vendors"> 
  });
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);

  const filteredOrders = statusFilter === "all" 
    ? orders || []
    : (orders || []).filter(order => order.status === statusFilter);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus({
        orderId: orderId as Id<"orders">,
        status: newStatus as any,
      });
      toast.success("Order status updated successfully!");
    } catch (error) {
      toast.error("Failed to update order status");
      console.error(error);
    }
  };

  const tabs = [
    { id: "orders", label: "Orders", icon: "📦" },
    { id: "invoices", label: "Invoices", icon: "💰" },
    { id: "profile", label: "Profile", icon: "👤" },
  ];

  const statusOptions = [
    { value: "all", label: "All Orders" },
    { value: "confirmed", label: "Confirmed" },
    { value: "in_production", label: "In Production" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
          <p className="text-sm text-gray-500">Vendor Portal</p>
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
          {activeTab === "orders" && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Production Orders</h1>
                  <p className="text-gray-600">Manage and update order production status</p>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Orders Table */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Order Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Order Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredOrders.map((order) => (
                        <tr key={order._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                Order #{order.orderNumber}
                              </div>
                              <div className="text-sm text-gray-500">
                                {order.items.length} item(s)
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${order.totalAmount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              order.status === "confirmed" ? "bg-blue-100 text-blue-800" :
                              order.status === "in_production" ? "bg-orange-100 text-orange-800" :
                              order.status === "delivered" ? "bg-green-100 text-green-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {order.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(order.orderDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <VendorStatusDropdown
                              currentStatus={order.status}
                              onStatusChange={(newStatus) => handleStatusUpdate(order._id, newStatus)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredOrders.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">
                    {statusFilter === "all" ? "No orders assigned yet" : `No ${statusFilter} orders`}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === "invoices" && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoices</h1>
                <p className="text-gray-600">View your invoices and payment status</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6">
                  {invoices?.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No invoices yet</p>
                  ) : (
                    <div className="space-y-4">
                      {invoices?.map((invoice) => (
                        <div key={invoice._id} className="p-4 border rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h3 className="font-medium text-gray-900">
                                {invoice.invoiceNumber}
                              </h3>
                              <p className="text-sm text-gray-600">
                                Due: {new Date(invoice.dueDate).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              invoice.status === "draft" ? "bg-gray-100 text-gray-800" :
                              invoice.status === "sent" ? "bg-blue-100 text-blue-800" :
                              "bg-green-100 text-green-800"
                            }`}>
                              {invoice.status}
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold text-gray-900">
                              ${invoice.amount}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "profile" && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Vendor Profile</h1>
                <p className="text-gray-600">Your vendor information</p>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={vendor.name}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={vendor.email}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                      disabled
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    Contact your client to update vendor information.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VendorStatusDropdown({ 
  currentStatus, 
  onStatusChange 
}: { 
  currentStatus: string;
  onStatusChange: (status: string) => void;
}) {
  // Vendors can only update certain statuses
  const statusOptions = [
    { value: "confirmed", label: "Confirmed" },
    { value: "in_production", label: "In Production" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <select
      value={currentStatus}
      onChange={(e) => onStatusChange(e.target.value)}
      className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      {statusOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
