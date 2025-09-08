import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

export function VendorPurchaseOrders() {
  const [selectedPO, setSelectedPO] = useState<string | null>(null);
  
  const purchaseOrders = useQuery(api.purchaseOrders.getVendorPOs);
  const updatePOItemStatus = useMutation(api.purchaseOrders.updatePOItemStatus);

  const handleStatusUpdate = async (poId: string, itemIndex: number, newStatus: string) => {
    try {
      await updatePOItemStatus({
        poId: poId as Id<"purchaseOrders">,
        itemIndex,
        status: newStatus as any,
      });
      toast.success("Item status updated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  if (!purchaseOrders) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Purchase Orders</h1>
          <p className="text-gray-600">Manage your assigned purchase orders</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PO List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Purchase Orders ({purchaseOrders.length})
              </h2>
            </div>
            <div className="divide-y divide-gray-200">
              {purchaseOrders.map((po) => (
                <div
                  key={po._id}
                  onClick={() => setSelectedPO(po._id)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedPO === po._id ? "bg-blue-50 border-r-4 border-blue-500" : ""
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">{po.poNumber}</div>
                      <div className="text-sm text-gray-500">{po.company?.name}</div>
                      <div className="text-sm font-medium text-gray-900 mt-1">
                        ${po.totalAmount.toFixed(2)}
                      </div>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      po.status === "completed" ? "bg-green-100 text-green-800" :
                      po.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                      po.status === "sent" ? "bg-yellow-100 text-yellow-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {po.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(po.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PO Details */}
        <div className="lg:col-span-2">
          {selectedPO ? (
            <PODetails
              po={purchaseOrders.find(p => p._id === selectedPO)!}
              onStatusUpdate={handleStatusUpdate}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500">Select a purchase order to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PODetails({ 
  po, 
  onStatusUpdate 
}: { 
  po: any;
  onStatusUpdate: (poId: string, itemIndex: number, status: string) => void;
}) {
  const statusOptions = [
    { value: "pending", label: "Pending" },
    { value: "art_proof", label: "Art Proof" },
    { value: "approved", label: "Approved" },
    { value: "in_production", label: "In Production" },
    { value: "completed", label: "Completed" },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{po.poNumber}</h2>
            <p className="text-gray-600">{po.company?.name}</p>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
            po.status === "completed" ? "bg-green-100 text-green-800" :
            po.status === "in_progress" ? "bg-blue-100 text-blue-800" :
            po.status === "sent" ? "bg-yellow-100 text-yellow-800" :
            "bg-gray-100 text-gray-800"
          }`}>
            {po.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Created Date</label>
            <div className="text-sm text-gray-900">{new Date(po.createdAt).toLocaleDateString()}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Total Amount</label>
            <div className="text-sm font-medium text-gray-900">${po.totalAmount.toFixed(2)}</div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Items</h3>
          <div className="space-y-4">
            {po.items.map((item: any, index: number) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium text-gray-900">Item #{index + 1}</div>
                    <div className="text-sm text-gray-500">
                      Size: {item.size} | Quantity: {item.quantity}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      ${item.totalPrice.toFixed(2)}
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.status === "completed" ? "bg-green-100 text-green-800" :
                    item.status === "in_production" ? "bg-blue-100 text-blue-800" :
                    item.status === "approved" ? "bg-purple-100 text-purple-800" :
                    item.status === "art_proof" ? "bg-orange-100 text-orange-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>

                {item.personalization && (
                  <div className="text-xs text-blue-600 mb-3">
                    {item.personalization.name && `Name: ${item.personalization.name}`}
                    {item.personalization.title && ` | Title: ${item.personalization.title}`}
                    {item.personalization.customText && ` | Text: ${item.personalization.customText}`}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Update Status
                  </label>
                  <select
                    value={item.status}
                    onChange={(e) => onStatusUpdate(po._id, index, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        {po.notes && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
              {po.notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
