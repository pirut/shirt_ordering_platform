interface MyOrdersProps {
  orders: any[];
}

export function MyOrders({ orders }: MyOrdersProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "in_production":
        return "bg-orange-100 text-orange-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "confirmed":
        return "✅";
      case "in_production":
        return "🏭";
      case "completed":
        return "📦";
      case "cancelled":
        return "❌";
      default:
        return "📋";
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Orders</h1>
        <p className="text-gray-600">Track all your shirt orders and their status</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">👕</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h3>
          <p className="text-gray-600 mb-6">You haven't placed any shirt orders yet.</p>
          <p className="text-sm text-gray-500">Go to the "Order Shirts" tab to place your first order!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order._id} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">{getStatusIcon(order.status)}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {order.shirtType?.name}
                    </h3>
                    <p className="text-gray-600">
                      {order.variant?.color} • {order.variant?.sleeveLength} • Size {order.size}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Ordered on {new Date(order.orderDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">${order.totalAmount || order.totalPrice}</p>
                  <div className="flex flex-col items-end space-y-1 mt-2">
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(order.status)}`}>
                      {order.status.replace("_", " ")}
                    </span>
                    {order.paymentSource && (
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.paymentSource === "company_budget"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}>
                        {order.paymentSource === "company_budget" ? "💰 Company Budget" : "💳 Personal Payment"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm font-medium text-gray-700">Quantity</p>
                  <p className="text-lg font-semibold text-gray-900">{order.quantity}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Unit Price</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ${((order.shirtType?.basePrice || 0) + (order.variant?.priceModifier || 0)).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Order Status</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-lg">{getStatusIcon(order.status)}</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-gray-700 mb-1">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {order.notes}
                  </p>
                </div>
              )}

              {/* Order Progress */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-medium text-gray-700 mb-3">Order Progress</p>
                <div className="flex items-center space-x-2">
                  {["pending", "confirmed", "in_production", "completed"].map((status, index) => {
                    const isActive = ["pending", "confirmed", "in_production", "completed"].indexOf(order.status) >= index;
                    const isCurrent = order.status === status;
                    
                    return (
                      <div key={status} className="flex items-center">
                        <div className={`w-3 h-3 rounded-full ${
                          isCurrent ? "bg-blue-600" :
                          isActive ? "bg-green-500" : "bg-gray-300"
                        }`}></div>
                        {index < 3 && (
                          <div className={`w-8 h-0.5 ${
                            isActive ? "bg-green-500" : "bg-gray-300"
                          }`}></div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Pending</span>
                  <span>Confirmed</span>
                  <span>Production</span>
                  <span>Completed</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
