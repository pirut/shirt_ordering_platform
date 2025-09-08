/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as approvals from "../approvals.js";
import type * as auth from "../auth.js";
import type * as cart from "../cart.js";
import type * as companies from "../companies.js";
import type * as http from "../http.js";
import type * as notifications from "../notifications.js";
import type * as orders from "../orders.js";
import type * as purchaseOrders from "../purchaseOrders.js";
import type * as reports from "../reports.js";
import type * as router from "../router.js";
import type * as shirts from "../shirts.js";
import type * as vendors from "../vendors.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  approvals: typeof approvals;
  auth: typeof auth;
  cart: typeof cart;
  companies: typeof companies;
  http: typeof http;
  notifications: typeof notifications;
  orders: typeof orders;
  purchaseOrders: typeof purchaseOrders;
  reports: typeof reports;
  router: typeof router;
  shirts: typeof shirts;
  vendors: typeof vendors;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
