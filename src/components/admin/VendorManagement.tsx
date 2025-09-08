import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface VendorManagementProps {
  companyId: Id<"companies">;
}

export function VendorManagement({ companyId }: VendorManagementProps) {
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState<string | null>(null);
  
  const vendors = useQuery(api.vendors.getCompanyVendors, { companyId });
  const invoices = useQuery(api.vendors.getCompanyInvoices, { companyId });
  const createVendor = useMutation(api.vendors.createVendor);
  const createInvoice = useMutation(api.vendors.createInvoice);
  const companyPOs = useQuery(api.purchaseOrders.getCompanyPOs, { companyId });
  const updateInvoiceStatus = useMutation(api.vendors.updateInvoiceStatus);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Vendor Management</h1>
          <p className="text-gray-600">Manage vendors and invoices</p>
        </div>
        <button
          onClick={() => setShowAddVendor(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Vendor
        </button>
      </div>

      {/* Add Vendor Form */}
      {showAddVendor && (
        <AddVendorForm
          companyId={companyId}
          onSubmit={createVendor}
          onCancel={() => setShowAddVendor(false)}
        />
      )}

      {/* Vendors List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Vendors</h2>
          </div>
          <div className="p-6">
            {vendors?.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No vendors added yet</p>
            ) : (
              <div className="space-y-4">
                {vendors?.map((vendor) => (
                  <div key={vendor._id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-gray-900">{vendor.name}</h3>
                        <p className="text-sm text-gray-600">{vendor.email}</p>
                        {vendor.phone && (
                          <p className="text-sm text-gray-600">{vendor.phone}</p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowCreateInvoice(vendor._id)}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      >
                        Create Invoice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Recent Invoices</h2>
          </div>
          <div className="p-6">
            {invoices?.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No invoices created yet</p>
            ) : (
              <div className="space-y-4">
                {invoices?.slice(0, 5).map((invoice) => (
                  <div key={invoice._id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {invoice.vendor?.name}
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
                      {invoice.status !== "paid" && (
                        <button
                          onClick={() => updateInvoiceStatus({
                            invoiceId: invoice._id,
                            status: invoice.status === "draft" ? "sent" : "paid"
                          })}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          {invoice.status === "draft" ? "Send" : "Mark Paid"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Invoice Form */}
      {showCreateInvoice && (
        <CreateInvoiceForm
          vendorId={showCreateInvoice as Id<"vendors">}
          purchaseOrders={(companyPOs || []).filter(po => String(po.vendorId) === showCreateInvoice)}
          onSubmit={createInvoice}
          onCancel={() => setShowCreateInvoice(null)}
        />
      )}
    </div>
  );
}

function AddVendorForm({ 
  companyId, 
  onSubmit, 
  onCancel 
}: { 
  companyId: Id<"companies">;
  onSubmit: any;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    setIsLoading(true);
    try {
      await onSubmit({
        companyId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
      });
      toast.success("Vendor created successfully!");
      onCancel();
    } catch (error) {
      toast.error("Failed to create vendor");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Vendor</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Vendor Company Name"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="vendor@company.com"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="(555) 123-4567"
          />
        </div>
        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Vendor"}
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

function CreateInvoiceForm({ 
  vendorId, 
  purchaseOrders,
  onSubmit, 
  onCancel 
}: { 
  vendorId: Id<"vendors">;
  purchaseOrders: Array<{ _id: Id<"purchaseOrders">; poNumber: string }>;
  onSubmit: any;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    poId: "",
    amount: "",
    dueDate: "",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.dueDate || !formData.poId) return;

    setIsLoading(true);
    try {
      await onSubmit({
        poId: formData.poId as unknown as Id<"purchaseOrders">,
        amount: parseFloat(formData.amount),
        dueDate: new Date(formData.dueDate).getTime(),
        notes: formData.notes || undefined,
      });
      toast.success("Invoice created successfully!");
      onCancel();
    } catch (error) {
      toast.error("Failed to create invoice");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Invoice</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Purchase Order *
            </label>
            <select
              value={formData.poId}
              onChange={(e) => setFormData({ ...formData, poId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select a PO for this vendor</option>
              {purchaseOrders.map((po) => (
                <option key={po._id} value={po._id}>
                  {po.poNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date *
            </label>
            <input
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Invoice"}
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
    </div>
  );
}
