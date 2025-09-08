import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function CompanySetup() {
  const [formData, setFormData] = useState({
    userName: "",
    companyName: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const createCompany = useMutation(api.companies.createCompany);
  const updateProfile = useMutation(api.auth.updateProfile);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.userName.trim() || !formData.companyName.trim()) return;

    setIsLoading(true);
    try {
      // Update user profile first
      await updateProfile({
        name: formData.userName.trim(),
      });

      // Then create company
      await createCompany({
        name: formData.companyName.trim(),
      });

      toast.success("Account setup completed successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to setup account");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[600px] flex items-center justify-center p-8">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Complete Your Setup</h1>
          <p className="text-gray-600">
            Let's get your account and company set up so you can start managing shirt orders.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Full Name *
              </label>
              <input
                type="text"
                value={formData.userName}
                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your company name"
                required
              />
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">What happens next?</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• You'll be set up as the company administrator</li>
                <li>• You can invite employees and set their order limits</li>
                <li>• You can manage shirt catalogs and vendors</li>
                <li>• You can track all orders and their status</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={isLoading || !formData.userName.trim() || !formData.companyName.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Setting up..." : "Complete Setup"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
