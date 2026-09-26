# Installation Guide

## Prerequisites

- **Node.js** 20 LTS or newer
- **npm** 10+ (bundled with Node)
- **PostgreSQL** 14+ running locally or accessible remotely

## 1. Get PostgreSQL running

Pick one:

**Option A — Docker (fastest):**
```bash
docker run --name ims-postgres -e POSTGRES_USER=ims_user -e POSTGRES_PASSWORD=ims_password \
  -e POSTGRES_DB=ims_db -p 5432:5432 -d postgres:16
```

**Option B — Native install:**
- macOS: `brew install postgresql@16 && brew services start postgresql@16`
- Ubuntu/Debian: `sudo apt install postgresql postgresql-contrib`
- Windows: use the installer from https://www.postgresql.org/download/windows/

Then create the database and user:
```sql
CREATE USER ims_user WITH PASSWORD 'ims_password';
CREATE DATABASE ims_db OWNER ims_user;
```

## 2. Install dependencies

```bash
npm install
```

This also runs `prisma generate` automatically via the `postinstall` script.

## 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="postgresql://ims_user:ims_password@localhost:5432/ims_db?schema=public"
AUTH_SECRET="<generate one — see below>"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a secure `AUTH_SECRET`:
```bash
openssl rand -base64 32
```
(No OpenSSL? Use `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.)

## 4. Run database migrations

```bash
npm run db:migrate
```

This creates all tables defined in `prisma/schema.prisma` and generates the Prisma Client.

## 5. Seed sample data

```bash
npm run db:seed
```

Creates demo users, including a QA quality manager, plus manufacturing data for a concrete products factory: cement, sand and aggregate inventory; block, cement brick, interlock and ready-mix products; laboratory test results; mix designs; BOMs; and production work orders. The seed is safe to rerun and does not delete existing data.

## 6. Start the app

```bash
npm run dev
```

Open http://localhost:3000. Sign in as the quality manager with `quality@ims.local` / `Admin123!`, or use `admin@ims.local` / `Admin123!`.

## Other useful commands

| Command | Purpose |
|---|---|
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:push` | Push schema changes without creating a migration (prototyping) |
| `npm run db:reset` | Drop and recreate the database, then reseed |

## Troubleshooting

- **`ERESOLVE unable to resolve dependency tree` on `npm install`** — some packages (e.g. older `recharts`/`framer-motion` releases) declare peer-dependency ranges that lag behind React 19 even though they work fine with it. This project ships an `.npmrc` with `legacy-peer-deps=true` so plain `npm install` should just work. If you still hit this (e.g. a global npm config overrides it), run `npm install --legacy-peer-deps` explicitly.
- **`Can't reach database server`** — confirm PostgreSQL is running and `DATABASE_URL` matches your credentials/port.
- **`Environment variable not found: DATABASE_URL`** — make sure you copied `.env.example` to `.env` (not `.env.local`) and restarted the dev server.
- **Prisma Client out of date after schema edits** — run `npx prisma generate` (or re-run `npm install`).
- **Port 3000 already in use** — `PORT=3001 npm run dev`.
