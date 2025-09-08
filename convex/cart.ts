import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logAudit } from "./util/audit";

export const addToCart = mutation({
  args: {
    shirtTypeId: v.id("shirtTypes"),
    variantId: v.id("shirtVariants"),
    size: v.union(v.literal("XS"), v.literal("S"), v.literal("M"), v.literal("L"), v.literal("XL"), v.literal("XXL")),
    quantity: v.number(),
    personalization: v.optional(v.object({
      name: v.optional(v.string()),
      title: v.optional(v.string()),
      customText: v.optional(v.string()),
    })),
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

    // Check if user is member of company
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", shirtType.companyId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      throw new Error("Not authorized");
    }

    // Check if item already exists in cart
    const existingItem = await ctx.db
      .query("cartItems")
      .withIndex("by_user_and_company", (q) => 
        q.eq("userId", userId).eq("companyId", shirtType.companyId)
      )
      .filter((q) => 
        q.and(
          q.eq(q.field("shirtTypeId"), args.shirtTypeId),
          q.eq(q.field("variantId"), args.variantId),
          q.eq(q.field("size"), args.size)
        )
      )
      .first();

    if (existingItem) {
      // Update quantity
      await ctx.db.patch(existingItem._id, {
        quantity: existingItem.quantity + args.quantity,
      });
      return existingItem._id;
    } else {
      // Add new item
      const id = await ctx.db.insert("cartItems", {
        userId,
        companyId: shirtType.companyId,
        shirtTypeId: args.shirtTypeId,
        variantId: args.variantId,
        size: args.size,
        quantity: args.quantity,
        personalization: args.personalization,
        addedAt: Date.now(),
      });
      await logAudit(ctx, {
        action: "add_to_cart",
        entityType: "cartItem",
        entityId: String(id),
        companyId: String(shirtType.companyId),
        newValues: { size: args.size, quantity: args.quantity },
      });
      return id;
    }
  },
});

export const getCartItems = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const itemsWithDetails = await Promise.all(
      cartItems.map(async (item) => {
        const shirtType = await ctx.db.get(item.shirtTypeId);
        const variant = await ctx.db.get(item.variantId);
        
        return {
          ...item,
          shirtType,
          variant,
        };
      })
    );

    return itemsWithDetails;
  },
});

export const updateCartItem = mutation({
  args: {
    itemId: v.id("cartItems"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    if (args.quantity <= 0) {
      await ctx.db.delete(args.itemId);
      await logAudit(ctx, {
        action: "remove_from_cart",
        entityType: "cartItem",
        entityId: String(args.itemId),
        companyId: String(item.companyId),
      });
    } else {
      await ctx.db.patch(args.itemId, {
        quantity: args.quantity,
      });
      await logAudit(ctx, {
        action: "update_cart_item",
        entityType: "cartItem",
        entityId: String(args.itemId),
        companyId: String(item.companyId),
        oldValues: { quantity: item.quantity },
        newValues: { quantity: args.quantity },
      });
    }
  },
});

export const removeFromCart = mutation({
  args: {
    itemId: v.id("cartItems"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item || item.userId !== userId) {
      throw new Error("Item not found");
    }

    await ctx.db.delete(args.itemId);
  },
});

export const clearCart = mutation({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const cartItems = await ctx.db
      .query("cartItems")
      .withIndex("by_user_and_company", (q) => 
        q.eq("userId", userId).eq("companyId", args.companyId)
      )
      .collect();

    for (const item of cartItems) {
      await ctx.db.delete(item._id);
    }
    await logAudit(ctx, {
      action: "clear_cart",
      entityType: "cart",
      entityId: String(userId),
      companyId: String(args.companyId),
      oldValues: { count: cartItems.length },
    });
  },
});
