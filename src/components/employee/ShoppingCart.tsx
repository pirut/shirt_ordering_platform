import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface ShoppingCartProps {
  companyId: Id<"companies">;
  onClose: () => void;
}

export function ShoppingCart({ companyId, onClose }: ShoppingCartProps) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentType, setPaymentType] = useState<"company_budget" | "personal_payment">("company_budget");
  
  const cartItems = useQuery(api.cart.getCartItems);
  const employeeBudget = useQuery(api.budgets.getEmployeeBudget, {});
  const updateCartItem = useMutation(api.cart.updateCartItem);
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const createOrder = useMutation(api.orders.createOrderFromCart);

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    try {
      await updateCartItem({
        itemId: itemId as Id<"cartItems">,
        quantity: newQuantity,
      });
    } catch (error) {
      toast.error("Failed to update quantity");
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await removeFromCart({
        itemId: itemId as Id<"cartItems">,
      });
      toast.success("Item removed from cart");
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  const handleCheckout = async () => {
    if (!cartItems || cartItems.length === 0) return;

    setIsCheckingOut(true);
    try {
      const orderId = await createOrder({
        companyId,
        paymentType,
        notes: "Order placed from shopping cart",
      });
      
      toast.success("Order placed successfully!");
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const totalAmount = cartItems?.reduce((sum, item) => {
    const basePrice = item.shirtType?.basePrice || 0;
    const priceModifier = item.variant?.priceModifier || 0;
    return sum + (basePrice + priceModifier) * item.quantity;
  }, 0) || 0;

  if (!cartItems) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Shopping Cart</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">Your cart is empty</p>
              <p className="text-gray-400 text-sm mt-1">Add some items to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cartItems.map((item) => (
                <div key={item._id} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500 text-xs">IMG</span>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{item.shirtType?.name}</h3>
                    <p className="text-sm text-gray-500">
                      {item.variant?.color} - {item.variant?.sleeveLength} - {item.size}
                    </p>
                    {item.personalization && (
                      <div className="text-xs text-blue-600 mt-1">
                        {item.personalization.name && `Name: ${item.personalization.name}`}
                        {item.personalization.title && ` | Title: ${item.personalization.title}`}
                        {item.personalization.customText && ` | Text: ${item.personalization.customText}`}
                      </div>
                    )}
                    <p className="text-sm font-medium text-gray-900 mt-1">
                      ${((item.shirtType?.basePrice || 0) + (item.variant?.priceModifier || 0)).toFixed(2)} each
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleQuantityChange(item._id, item.quantity - 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                      disabled={item.quantity <= 1}
                    >
                      -
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleQuantityChange(item._id, item.quantity + 1)}
                      className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemoveItem(item._id)}
                    className="text-red-600 hover:text-red-800 p-2"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="border-t p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method *
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentType"
                    value="company_budget"
                    checked={paymentType === "company_budget"}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Use Company Budget</span>
                    {employeeBudget && (
                      <p className="text-xs text-gray-500 mt-1">
                        Remaining: ${employeeBudget.remainingAmount.toFixed(2)}
                      </p>
                    )}
                  </div>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentType"
                    value="personal_payment"
                    checked={paymentType === "personal_payment"}
                    onChange={(e) => setPaymentType(e.target.value as any)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Pay with Personal Payment</span>
                    <p className="text-xs text-gray-500 mt-1">
                      You will be charged ${totalAmount.toFixed(2)}
                    </p>
                  </div>
                </label>
              </div>
              {paymentType === "company_budget" && employeeBudget && totalAmount > employeeBudget.remainingAmount && (
                <p className="text-red-600 text-sm mt-2">
                  ⚠️ Order exceeds remaining budget. Consider using personal payment.
                </p>
              )}
            </div>

            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900">Total:</span>
              <span className="text-xl font-bold text-blue-600">${totalAmount.toFixed(2)}</span>
            </div>
            {paymentType === "company_budget" && employeeBudget && (
              <div className="mb-4 text-sm text-gray-600">
                <p>Budget Remaining: ${employeeBudget.remainingAmount.toFixed(2)}</p>
                <p className="mt-1">
                  After Order: ${(employeeBudget.remainingAmount - totalAmount).toFixed(2)}
                </p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Continue Shopping
              </button>
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut || (paymentType === "company_budget" && employeeBudget && totalAmount > employeeBudget.remainingAmount)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isCheckingOut ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
