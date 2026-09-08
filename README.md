# G50.Golf Platform

Multi-location golf coaching & booking platform. See `docs/PROJECT-PLAN.md` for the full
mapping from the product spec to this architecture, and `docs/BUILD-ROADMAP.md` for what's
done, what's remaining, and a copy-paste prompt for each next step.

## Structure

```
g50golf/
├── apps/
│   ├── web/     Next.js — public golfer-facing site (browse, book, manage account)
│   ├── admin/   Next.js — HQ Admin / Location Admin / Coach dashboard
│   └── api/     NestJS — REST API (auth, locations, services, scheduling, bookings, payments)
├── packages/
│   ├── db/      Prisma schema + client, shared by api
│   └── shared/  Shared TypeScript types/constants (roles, enums) used by web/admin/api
├── infra/       docker-compose.yml (optional local Postgres via Docker)
└── docs/        Architecture & planning docs
```

## Prerequisites

- Node.js 20+ (you have v22 ✅)
- pnpm 9+ (you have 9.1.2 ✅)
- PostgreSQL 14+ running locally — see "Database setup" below (this machine already has
  PostgreSQL 18 installed and running as a Windows service; that's what this repo uses)

## Database setup (native Windows install)

Automated install via `winget` was blocked by EnterpriseDB's CDN (403), so install manually if
you don't already have Postgres:

1. Download the installer: https://www.postgresql.org/download/windows/ → "Download the installer" → latest version.
2. Run it. When prompted:
   - Password for the `postgres` superuser: pick one and remember it (e.g. `postgres`).
   - Port: leave as `5432`.
   - Locale: default is fine.
3. Open **SQL Shell (psql)** from the Start Menu (or use pgAdmin, installed alongside), connect
   with the postgres user/password you set, and run:
   ```sql
   CREATE USER g50golf WITH PASSWORD 'g50golf';
   CREATE DATABASE g50golf OWNER g50golf;
   ALTER USER g50golf CREATEDB; -- needed for Prisma's shadow database during `migrate dev`
   ```
4. Copy `packages/db/.env.example` to `packages/db/.env` and confirm the connection string matches:
   ```
   DATABASE_URL="postgresql://g50golf:g50golf@localhost:5432/g50golf?schema=public"
   ```

If you'd rather not install Postgres natively, `infra/docker-compose.yml` gives you the same
database via `docker compose -f infra/docker-compose.yml up -d` (requires Docker Desktop).

## Install & run

```bash
pnpm install

# Generate Prisma client + run first migration
pnpm db:migrate

# Create the initial HQ admin account (staff aren't self-registered — see docs/BUILD-ROADMAP.md)
pnpm db:seed

# Run everything (web, admin, api) in dev mode
pnpm dev
```

- web: http://localhost:3000 — public golfer site (`/register`, `/login`, `/account`)
- admin: http://localhost:3001 — staff dashboard (`/login`, `/dashboard`; log in with the seeded
  HQ admin: `hqadmin@g50.golf` / `changeme123` — change this before any real deployment)
- api: http://localhost:3333

## Environment variables

Each app needs its own `.env.local` (Next.js) or `.env` (NestJS). Start from:
- `packages/db/.env.example` → `packages/db/.env`
- `apps/api/.env.example` → `apps/api/.env`
- `apps/web/.env.example` → `apps/web/.env.local`
- `apps/admin/.env.example` → `apps/admin/.env.local`
