import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Minimal seed to create: 1 super admin, 1 tenant, 1 vendor,
// 3 catalog items, 3 users, 1 draft order, 1 approved order,
// 1 PO, 1 invoice, 1 shipment.

export const seedAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Super admin user
    const superAdminUserId = await ctx.db.insert("users", {
      name: "Super Admin",
      email: "super+admin@example.com",
    } as any);
    await ctx.db.insert("systemUsers", {
      userId: superAdminUserId,
      role: "super_admin",
      permissions: ["*"],
      createdAt: now,
      isActive: true,
    });

    // Company + company admin
    const companyAdminId = await ctx.db.insert("users", {
      name: "Company Admin",
      email: "admin@example.com",
    } as any);
    const companyId = await ctx.db.insert("companies", {
      name: "Acme Corp",
      adminId: companyAdminId,
      createdAt: now,
      isActive: true,
    });
    await ctx.db.insert("companyMembers", {
      companyId,
      userId: companyAdminId,
      role: "companyAdmin",
      orderLimit: 0,
      department: "Operations",
      joinedAt: now,
      isActive: true,
    });

    // Employees
    const employeeIds: any[] = [];
    for (const [i, name] of ["Alice", "Bob"].entries()) {
      const uid = await ctx.db.insert("users", {
        name,
        email: `${name.toLowerCase()}@example.com`,
      } as any);
      employeeIds.push(uid);
      await ctx.db.insert("companyMembers", {
        companyId,
        userId: uid,
        role: "employee",
        orderLimit: 1000,
        department: i === 0 ? "Engineering" : "Design",
        joinedAt: now,
        isActive: true,
      });
    }

    // Vendor + vendor member (maps Company Admin as vendor contact for demo)
    const vendorId = await ctx.db.insert("vendors", {
      companyId,
      name: "StitchWorks",
      email: "vendor@example.com",
      capabilities: ["embroidery"],
      isActive: true,
    } as any);
    const vendorUserId = await ctx.db.insert("users", {
      name: "Vendor User",
      email: "vendor.user@example.com",
    } as any);
    await ctx.db.insert("vendorMembers", {
      vendorId,
      userId: vendorUserId,
      createdAt: now,
      isActive: true,
    });

    // Shirts (catalog)
    const shirtTypeIds: any[] = [];
    for (const [title, price] of [
      ["Classic Tee", 20],
      ["Polo Shirt", 35],
      ["Hoodie", 55],
    ] as const) {
      const st = await ctx.db.insert("shirtTypes", {
        companyId,
        name: title,
        description: `${title} description`,
        category: "Standard",
        basePrice: price,
        images: [],
        isActive: true,
        allowPersonalization: true,
      });
      shirtTypeIds.push(st);
      await ctx.db.insert("shirtVariants", {
        shirtTypeId: st,
        color: "Navy",
        colorHex: "#001f3f",
        sleeveLength: "short",
        material: "Cotton",
        priceModifier: 0,
        availableSizes: ["S", "M", "L", "XL"],
        images: [],
        isActive: true,
      });
    }

    // Draft order for Alice
    const draftOrderId = await ctx.db.insert("orders", {
      companyId,
      userId: employeeIds[0],
      orderNumber: `ORD-${now}-1`,
      items: [
        {
          shirtTypeId: shirtTypeIds[0],
          variantId: (await ctx.db
            .query("shirtVariants")
            .withIndex("by_shirt_type", (q) => q.eq("shirtTypeId", shirtTypeIds[0]))
            .first())!._id,
          size: "M",
          quantity: 1,
          unitPrice: 20,
          totalPrice: 20,
        },
      ],
      totalAmount: 20,
      status: "pending_approval",
      orderDate: now,
    });

    // Approved order for Bob
    const approvedOrderId = await ctx.db.insert("orders", {
      companyId,
      userId: employeeIds[1],
      orderNumber: `ORD-${now}-2`,
      items: [
        {
          shirtTypeId: shirtTypeIds[1],
          variantId: (await ctx.db
            .query("shirtVariants")
            .withIndex("by_shirt_type", (q) => q.eq("shirtTypeId", shirtTypeIds[1]))
            .first())!._id,
          size: "L",
          quantity: 2,
          unitPrice: 35,
          totalPrice: 70,
        },
      ],
      totalAmount: 70,
      status: "approved",
      approvalStatus: "approved",
      approvedBy: companyAdminId,
      approvedAt: now,
      orderDate: now,
    });

    // PO for approved order
    const poId = await ctx.db.insert("purchaseOrders", {
      companyId,
      vendorId,
      orderIds: [approvedOrderId],
      poNumber: `PO-${now}`,
      items: [
        {
          shirtTypeId: shirtTypeIds[1],
          variantId: (await ctx.db
            .query("shirtVariants")
            .withIndex("by_shirt_type", (q) => q.eq("shirtTypeId", shirtTypeIds[1]))
            .first())!._id,
          size: "L",
          quantity: 2,
          unitPrice: 35,
          totalPrice: 70,
          status: "pending",
        },
      ],
      totalAmount: 70,
      status: "sent",
      createdAt: now,
      sentAt: now,
    });

    // Invoice for PO
    const invoiceId = await ctx.db.insert("invoices", {
      vendorId,
      companyId,
      purchaseOrderId: poId,
      invoiceNumber: `INV-${now}`,
      amount: 70,
      status: "draft",
      createdAt: now,
      dueDate: now + 14 * 24 * 60 * 60 * 1000,
    });

    // Shipment
    await ctx.db.insert("shipments", {
      companyId,
      vendorId,
      purchaseOrderId: poId,
      orderIds: [approvedOrderId],
      trackingNumber: `TRACK-${now}`,
      carrier: "UPS",
      status: "shipped",
      shippedAt: now,
      items: [
        {
          shirtTypeId: shirtTypeIds[1],
          variantId: (await ctx.db
            .query("shirtVariants")
            .withIndex("by_shirt_type", (q) => q.eq("shirtTypeId", shirtTypeIds[1]))
            .first())!._id,
          size: "L",
          quantity: 2,
        },
      ],
    });

    return {
      superAdminUserId,
      companyId,
      vendorId,
      users: [companyAdminId, ...employeeIds, vendorUserId],
      shirtTypeIds,
      orders: { draftOrderId, approvedOrderId },
      poId,
      invoiceId,
    };
  },
});

