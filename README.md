# IMS — Integrated Manufacturing System

A full-stack enterprise manufacturing application built with Next.js 15, React 19, TypeScript, Prisma, and PostgreSQL.

This build fully implements: **Authentication & RBAC**, **Dashboard**, **Inventory & Warehouse**, **Production, BOM & MRP**, and **Sales & Purchasing** — with real CRUD, database persistence, and enterprise-style UI (sidebar, topbar, command palette, dark mode). Other modules from the original brief (HR, Finance, Quality Control) are scaffolded in the Prisma schema comments and `features/` folders, ready to extend using the same patterns.

## Stack

- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui-style components (Radix primitives) + Lucide Icons
- **Data:** Prisma ORM + PostgreSQL
- **Auth:** NextAuth v5 (Credentials provider, JWT sessions), RBAC middleware
- **State/Data fetching:** TanStack Query, Zustand (available for client state), React Hook Form + Zod
- **Charts/Tables:** Recharts, TanStack Table
- **UX:** Framer Motion (available), Sonner toasts, cmdk command palette

## Quick start

> **Security note:** this project pins `next@15.1.11` and `react@19.1.2`, which are the patched versions for [CVE-2025-66478 / CVE-2025-55182](https://nextjs.org/blog/CVE-2025-66478), a critical RCE in the React Server Components protocol that affected all Next.js 15.x/16.x App Router apps. If you ever bump these versions, re-check https://nextjs.org/blog for newer advisories first.

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env: set DATABASE_URL to your local PostgreSQL connection string
# and set AUTH_SECRET (generate with: openssl rand -base64 32)

# 3. Create the database schema
npm run db:migrate

# 4. Seed sample data (users, warehouses, items, BOM, orders)
npm run db:seed

# 5. Start the dev server
npm run dev
```

Visit http://localhost:3000 — you'll be redirected to `/login`.

**Demo accounts** (password for all: `Admin123!`):

| Email | Role |
|---|---|
| admin@ims.local | Administrator |
| production@ims.local | Production Manager |
| warehouse@ims.local | Warehouse Manager |
| purchasing@ims.local | Purchasing Officer |
| sales@ims.local | Sales Staff |
| quality@ims.local | Quality Manager (QA) |

The demo seed also includes an Egyptian concrete products factory scenario: cement, sand, aggregates, stone powder, admixture and pigment stock; block, cement brick, interlock and ready-mix products; sample laboratory results, mix designs and production work orders. Seeded QA credentials can access the laboratory and production operations.

See `docs/INSTALLATION.md` for detailed setup (including PostgreSQL install options) and `docs/API.md` for the REST API reference.

## Project structure

```
app/
  (auth)/            Login, forgot/reset password (public routes)
  (dashboard)/        Sidebar/topbar shell + all module pages (protected)
  api/                REST API route handlers (one folder per resource)
components/
  ui/                 Reusable primitives (button, input, dialog, table, ...)
  layout/             Sidebar, topbar, command palette
  shared/             Cross-module providers and chart components
features/
  inventory/          Full example: services (fetch) → hooks (TanStack Query) → components
  production/          Scaffolded — follow the inventory pattern to extend
  sales/ purchasing/    Scaffolded
hooks/                Shared client hooks (placeholder)
lib/
  db.ts               Prisma client singleton
  rbac.ts             Central role → module permission matrix
  api-helpers.ts       Auth/RBAC guards + error handling for API routes
  actions/             Server actions (password reset flow)
  utils.ts             Formatting helpers
prisma/
  schema.prisma        Full data model
  seed.ts               Seed script
types/                 Shared TypeScript types + NextAuth type augmentation
public/                Static assets
```

## RBAC model

Roles: `ADMINISTRATOR`, `PRODUCTION_MANAGER`, `WAREHOUSE_MANAGER`, `PURCHASING_OFFICER`, `SALES_STAFF`, `FINANCE`, `HR`, `QA`, `EMPLOYEE`.

Access is enforced in three places:
1. **Middleware** (`middleware.ts`) — blocks unauthenticated access to any non-auth route.
2. **API routes** — each handler calls `requireModuleAccess("<module>")` from `lib/api-helpers.ts`, which checks the permission matrix in `lib/rbac.ts`.
3. **Sidebar navigation** — links are filtered client-side by the same matrix so users only see modules they can access.

Administrators always have full access. Edit `MODULE_PERMISSIONS` in `lib/rbac.ts` to change which roles can reach which modules.

## What's fully built vs. scaffolded

**Fully working (real forms, validation, persistence, status workflows):**
- Auth: login, logout, forgot/reset password, protected routing
- Dashboard: live KPIs and charts computed from the database
- Inventory: item CRUD, stock-by-warehouse, low-stock highlighting
- Warehouse: warehouse CRUD with per-warehouse stock summaries
- Production: work orders with a Planned → Released → In Progress → Completed workflow that increments finished-goods stock on completion
- BOM: multi-component bill of materials builder
- MRP: on-demand run comparing on-hand stock vs. open sales demand, suggesting replenishment quantities
- Sales: customers + sales orders with a Draft → Confirmed → Fulfilled workflow
- Purchasing: suppliers + purchase orders with a Draft → Ordered → Received workflow that increments stock on receipt
- Reports: low-stock report, inventory valuation, order-status summaries

**Scaffolded for extension** (folders + patterns in place, not yet built out): HR, Finance, Quality Control. Add a Prisma model, an `app/api/<resource>` route following the existing examples, and a `features/<module>` folder following `features/inventory/`.

## Next steps / future improvements

- Add pagination + column sorting to TanStack Table on large item/order lists
- Add row-level edit dialogs (currently create + delete; update via PATCH endpoints already exist for status changes)
- Wire up HR, Finance, and QA modules using the same service → hook → component pattern
- Add automated tests (Vitest/Playwright)
- Add real email delivery for password reset (currently returns a dev-mode link)
