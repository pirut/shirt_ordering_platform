import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { logAudit } from "./util/audit";
import { ensureCompanyMember } from "./util/rbac";
import { api } from "./_generated/api";

// Note: This is a basic payment processing structure
// For production, you'll need to:
// 1. Install Stripe SDK: npm install stripe
// 2. Set up Stripe API keys in environment variables
// 3. Implement actual Stripe payment intent creation

export const createPaymentIntent = action({
  args: {
    orderId: v.id("orders"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify order belongs to user
    const orders = await ctx.runQuery(api.orders.getUserOrders, {});
    const userOrder = orders.find((o) => o._id === args.orderId);
    
    if (!userOrder || String(userOrder.userId) !== String(userId)) {
      throw new Error("Order not found or not authorized");
    }

    // TODO: Implement actual Stripe payment intent creation
    // Example with Stripe:
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const paymentIntent = await stripe.paymentIntents.create({
    //   amount: Math.round(args.amount * 100), // Convert to cents
    //   currency: 'usd',
    //   metadata: {
    //     orderId: args.orderId,
    //     userId: userId,
    //   },
    // });
    // return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };

    // For now, return a mock payment intent ID
    // In production, replace this with actual Stripe integration
    const mockPaymentIntentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      clientSecret: `mock_client_secret_${mockPaymentIntentId}`,
      paymentIntentId: mockPaymentIntentId,
    };
  },
});

export const confirmPayment = mutation({
  args: {
    orderId: v.id("orders"),
    paymentIntentId: v.string(),
    transactionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (String(order.userId) !== String(userId)) {
      throw new Error("Not authorized");
    }

    if (order.paymentType !== "personal_payment") {
      throw new Error("Order is not a personal payment order");
    }

    // TODO: Verify payment with Stripe
    // Example:
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const paymentIntent = await stripe.paymentIntents.retrieve(args.paymentIntentId);
    // if (paymentIntent.status !== 'succeeded') {
    //   throw new Error('Payment not completed');
    // }

    // Update order payment status
    await ctx.db.patch(args.orderId, {
      paymentStatus: "completed",
      paymentTransactionId: args.transactionId,
    });

    await logAudit(ctx, {
      action: "confirm_payment",
      entityType: "order",
      entityId: String(args.orderId),
      companyId: String(order.companyId),
      newValues: {
        paymentIntentId: args.paymentIntentId,
        transactionId: args.transactionId,
        paymentStatus: "completed",
      },
    });

    // Create notification for employee
    await ctx.db.insert("notifications", {
      userId: order.userId,
      companyId: order.companyId,
      type: "order_approved", // Reuse existing notification type
      title: "Payment Confirmed",
      message: `Payment for order #${order.orderNumber} has been confirmed.`,
      data: { orderId: args.orderId },
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

export const refundPayment = mutation({
  args: {
    orderId: v.id("orders"),
    amount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await ensureCompanyMember(ctx, String(order.companyId));

    if (order.paymentType !== "personal_payment") {
      throw new Error("Order is not a personal payment order");
    }

    if (order.paymentStatus !== "completed") {
      throw new Error("Payment has not been completed");
    }

    if (!order.paymentTransactionId) {
      throw new Error("No payment transaction ID found");
    }

    // TODO: Implement actual Stripe refund
    // Example:
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const refundAmount = args.amount ? Math.round(args.amount * 100) : undefined;
    // const refund = await stripe.refunds.create({
    //   payment_intent: order.paymentTransactionId,
    //   amount: refundAmount,
    // });
    // return { refundId: refund.id, status: refund.status };

    // For now, just update the order status
    await ctx.db.patch(args.orderId, {
      paymentStatus: "failed",
    });

    await logAudit(ctx, {
      action: "refund_payment",
      entityType: "order",
      entityId: String(args.orderId),
      companyId: String(order.companyId),
      newValues: {
        refundAmount: args.amount || order.totalAmount,
        paymentStatus: "failed",
      },
    });

    return { refundId: `refund_${Date.now()}`, status: "succeeded" };
  },
});

export const getPaymentStatus = query({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (String(order.userId) !== String(userId)) {
      throw new Error("Not authorized");
    }

    return {
      paymentType: order.paymentType,
      paymentStatus: order.paymentStatus,
      paymentTransactionId: order.paymentTransactionId,
      totalAmount: order.totalAmount,
    };
  },
});

