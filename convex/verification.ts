import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

function generateToken(len = 48) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

export const createVerificationToken = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const token = generateToken(48);
    const expiresAt = Date.now() + 1000 * 60 * 60 * 24; // 24h
    await ctx.db.insert("emailVerificationTokens", {
      userId,
      token,
      expiresAt,
      used: false,
    });
    return { token, expiresAt };
  },
});

export const verifyToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const idx = await ctx.db
      .query("emailVerificationTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!idx) throw new Error("Invalid token");
    if (idx.used) throw new Error("Token already used");
    if (idx.expiresAt < Date.now()) throw new Error("Token expired");
    await ctx.db.patch(idx._id, { used: true });
    return { ok: true };
  },
});

export const sendVerificationEmail = action({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(api.auth.loggedInUser, {});
    if (!user) throw new Error("Not authenticated");
    const email: string | undefined = (user as any).email;
    if (!email) throw new Error("User missing email");

    const siteUrl = process.env.SITE_URL;
    if (!siteUrl) throw new Error("SITE_URL not configured");
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const { token } = await ctx.runMutation(
      api.verification.createVerificationToken,
      {},
    );
    const verifyLink = `${siteUrl}?verify=${encodeURIComponent(token)}`;

    const fromEmail = process.env.RESEND_FROM || "onboarding@resend.dev";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Shirt Platform <${fromEmail}>`,
        to: [email],
        subject: "Verify your email",
        html: `<p>Welcome! Please verify your email by clicking the link below:</p><p><a href="${verifyLink}">Verify Email</a></p><p>If the link doesn't work, copy and paste this URL into your browser:<br/>${verifyLink}</p>`,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to send email: ${res.status} ${text}`);
    }
    return { ok: true };
  },
});

export const verificationStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { verified: false };
    const anyUsed = await ctx.db
      .query("emailVerificationTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("used"), true))
      .first();
    return { verified: !!anyUsed };
  },
});
