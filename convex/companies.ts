import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createCompany = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const companyId = await ctx.db.insert("companies", {
      name: args.name,
      adminId: userId,
      createdAt: Date.now(),
      isActive: true,
    });

    // Add the creator as admin
    await ctx.db.insert("companyMembers", {
      companyId,
      userId,
      role: "admin",
      orderLimit: 0, // Admins don't have order limits
      joinedAt: Date.now(),
      isActive: true,
    });

    return companyId;
  },
});

export const updateCompany = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership || membership.role !== "admin") {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.companyId, {
      name: args.name,
    });
  },
});

export const getUserCompany = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!membership) {
      return null;
    }

    const company = await ctx.db.get(membership.companyId);
    return {
      ...company,
      role: membership.role,
      orderLimit: membership.orderLimit,
    };
  },
});

export const getCompanyMembers = query({
  args: {
    companyId: v.id("companies"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin of this company
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership || membership.role !== "admin") {
      throw new Error("Not authorized");
    }

    const members = await ctx.db
      .query("companyMembers")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();

    const membersWithUsers = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        return {
          ...member,
          user,
        };
      })
    );

    return membersWithUsers;
  },
});

export const inviteEmployee = mutation({
  args: {
    companyId: v.id("companies"),
    email: v.string(),
    orderLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin
    const membership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", args.companyId).eq("userId", userId)
      )
      .first();

    if (!membership || membership.role !== "admin") {
      throw new Error("Not authorized");
    }

    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    await ctx.db.insert("invitations", {
      companyId: args.companyId,
      email: args.email,
      role: "employee",
      orderLimit: args.orderLimit,
      token,
      expiresAt,
      isUsed: false,
    });

    return token;
  },
});

export const updateMemberOrderLimit = mutation({
  args: {
    memberId: v.id("companyMembers"),
    orderLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const member = await ctx.db.get(args.memberId);
    if (!member) {
      throw new Error("Member not found");
    }

    // Check if user is admin of the company
    const adminMembership = await ctx.db
      .query("companyMembers")
      .withIndex("by_company_and_user", (q) => 
        q.eq("companyId", member.companyId).eq("userId", userId)
      )
      .first();

    if (!adminMembership || adminMembership.role !== "admin") {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.memberId, {
      orderLimit: args.orderLimit,
    });
  },
});

export const bulkUpdateMemberLimits = mutation({
  args: {
    memberIds: v.array(v.id("companyMembers")),
    orderLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify all members belong to companies where user is admin
    for (const memberId of args.memberIds) {
      const member = await ctx.db.get(memberId);
      if (!member) continue;

      const adminMembership = await ctx.db
        .query("companyMembers")
        .withIndex("by_company_and_user", (q) => 
          q.eq("companyId", member.companyId).eq("userId", userId)
        )
        .first();

      if (!adminMembership || adminMembership.role !== "admin") {
        throw new Error("Not authorized for all selected members");
      }
    }

    // Update all members
    for (const memberId of args.memberIds) {
      await ctx.db.patch(memberId, {
        orderLimit: args.orderLimit,
      });
    }
  },
});
