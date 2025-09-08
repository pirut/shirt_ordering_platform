# Shirt Ordering Platform
  
This is a project built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend.
 You can find docs about Chef with useful information like how to deploy to production [here](https://docs.convex.dev/chef).
  
This project is connected to the Convex deployment named [`outgoing-egret-291`](https://dashboard.convex.dev/d/outgoing-egret-291).
  
## Project structure
  
The frontend code is in the `app` directory and is built with [Vite](https://vitejs.dev/).
  
The backend code is in the `convex` directory.
  
`npm run dev` will start the frontend and backend servers.

## App authentication

Chef apps use [Convex Auth](https://auth.convex.dev/) with Anonymous auth for easy sign in. You may wish to change this before deploying your app.

## Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.
* If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
* Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
* Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## HTTP API

User-defined http routes are defined in the `convex/router.ts` file. We split these routes into a separate file from `convex/http.ts` to allow us to prevent the LLM from modifying the authentication routes.

## Roles & RBAC

- Roles: `superAdmin`, `companyAdmin`, `employee`, `vendor`.
- Company membership is stored in `companyMembers` with roles `companyAdmin` or `employee`.
- Vendor identity is explicit via `vendorMembers` linking a Convex user to a `vendors` record.
- Server-side guards live in `convex/util/rbac.ts` and are used across mutations/queries.

## Auditing

All significant mutations write to `auditLogs`. See `convex/util/audit.ts`. Covered actions include company create/update, order create/status changes, vendor/invoice updates, cart and catalog changes, and approvals.

## Seed Data

Seed an end-to-end demo dataset (tenant, vendor, users, catalog, orders, PO, invoice, shipment):

1. Start Convex dev once to ensure generated types: `npx convex dev --once`
2. Run the seed function (from Convex dashboard or via CLI): call internal `seed.seedAll`.

CLI example (from project root):

```
# If your environment supports `convex run`, you can invoke:
# npx convex run internal:seed:seedAll
```

The seed creates:
- 1 super admin, 1 tenant (company) with 1 companyAdmin and 2 employees
- 1 vendor + 1 vendor user (linked via `vendorMembers`)
- 3 catalog items (with variants)
- 1 draft order, 1 approved order
- 1 purchase order, 1 invoice, 1 shipment
