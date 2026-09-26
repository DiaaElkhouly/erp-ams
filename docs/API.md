# API Documentation

All routes live under `/api` and are implemented as Next.js Route Handlers (`app/api/**/route.ts`). Every route (except NextAuth's own endpoints) is protected by session auth + RBAC via `requireModuleAccess()` — unauthenticated requests get `401`, unauthorized roles get `403`.

Base URL (local): `http://localhost:3000/api`

## Auth

Handled by NextAuth (`app/api/auth/[...nextauth]/route.ts`). Sign in from the UI at `/login`; the credentials provider validates against the `users` table (bcrypt-hashed passwords) and issues a JWT session cookie.

Password reset is handled via server actions (`lib/actions/auth.ts`), not REST endpoints — see `/forgot-password` and `/reset-password`.

## Items (Inventory)

| Method | Path | Module | Description |
|---|---|---|---|
| GET | `/api/items?q=&type=&page=&pageSize=` | inventory | List items, with search/filter/pagination |
| POST | `/api/items` | inventory | Create an item |
| PATCH | `/api/items/:id` | inventory | Update an item |
| DELETE | `/api/items/:id` | inventory | Delete an item |

**POST body:**
```json
{
  "sku": "RM-1001",
  "name": "Steel Sheet 2mm",
  "type": "RAW_MATERIAL",
  "unit": "sheet",
  "costPrice": 12.5,
  "salePrice": 0,
  "reorderPoint": 50,
  "reorderQty": 200
}
```

## Warehouses

| Method | Path | Module |
|---|---|---|
| GET | `/api/warehouses` | warehouse |
| POST | `/api/warehouses` | warehouse |
| DELETE | `/api/warehouses/:id` | warehouse |

## Bill of Materials

| Method | Path | Module |
|---|---|---|
| GET | `/api/boms` | bom |
| POST | `/api/boms` | bom |
| DELETE | `/api/boms/:id` | bom |

**POST body:**
```json
{
  "name": "Heavy-Duty Shelf Unit Assembly",
  "finishedSku": "FG-3001",
  "version": "1.0",
  "components": [{ "itemId": "...", "quantity": 4 }]
}
```

## Work Orders (Production)

| Method | Path | Module | Notes |
|---|---|---|---|
| GET | `/api/work-orders` | production | |
| POST | `/api/work-orders` | production | Auto-generates order number `WO-...` |
| PATCH | `/api/work-orders/:id` | production | Body: `{ "status": "..." }`. Setting `COMPLETED` increments finished-goods stock. |
| DELETE | `/api/work-orders/:id` | production | |

Status flow: `PLANNED → RELEASED → IN_PROGRESS → COMPLETED` (or `CANCELLED` at any point).

## MRP

| Method | Path | Module | Notes |
|---|---|---|---|
| GET | `/api/mrp` | mrp | Returns the last 10 MRP runs |
| POST | `/api/mrp` | mrp | Body: `{ "name": "..." }`. Runs the calculation and stores a new `MrpRun`. |

The calculation compares each active item's total on-hand stock minus open sales-order demand against its `reorderPoint`, and suggests a replenishment quantity (`max(reorderQty, shortfall)`) when projected stock would dip below that threshold.

## Sales

| Method | Path | Module |
|---|---|---|
| GET / POST | `/api/customers` | sales |
| GET / POST | `/api/sales-orders` | sales |
| PATCH `/api/sales-orders/:id` | sales | Body: `{ "status": "DRAFT" \| "CONFIRMED" \| "FULFILLED" \| "CANCELLED" }` |
| DELETE `/api/sales-orders/:id` | sales | |

**POST `/api/sales-orders` body:**
```json
{
  "customerId": "...",
  "lines": [{ "itemId": "...", "quantity": 5, "unitPrice": 129.99 }]
}
```

## Purchasing

| Method | Path | Module |
|---|---|---|
| GET / POST | `/api/suppliers` | purchasing |
| GET / POST | `/api/purchase-orders` | purchasing |
| PATCH `/api/purchase-orders/:id` | purchasing | Body: `{ "status": "DRAFT" \| "ORDERED" \| "RECEIVED" \| "CANCELLED" }`. Setting `RECEIVED` increments stock in the first active warehouse. |
| DELETE `/api/purchase-orders/:id` | purchasing | |

## Error format

Validation errors (Zod) return `422` with details:
```json
{ "error": "Validation failed", "details": { "fieldErrors": { "sku": ["..."] } } }
```

Auth/permission errors return `401` or `403` with `{ "error": "Unauthorized" }` / `{ "error": "Forbidden" }`.

Unhandled errors return `500` with `{ "error": "Internal server error" }`.
