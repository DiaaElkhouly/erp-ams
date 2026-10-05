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
| POST | `/api/mrp/:id/purchase-orders` | mrp | Generates one DRAFT `PurchaseOrder` per supplier from a stored run. |

The calculation compares each active item's total on-hand stock minus open sales-order demand against its `reorderPoint`, and suggests a replenishment quantity (`max(reorderQty, shortfall)`) when projected stock would dip below that threshold.

Each `MrpLine` snapshots the item's `preferredSupplierId` at run time.

**POST `/api/mrp/:id/purchase-orders`** groups the run's suggestions into one
DRAFT purchase order per supplier and sets `MrpLine.purchaseOrderId` on every
line it used. That link is what makes the call safe to repeat — a second
invocation skips lines already on an order rather than ordering everything
twice.

Lines with no preferred supplier are **skipped and returned in `skipped`**
(`{ lineId, itemId, reason: "no-supplier" | "already-ordered" | "nothing-to-order" }`)
rather than assigned to an arbitrary supplier.

Unit cost comes from `Item.costPrice` at generation time.

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

## Notifications

| Method | Path | Module | Notes |
|---|---|---|---|
| GET | `/api/notifications` | notifications | `{ unreadCount, notifications[] }`. Unread-first. |
| PATCH | `/api/notifications/:id` | notifications | Body `{ "read": true }`, or `false` to mark unread again. |
| DELETE | `/api/notifications/:id` | notifications | Dismiss for the current user only. Reversible. |
| POST | `/api/notifications/read-all` | notifications | |

Read state lives in `NotificationRead`, keyed on `(notificationId, userId)`, so
one person dismissing an alert does not silence it for the rest of the plant.

Alerts are raised automatically by the movement routes when an item **crosses**
its reorder point. Types: `REORDER_BREACH`, `REORDER_RECOVERED`, `LOW_STOCK`,
`QC_FAILED`.

**Module key `notifications` is granted to all nine roles**, including
`EMPLOYEE` — the bell is not a privilege.

## Finance

| Method | Path | Module | Notes |
|---|---|---|---|
| GET / POST | `/api/supplier-invoices` | finance | Body: `{ supplierId, dueDate?, taxRatePercent?, lines: [{ itemId?, description, quantity, unitCost }] }`. Created `DRAFT`. |
| GET / PATCH / DELETE | `/api/supplier-invoices/:id` | finance | PATCH `{ status: "DRAFT" \| "ISSUED" \| "CANCELLED", dueDate?, notes? }` |
| GET / POST | `/api/customer-invoices` | finance | Same shape, `customerId` + `unitPrice`. |
| GET / PATCH / DELETE | `/api/customer-invoices/:id` | finance | |
| GET / POST / DELETE | `/api/payments` | finance | DELETE takes `?id=`. Reverses the payment and re-derives the invoice status. |

`status` is **derived** on read by `lib/finance/invoice.ts`:
`PARTIALLY_PAID` / `PAID` / `OVERDUE` come from `amountPaid` and the due date.
Only `DRAFT`, `ISSUED`, and `CANCELLED` are writable, and each transition is
one-way — an issued invoice cannot go back to draft, a cancelled one cannot
change at all.

`POST /api/payments` body — `party` decides which invoice FK is used:
```json
{ "party": "SUPPLIER", "supplierInvoiceId": "...", "amount": 500, "method": "BANK_TRANSFER" }
```
Payment + `amountPaid` update happen in one `$transaction`.

**Deleting an invoice with payments against it returns `409`.** Payments cascade
on delete; cancel the invoice instead.

## HR

| Method | Path | Module | Notes |
|---|---|---|---|
| GET / POST | `/api/employees` | hr | GET accepts `?q=` and `?department=`. |
| GET / PATCH / DELETE | `/api/employees/:id` | hr | PATCH includes `status: "ACTIVE" \| "ON_LEAVE" \| "TERMINATED"`. |
| GET / POST | `/api/attendance` | hr | GET accepts `?date=YYYY-MM-DD` and `?employeeId=`; returns `{ attendance, summary }`. |

Attendance `status` is **derived from the punches**, not taken on trust, so a
client posting a 09:00 check-in cannot label itself PRESENT against an 08:00
shift. An explicit `LEAVE` or `ABSENT` is honoured — those are supervisor
decisions, not a clock's.

`POST /api/attendance` upserts on `(employeeId, date)`. A missing punch is
`tolerant`: one forgotten check-in reads PRESENT rather than failing the day.

`DELETE /api/employees/:id` cascades the attendance rows. For a termination use
`status: "TERMINATED"` instead — the record has to survive as evidence.

## Error format

Validation errors (Zod) return `422` with details:
```json
{ "error": "Validation failed", "details": { "fieldErrors": { "sku": ["..."] } } }
```

Auth/permission errors return `401` or `403` with `{ "error": "Unauthorized" }` / `{ "error": "Forbidden" }`.

Unhandled errors return `500` with `{ "error": "Internal server error" }`.
