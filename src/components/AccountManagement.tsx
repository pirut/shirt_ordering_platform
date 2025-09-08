import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function AccountManagement() {
  const user = useQuery(api.auth.loggedInUser);
  const company = useQuery(api.companies.getUserCompany);
  const updateProfile = useMutation(api.auth.updateProfile);
  const updateCompany = useMutation(api.companies.updateCompany);

  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  const [companyData, setCompanyData] = useState({
    name: company?.name || "",
  });

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingCompany, setIsUpdatingCompany] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.name.trim()) return;

    setIsUpdatingProfile(true);
    try {
      await updateProfile({
        name: profileData.name.trim(),
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyData.name.trim() || !company?._id) return;

    setIsUpdatingCompany(true);
    try {
      await updateCompany({
        companyId: company._id,
        name: companyData.name.trim(),
      });
      toast.success("Company updated successfully!");
    } catch (error) {
      toast.error("Failed to update company");
      console.error(error);
    } finally {
      setIsUpdatingCompany(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Management</h1>
        <p className="text-gray-600">Manage your personal and company information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Information */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h2>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={profileData.email}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                disabled
                placeholder="Email cannot be changed"
              />
              <p className="text-xs text-gray-500 mt-1">Email address cannot be modified</p>
            </div>
            <button
              type="submit"
              disabled={isUpdatingProfile || !profileData.name.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingProfile ? "Updating..." : "Update Profile"}
            </button>
          </form>
        </div>

        {/* Company Information */}
        {company && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Company Information</h2>
            <form onSubmit={handleUpdateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={companyData.name}
                  onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter company name"
                  required
                  disabled={company.role !== "companyAdmin"}
                />
                {company.role !== "companyAdmin" && (
                  <p className="text-xs text-gray-500 mt-1">Only admins can modify company information</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Role
                </label>
                <input
                  type="text"
                  value={company.role === "companyAdmin" ? "Administrator" : "Employee"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  disabled
                />
              </div>
              {company.role === "employee" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Limit
                  </label>
                  <input
                    type="number"
                    value={company.orderLimit}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    disabled
                  />
                </div>
              )}
              {company.role === "companyAdmin" && (
                <button
                  type="submit"
                  disabled={isUpdatingCompany || !companyData.name.trim()}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingCompany ? "Updating..." : "Update Company"}
                </button>
              )}
            </form>
          </div>
        )}
      </div>

      {/* Account Statistics */}
      <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Account Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {new Date(user._creationTime).toLocaleDateString()}
            </div>
            <div className="text-sm text-gray-600">Member Since</div>
          </div>
          {company && (
            <>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {new Date(company._creationTime || 0).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-600">Company Joined</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 capitalize">
                  {company.role}
                </div>
                <div className="text-sm text-gray-600">Role</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
