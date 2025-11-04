import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface OrderShirtsProps {
  companyId: Id<"companies">;
  orderStats: {
    totalOrdered: number;
    orderLimit: number;
    remainingLimit: number;
    orders: number;
  } | null | undefined;
}

export function OrderShirts({ companyId, orderStats }: OrderShirtsProps) {
  const [selectedShirt, setSelectedShirt] = useState<any>(null);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [paymentSource, setPaymentSource] = useState<"company_budget" | "personal_payment">("personal_payment");
  const [isLoading, setIsLoading] = useState(false);

  const shirts = useQuery(api.shirts.getCompanyShirts, { companyId });
  const addToCart = useMutation(api.cart.addToCart);
  const createOrder = useMutation(api.orders.createOrderFromCart);

  const totalPrice = selectedShirt && selectedVariant 
    ? (selectedShirt.basePrice + selectedVariant.priceModifier) * quantity 
    : 0;

  // Check budget availability for monthly budget
  const monthlyBudgetCheck = useQuery(
    api.budgets.checkBudgetAvailability,
    paymentSource === "company_budget" && totalPrice > 0
      ? { companyId, periodType: "monthly", orderAmount: totalPrice }
      : "skip"
  );

  const handleShirtSelect = (shirt: any) => {
    setSelectedShirt(shirt);
    setSelectedVariant(null);
    setSelectedSize("");
  };

  const handleVariantSelect = (variant: any) => {
    setSelectedVariant(variant);
    setSelectedSize("");
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShirt || !selectedVariant || !selectedSize) return;

    // Check if order would exceed limit
    if (orderStats && orderStats.remainingLimit < quantity) {
      toast.error(`Order exceeds your remaining limit of ${orderStats.remainingLimit} items`);
      return;
    }

    setIsLoading(true);
    try {
      // Add to cart first
      await addToCart({
        companyId,
        shirtTypeId: selectedShirt._id,
        variantId: selectedVariant._id,
        size: selectedSize as any,
        quantity,
        personalization: notes ? { customText: notes } : undefined,
      });

      // Then create order from cart
      await createOrder({
        companyId,
        paymentSource,
        notes: notes || undefined,
      });
      toast.success("Order placed successfully!");
      
      // Reset form
      setSelectedShirt(null);
      setSelectedVariant(null);
      setSelectedSize("");
      setQuantity(1);
      setNotes("");
    } catch (error: any) {
      toast.error(error.message || "Failed to place order");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Shirts</h1>
        <p className="text-gray-600">Select from available shirt options and place your order</p>
        
        {orderStats && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Order Limit:</strong> {orderStats.remainingLimit} items remaining 
              ({orderStats.totalOrdered} of {orderStats.orderLimit} used)
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Step 1: Select Shirt Type */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">1. Choose Shirt Type</h2>
          <div className="space-y-3">
            {shirts?.map((shirt) => (
              <button
                key={shirt._id}
                onClick={() => handleShirtSelect(shirt)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedShirt?._id === shirt._id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <h3 className="font-medium text-gray-900">{shirt.name}</h3>
                {shirt.description && (
                  <p className="text-sm text-gray-600 mt-1">{shirt.description}</p>
                )}
                <p className="text-sm font-medium text-green-600 mt-2">
                  Starting at ${shirt.basePrice}
                </p>
              </button>
            ))}
          </div>
          
          {shirts?.length === 0 && (
            <p className="text-gray-500 text-center py-8">No shirts available</p>
          )}
        </div>

        {/* Step 2: Select Variant */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">2. Choose Variant</h2>
          {selectedShirt ? (
            <div className="space-y-3">
              {selectedShirt.variants.map((variant: any) => (
                <button
                  key={variant._id}
                  onClick={() => handleVariantSelect(variant)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedVariant?._id === variant._id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <h3 className="font-medium text-gray-900">
                    {variant.color} - {variant.sleeveLength}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Sizes: {variant.availableSizes.join(", ")}
                  </p>
                  <p className="text-sm font-medium text-green-600 mt-2">
                    ${selectedShirt.basePrice + variant.priceModifier}
                  </p>
                </button>
              ))}
              
              {selectedShirt.variants.length === 0 && (
                <p className="text-gray-500 text-center py-8">No variants available</p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Select a shirt type first</p>
          )}
        </div>

        {/* Step 3: Order Details */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Order Details</h2>
          {selectedVariant ? (
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size *
                </label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select size</option>
                  {selectedVariant.availableSizes.map((size: string) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  max={orderStats?.remainingLimit || 999}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                {orderStats && quantity > orderStats.remainingLimit && (
                  <p className="text-red-600 text-sm mt-1">
                    Exceeds remaining limit of {orderStats.remainingLimit}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Any special requests..."
                />
              </div>

              {/* Payment Method Selection */}
              <div>
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

              {totalPrice > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-gray-900">Total Price:</span>
                    <span className="text-xl font-bold text-green-600">${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !selectedSize ||
                  Boolean(orderStats && quantity > orderStats.remainingLimit) ||
                  (paymentSource === "company_budget" && monthlyBudgetCheck?.available === false)
                }
                className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Placing Order..." : "Place Order"}
              </button>
            </form>
          ) : (
            <p className="text-gray-500 text-center py-8">Select a variant first</p>
          )}
        </div>
      </div>
    </div>
  );
}
