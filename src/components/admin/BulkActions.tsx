import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface BulkActionsProps {
  selectedItems: string[];
  itemType: "orders" | "members";
  onClearSelection: () => void;
  onRefresh?: () => void;
}

export function BulkActions({ selectedItems, itemType, onClearSelection, onRefresh }: BulkActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const bulkUpdateOrderStatus = useMutation(api.orders.bulkUpdateOrderStatus);
  const bulkUpdateMemberLimits = useMutation(api.companies.bulkUpdateMemberLimits);

  if (selectedItems.length === 0) return null;

  const handleBulkAction = async (action: string, value?: any) => {
    if (selectedItems.length === 0) return;

    setIsLoading(true);
    try {
      if (itemType === "orders" && action.startsWith("status_")) {
        const status = action.replace("status_", "");
        await bulkUpdateOrderStatus({
          orderIds: selectedItems as Id<"orders">[],
          status: status as any,
        });
        toast.success(`Updated ${selectedItems.length} orders to ${status.replace("_", " ")}`);
      } else if (itemType === "members" && action === "update_limits") {
        await bulkUpdateMemberLimits({
          memberIds: selectedItems as Id<"companyMembers">[],
          orderLimit: value,
        });
        toast.success(`Updated order limits for ${selectedItems.length} members`);
      }

      onClearSelection();
      onRefresh?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to perform bulk action");
      console.error(error);
    } finally {
      setIsLoading(false);
      setShowConfirm(null);
    }
  };

  const orderActions = [
    { id: "status_confirmed", label: "Mark as Confirmed", icon: "✅" },
    { id: "status_in_production", label: "Mark as In Production", icon: "🏭" },
    { id: "status_completed", label: "Mark as Completed", icon: "📦" },
    { id: "status_cancelled", label: "Mark as Cancelled", icon: "❌" },
  ];

  return (
    <>
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg border p-4 z-50">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">
            {selectedItems.length} {itemType} selected
          </span>
          
          {itemType === "orders" && (
            <div className="flex space-x-2">
              {orderActions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => setShowConfirm(action.id)}
                  disabled={isLoading}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title={action.label}
                >
                  {action.icon}
                </button>
              ))}
            </div>
          )}

          {itemType === "members" && (
            <button
              onClick={() => setShowConfirm("update_limits")}
              disabled={isLoading}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Update Limits
            </button>
          )}

          <button
            onClick={onClearSelection}
            className="px-3 py-2 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <BulkActionConfirm
          action={showConfirm}
          itemCount={selectedItems.length}
          itemType={itemType}
          onConfirm={handleBulkAction}
          onCancel={() => setShowConfirm(null)}
          isLoading={isLoading}
        />
      )}
    </>
  );
}

function BulkActionConfirm({
  action,
  itemCount,
  itemType,
  onConfirm,
  onCancel,
  isLoading,
}: {
  action: string;
  itemCount: number;
  itemType: string;
  onConfirm: (action: string, value?: any) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [orderLimit, setOrderLimit] = useState(10);

  const getActionLabel = () => {
    if (action.startsWith("status_")) {
      return `Mark ${itemCount} orders as ${action.replace("status_", "").replace("_", " ")}`;
    }
    if (action === "update_limits") {
      return `Update order limits for ${itemCount} members`;
    }
    return "Perform bulk action";
  };

  const handleConfirm = () => {
    if (action === "update_limits") {
      onConfirm(action, orderLimit);
    } else {
      onConfirm(action);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Bulk Action</h3>
        
        <p className="text-gray-600 mb-6">
          Are you sure you want to {getActionLabel().toLowerCase()}?
        </p>

        {action === "update_limits" && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Order Limit
            </label>
            <input
              type="number"
              min="0"
              value={orderLimit}
              onChange={(e) => setOrderLimit(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Confirm"}
          </button>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
