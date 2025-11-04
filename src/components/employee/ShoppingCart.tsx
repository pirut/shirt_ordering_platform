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
  const [paymentSource, setPaymentSource] = useState<"company_budget" | "personal_payment">("personal_payment");
  
  const cartItems = useQuery(api.cart.getCartItems);
  const updateCartItem = useMutation(api.cart.updateCartItem);
  const removeFromCart = useMutation(api.cart.removeFromCart);
  const createOrder = useMutation(api.orders.createOrderFromCart);

  const totalAmount = cartItems?.reduce((sum, item) => {
    const basePrice = item.shirtType?.basePrice || 0;
    const priceModifier = item.variant?.priceModifier || 0;
    return sum + (basePrice + priceModifier) * item.quantity;
  }, 0) || 0;

  // Check budget availability for monthly budget
  const monthlyBudgetCheck = useQuery(
    api.budgets.checkBudgetAvailability,
    paymentSource === "company_budget" && totalAmount > 0
      ? { companyId, periodType: "monthly", orderAmount: totalAmount }
      : "skip"
  );

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
        paymentSource,
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
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900">Total:</span>
              <span className="text-xl font-bold text-blue-600">${totalAmount.toFixed(2)}</span>
            </div>

            {/* Payment Method Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentSource"
                    value="personal_payment"
                    checked={paymentSource === "personal_payment"}
                    onChange={() => setPaymentSource("personal_payment")}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Personal Payment</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentSource"
                    value="company_budget"
                    checked={paymentSource === "company_budget"}
                    onChange={() => setPaymentSource("company_budget")}
                    disabled={monthlyBudgetCheck?.available === false}
                    className="text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">
                    Company Budget
                    {monthlyBudgetCheck && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({monthlyBudgetCheck.available
                          ? `$${monthlyBudgetCheck.budget?.remaining.toFixed(2)} available`
                          : "Insufficient funds"})
                      </span>
                    )}
                  </span>
                </label>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Continue Shopping
              </button>
              <button
                onClick={handleCheckout}
                disabled={isCheckingOut || (paymentSource === "company_budget" && monthlyBudgetCheck?.available === false)}
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
