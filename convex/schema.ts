import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Companies (Tenants)
  companies: defineTable({
    name: v.string(),
    adminId: v.id("users"),
    createdAt: v.number(),
    branding: v.optional(v.object({
      logo: v.optional(v.id("_storage")),
      primaryColor: v.optional(v.string()),
      secondaryColor: v.optional(v.string()),
    })),
    settings: v.optional(v.object({
      requireApproval: v.boolean(),
      maxOrderValue: v.optional(v.number()),
      allowPersonalization: v.boolean(),
    })),
    isActive: v.boolean(),
  }).index("by_admin", ["adminId"]),

  // Company Members
  companyMembers: defineTable({
    companyId: v.id("companies"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("employee"), v.literal("manager")),
    orderLimit: v.number(),
    department: v.optional(v.string()),
    joinedAt: v.number(),
    isActive: v.boolean(),
  })
    .index("by_company", ["companyId"])
    .index("by_user", ["userId"])
    .index("by_company_and_user", ["companyId", "userId"])
    .index("by_department", ["companyId", "department"]),

  // Invitations
  invitations: defineTable({
    companyId: v.id("companies"),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("employee"), v.literal("manager")),
    orderLimit: v.number(),
    department: v.optional(v.string()),
    token: v.string(),
    expiresAt: v.number(),
    isUsed: v.boolean(),
  }).index("by_token", ["token"]),

  // Shirt Types
  shirtTypes: defineTable({
    companyId: v.id("companies"),
    name: v.string(),
    description: v.string(),
    category: v.string(),
    basePrice: v.number(),
    images: v.array(v.id("_storage")),
    isActive: v.boolean(),
    allowPersonalization: v.boolean(),
    personalizationOptions: v.optional(v.object({
      allowName: v.boolean(),
      allowTitle: v.boolean(),
      allowCustomText: v.boolean(),
      maxTextLength: v.number(),
    })),
  }).index("by_company", ["companyId"]),

  // Shirt Variants (colors, sleeve lengths, etc.)
  shirtVariants: defineTable({
    shirtTypeId: v.id("shirtTypes"),
    color: v.string(),
    colorHex: v.string(),
    sleeveLength: v.union(v.literal("short"), v.literal("long"), v.literal("sleeveless")),
    material: v.string(),
    priceModifier: v.number(),
    availableSizes: v.array(v.union(
      v.literal("XS"), v.literal("S"), v.literal("M"), 
      v.literal("L"), v.literal("XL"), v.literal("XXL")
    )),
    images: v.array(v.id("_storage")),
    isActive: v.boolean(),
  }).index("by_shirt_type", ["shirtTypeId"]),

  // Shopping Cart
  cartItems: defineTable({
    userId: v.id("users"),
    companyId: v.id("companies"),
    shirtTypeId: v.id("shirtTypes"),
    variantId: v.id("shirtVariants"),
    size: v.union(v.literal("XS"), v.literal("S"), v.literal("M"), v.literal("L"), v.literal("XL"), v.literal("XXL")),
    quantity: v.number(),
    personalization: v.optional(v.object({
      name: v.optional(v.string()),
      title: v.optional(v.string()),
      customText: v.optional(v.string()),
    })),
    addedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_company", ["userId", "companyId"]),

  // Orders
  orders: defineTable({
    companyId: v.id("companies"),
    userId: v.id("users"),
    orderNumber: v.string(),
    items: v.array(v.object({
      shirtTypeId: v.id("shirtTypes"),
      variantId: v.id("shirtVariants"),
      size: v.union(v.literal("XS"), v.literal("S"), v.literal("M"), v.literal("L"), v.literal("XL"), v.literal("XXL")),
      quantity: v.number(),
      unitPrice: v.number(),
      totalPrice: v.number(),
      personalization: v.optional(v.object({
        name: v.optional(v.string()),
        title: v.optional(v.string()),
        customText: v.optional(v.string()),
      })),
    })),
    totalAmount: v.number(),
    status: v.union(
      v.literal("pending_approval"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("confirmed"),
      v.literal("in_production"),
      v.literal("shipped"),
      v.literal("delivered"),
      v.literal("cancelled")
    ),
    approvalStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    )),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    rejectionReason: v.optional(v.string()),
    orderDate: v.number(),
    notes: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    carrier: v.optional(v.string()),
    estimatedDelivery: v.optional(v.number()),
  })
    .index("by_company", ["companyId"])
    .index("by_user", ["userId"])
    .index("by_company_and_status", ["companyId", "status"])
    .index("by_order_number", ["orderNumber"]),

  // Vendors
  vendors: defineTable({
    companyId: v.id("companies"),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    address: v.optional(v.object({
      street: v.string(),
      city: v.string(),
      state: v.string(),
      zipCode: v.string(),
      country: v.string(),
    })),
    capabilities: v.array(v.string()),
    isActive: v.boolean(),
  })
    .index("by_company", ["companyId"])
    .index("by_email", ["email"]),

  // Purchase Orders
  purchaseOrders: defineTable({
    companyId: v.id("companies"),
    vendorId: v.id("vendors"),
    orderIds: v.array(v.id("orders")),
    poNumber: v.string(),
    items: v.array(v.object({
      shirtTypeId: v.id("shirtTypes"),
      variantId: v.id("shirtVariants"),
      size: v.union(v.literal("XS"), v.literal("S"), v.literal("M"), v.literal("L"), v.literal("XL"), v.literal("XXL")),
      quantity: v.number(),
      unitPrice: v.number(),
      totalPrice: v.number(),
      personalization: v.optional(v.object({
        name: v.optional(v.string()),
        title: v.optional(v.string()),
        customText: v.optional(v.string()),
      })),
      status: v.union(
        v.literal("pending"),
        v.literal("art_proof"),
        v.literal("approved"),
        v.literal("in_production"),
        v.literal("completed")
      ),
    })),
    totalAmount: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("acknowledged"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    createdAt: v.number(),
    sentAt: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_company", ["companyId"])
    .index("by_vendor", ["vendorId"])
    .index("by_po_number", ["poNumber"]),

  // Invoices
  invoices: defineTable({
    vendorId: v.id("vendors"),
    companyId: v.id("companies"),
    purchaseOrderId: v.id("purchaseOrders"),
    invoiceNumber: v.string(),
    amount: v.number(),
    status: v.union(v.literal("draft"), v.literal("sent"), v.literal("paid")),
    createdAt: v.number(),
    dueDate: v.number(),
    paidAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    attachments: v.optional(v.array(v.id("_storage"))),
  })
    .index("by_company", ["companyId"])
    .index("by_vendor", ["vendorId"])
    .index("by_po", ["purchaseOrderId"]),

  // Shipments
  shipments: defineTable({
    companyId: v.id("companies"),
    vendorId: v.id("vendors"),
    purchaseOrderId: v.id("purchaseOrders"),
    orderIds: v.array(v.id("orders")),
    trackingNumber: v.string(),
    carrier: v.string(),
    status: v.union(
      v.literal("preparing"),
      v.literal("shipped"),
      v.literal("in_transit"),
      v.literal("delivered"),
      v.literal("exception")
    ),
    shippedAt: v.number(),
    estimatedDelivery: v.optional(v.number()),
    actualDelivery: v.optional(v.number()),
    items: v.array(v.object({
      shirtTypeId: v.id("shirtTypes"),
      variantId: v.id("shirtVariants"),
      size: v.union(v.literal("XS"), v.literal("S"), v.literal("M"), v.literal("L"), v.literal("XL"), v.literal("XXL")),
      quantity: v.number(),
    })),
  })
    .index("by_company", ["companyId"])
    .index("by_vendor", ["vendorId"])
    .index("by_tracking", ["trackingNumber"]),

  // Notifications
  notifications: defineTable({
    userId: v.id("users"),
    companyId: v.optional(v.id("companies")),
    type: v.union(
      v.literal("order_approved"),
      v.literal("order_rejected"),
      v.literal("order_shipped"),
      v.literal("order_delivered"),
      v.literal("approval_required"),
      v.literal("po_created"),
      v.literal("invoice_received")
    ),
    title: v.string(),
    message: v.string(),
    data: v.optional(v.object({
      orderId: v.optional(v.id("orders")),
      poId: v.optional(v.id("purchaseOrders")),
      invoiceId: v.optional(v.id("invoices")),
    })),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_unread", ["userId", "isRead"]),

  // Audit Logs
  auditLogs: defineTable({
    userId: v.id("users"),
    companyId: v.optional(v.id("companies")),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    oldValues: v.optional(v.any()),
    newValues: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_company", ["companyId"])
    .index("by_user", ["userId"])
    .index("by_entity", ["entityType", "entityId"])
    .index("by_timestamp", ["timestamp"]),

  // Super Admin Settings
  superAdminSettings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // System Users (Super Admins)
  systemUsers: defineTable({
    userId: v.id("users"),
    role: v.literal("super_admin"),
    permissions: v.array(v.string()),
    createdAt: v.number(),
    isActive: v.boolean(),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
