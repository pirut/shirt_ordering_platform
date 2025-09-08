import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";
import { BulkActions } from "./BulkActions";

interface TeamManagementProps {
  companyId: Id<"companies">;
}

export function TeamManagement({ companyId }: TeamManagementProps) {
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [newOrderLimit, setNewOrderLimit] = useState(10);

  const members = useQuery(api.companies.getCompanyMembers, { companyId });
  const inviteEmployee = useMutation(api.companies.inviteEmployee);
  const updateMemberOrderLimit = useMutation(api.companies.updateMemberOrderLimit);

  const handleSelectMember = (memberId: string) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMembers.length === members?.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members?.map(m => m._id) || []);
    }
  };

  const handleUpdateOrderLimit = async (memberId: string, orderLimit: number) => {
    try {
      await updateMemberOrderLimit({
        memberId: memberId as Id<"companyMembers">,
        orderLimit,
      });
      toast.success("Order limit updated successfully!");
      setEditingMember(null);
    } catch (error) {
      toast.error("Failed to update order limit");
      console.error(error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Management</h1>
          <p className="text-gray-600">Manage your team members and their order limits</p>
        </div>
        <button
          onClick={() => setShowInviteForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Invite Employee
        </button>
      </div>

      {/* Invite Form */}
      {showInviteForm && (
        <InviteEmployeeForm
          companyId={companyId}
          onSubmit={inviteEmployee}
          onCancel={() => setShowInviteForm(false)}
        />
      )}

      {/* Team Members */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          {members && members.length > 0 && (
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedMembers.length === members.length}
                onChange={handleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Select All</span>
            </label>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Select
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Limit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members?.map((member) => (
                <tr key={member._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member._id)}
                      onChange={() => handleSelectMember(member._id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                        <span className="text-blue-600 font-semibold">
                          {member.user?.name?.charAt(0) || member.user?.email?.charAt(0) || "U"}
                        </span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {member.user?.name || "No name"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {member.user?.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      member.role === "companyAdmin" 
                        ? "bg-purple-100 text-purple-800" 
                        : "bg-green-100 text-green-800"
                    }`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingMember === member._id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          min="0"
                          value={newOrderLimit}
                          onChange={(e) => setNewOrderLimit(parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          onClick={() => handleUpdateOrderLimit(member._id, newOrderLimit)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMember(null)}
                          className="px-2 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-900">
                          {member.role === "companyAdmin" ? "Unlimited" : member.orderLimit}
                        </span>
                        {member.role === "employee" && (
                          <button
                            onClick={() => {
                              setEditingMember(member._id);
                              setNewOrderLimit(member.orderLimit);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-800 mr-3">
                      View Orders
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {members?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No team members yet</p>
          <p className="text-gray-400 text-sm mt-1">Invite employees to get started</p>
        </div>
      )}

      {/* Bulk Actions */}
      <BulkActions
        selectedItems={selectedMembers}
        itemType="members"
        onClearSelection={() => setSelectedMembers([])}
        onRefresh={() => {
          // Refresh will happen automatically via Convex reactivity
        }}
      />
    </div>
  );
}

function InviteEmployeeForm({ 
  companyId, 
  onSubmit, 
  onCancel 
}: { 
  companyId: Id<"companies">;
  onSubmit: any;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    email: "",
    orderLimit: 10,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;

    setIsLoading(true);
    try {
      const token = await onSubmit({
        companyId,
        email: formData.email,
        orderLimit: formData.orderLimit,
      });
      
      // Show invitation link
      const inviteUrl = `${window.location.origin}/invite/${token}`;
      navigator.clipboard.writeText(inviteUrl);
      
      toast.success("Invitation created! Link copied to clipboard.");
      onCancel();
    } catch (error) {
      toast.error("Failed to create invitation");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite Employee</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="employee@company.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Limit *
            </label>
            <input
              type="number"
              min="1"
              value={formData.orderLimit}
              onChange={(e) => setFormData({ ...formData, orderLimit: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Create Invitation"}
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
