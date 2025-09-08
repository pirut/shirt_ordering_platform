import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface ShirtManagementProps {
  companyId: Id<"companies">;
}

export function ShirtManagement({ companyId }: ShirtManagementProps) {
  const [showAddShirt, setShowAddShirt] = useState(false);
  const [showAddVariant, setShowAddVariant] = useState<string | null>(null);
  
  const shirts = useQuery(api.shirts.getCompanyShirts, { companyId });
  const createShirtType = useMutation(api.shirts.createShirtType);
  const createShirtVariant = useMutation(api.shirts.createShirtVariant);

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Shirt Catalog</h1>
          <p className="text-gray-600">Manage your company's shirt types and variants</p>
        </div>
        <button
          onClick={() => setShowAddShirt(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Shirt Type
        </button>
      </div>

      {/* Add Shirt Form */}
      {showAddShirt && (
        <AddShirtForm
          companyId={companyId}
          onSubmit={createShirtType}
          onCancel={() => setShowAddShirt(false)}
        />
      )}

      {/* Shirts List */}
      <div className="space-y-6">
        {shirts?.map((shirt) => (
          <div key={shirt._id} className="bg-white rounded-lg shadow-sm border">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{shirt.name}</h3>
                  {shirt.description && (
                    <p className="text-gray-600 mt-1">{shirt.description}</p>
                  )}
                  <p className="text-lg font-medium text-green-600 mt-2">
                    Base Price: ${shirt.basePrice}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddVariant(shirt._id)}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                >
                  Add Variant
                </button>
              </div>

              {/* Variants */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Variants:</h4>
                {shirt.variants.length === 0 ? (
                  <p className="text-gray-500 italic">No variants added yet</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {shirt.variants.map((variant) => (
                      <div key={variant._id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-medium text-gray-900">
                            {variant.color} - {variant.sleeveLength}
                          </h5>
                          <span className="text-sm font-medium text-green-600">
                            +${variant.priceModifier}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p>Sizes: {variant.availableSizes.join(", ")}</p>
                          <p className="mt-1">
                            Total: ${shirt.basePrice + variant.priceModifier}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Variant Form */}
              {showAddVariant === shirt._id && (
                <div className="mt-4 pt-4 border-t">
                  <AddVariantForm
                    shirtTypeId={shirt._id as Id<"shirtTypes">}
                    onSubmit={createShirtVariant}
                    onCancel={() => setShowAddVariant(null)}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {shirts?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No shirt types added yet</p>
          <p className="text-gray-400 mt-2">Add your first shirt type to get started</p>
        </div>
      )}
    </div>
  );
}

function AddShirtForm({ 
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
    description: "",
    basePrice: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.basePrice) return;

    setIsLoading(true);
    try {
      await onSubmit({
        companyId,
        name: formData.name,
        description: formData.description || undefined,
        basePrice: parseFloat(formData.basePrice),
      });
      toast.success("Shirt type created successfully!");
      onCancel();
    } catch (error) {
      toast.error("Failed to create shirt type");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Shirt Type</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shirt Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Classic T-Shirt"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Base Price *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.basePrice}
              onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Optional description..."
          />
        </div>
        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Shirt Type"}
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

function AddVariantForm({ 
  shirtTypeId, 
  onSubmit, 
  onCancel 
}: { 
  shirtTypeId: Id<"shirtTypes">;
  onSubmit: any;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    sleeveLength: "short" as "short" | "long" | "sleeveless",
    color: "",
    priceModifier: "",
    availableSizes: [] as string[],
  });
  const [isLoading, setIsLoading] = useState(false);

  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

  const handleSizeToggle = (size: string) => {
    setFormData(prev => ({
      ...prev,
      availableSizes: prev.availableSizes.includes(size)
        ? prev.availableSizes.filter(s => s !== size)
        : [...prev.availableSizes, size]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.color || formData.availableSizes.length === 0) return;

    setIsLoading(true);
    try {
      await onSubmit({
        shirtTypeId,
        sleeveLength: formData.sleeveLength,
        color: formData.color,
        availableSizes: formData.availableSizes,
        priceModifier: parseFloat(formData.priceModifier) || 0,
      });
      toast.success("Variant created successfully!");
      onCancel();
    } catch (error) {
      toast.error("Failed to create variant");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-4">Add New Variant</h4>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sleeve Length
            </label>
            <select
              value={formData.sleeveLength}
              onChange={(e) => setFormData({ ...formData, sleeveLength: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="short">Short Sleeve</option>
              <option value="long">Long Sleeve</option>
              <option value="sleeveless">Sleeveless</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color *
            </label>
            <input
              type="text"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Navy Blue"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price Modifier
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.priceModifier}
              onChange={(e) => setFormData({ ...formData, priceModifier: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Available Sizes *
          </label>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handleSizeToggle(size)}
                className={`px-3 py-1 rounded-lg border transition-colors ${
                  formData.availableSizes.includes(size)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isLoading || !formData.color || formData.availableSizes.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Add Variant"}
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
