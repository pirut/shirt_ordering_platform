import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logAudit } from "./util/audit";
import { ensureCompanyAdmin } from "./util/rbac";

export const createShirtType = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
    description: v.optional(v.string()),
    basePrice: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    await ensureCompanyAdmin(ctx, String(args.companyId));

    const id = await ctx.db.insert("shirtTypes", {
      companyId: args.companyId,
      name: args.name,
      description: args.description || "",
      category: "Standard",
      basePrice: args.basePrice,
      images: [],
      isActive: true,
      allowPersonalization: false,
    });
    await logAudit(ctx, {
      action: "create_shirt_type",
      entityType: "shirtType",
      entityId: String(id),
      companyId: String(args.companyId),
      newValues: { name: args.name, basePrice: args.basePrice },
    });
    return id;
  },
});

export const createShirtVariant = mutation({
  args: {
    shirtTypeId: v.id("shirtTypes"),
    sleeveLength: v.union(v.literal("short"), v.literal("long"), v.literal("sleeveless")),
    color: v.string(),
    availableSizes: v.array(v.union(
      v.literal("XS"), v.literal("S"), v.literal("M"), 
      v.literal("L"), v.literal("XL"), v.literal("XXL")
    )),
    priceModifier: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const shirtType = await ctx.db.get(args.shirtTypeId);
    if (!shirtType) {
      throw new Error("Shirt type not found");
    }

    await ensureCompanyAdmin(ctx, String(shirtType.companyId));

    const id = await ctx.db.insert("shirtVariants", {
      shirtTypeId: args.shirtTypeId,
      sleeveLength: args.sleeveLength,
      color: args.color,
      colorHex: "#000000",
      material: "Cotton",
      availableSizes: args.availableSizes,
      priceModifier: args.priceModifier,
      images: [],
      isActive: true,
    });
    await logAudit(ctx, {
      action: "create_shirt_variant",
      entityType: "shirtVariant",
      entityId: String(id),
      companyId: String(shirtType.companyId),
      newValues: { color: args.color, sleeveLength: args.sleeveLength },
    });
    return id;
  },
});

export const getCompanyShirts = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is member of company
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not authorized");
    }

    const shirtTypes = await ctx.db
      .query("shirtTypes")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const shirtsWithVariants = await Promise.all(
      shirtTypes.map(async (shirtType) => {
        const variants = await ctx.db
          .query("shirtVariants")
          .withIndex("by_shirt_type", (q) => q.eq("shirtTypeId", shirtType._id))
          .collect();
        
        return {
          ...shirtType,
          variants,
        };
      })
    );

    return shirtsWithVariants;
  },
});

export const updateShirtType = mutation({
  args: {
    shirtTypeId: v.id("shirtTypes"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    basePrice: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const shirtType = await ctx.db.get(args.shirtTypeId);
    if (!shirtType) {
      throw new Error("Shirt type not found");
    }

    await ensureCompanyAdmin(ctx, String(shirtType.companyId));

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.basePrice !== undefined) updates.basePrice = args.basePrice;
    if (args.isActive !== undefined) updates.isActive = args.isActive;

    await ctx.db.patch(args.shirtTypeId, updates);
    await logAudit(ctx, {
      action: "update_shirt_type",
      entityType: "shirtType",
      entityId: String(args.shirtTypeId),
      companyId: String(shirtType.companyId),
      newValues: updates,
    });
  },
});
