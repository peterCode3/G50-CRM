# G50.Golf V1 — Architecture & Build Plan

Source: `G50 Golf Platform – V1 Product Specification.pdf`

## 1. Stack decision

| Concern            | Choice                          | Why |
|---------------------|----------------------------------|-----|
| Monorepo tool        | pnpm workspaces + Turborepo      | Fast incremental builds, simple config, first-class Next.js support |
| Public site           | Next.js (App Router) — `apps/web`   | Mobile-first customer booking flow (spec §9, §13) |
| Admin dashboard       | Next.js (App Router) — `apps/admin` | HQ + Location Admin + Coach views (spec §12, §17) — split from web for separate auth boundary & bundle size |
| API                   | NestJS — `apps/api`              | Modular structure matches the domain's natural boundaries (locations, services, scheduling, memberships, credits, bookings, payments) with built-in DI, guards for RBAC (spec §24: "API-first/modular architecture") |
| Database              | PostgreSQL 17                    | Relational integrity for bookings/credits/payments, required by spec §24 |
| ORM                   | Prisma — `packages/db`           | Type-safe schema shared with NestJS, easy migrations |
| Shared types           | `packages/shared`                | Roles/enums shared across web, admin, api so they never drift |

## 2. Domain model → Prisma schema mapping

See `packages/db/prisma/schema.prisma` for the actual schema. Mapping to spec sections:

- **§1 Locations** → `Location`
- **§2 Service structure (Classes vs Appointments)** → `Service.type: CLASS | APPOINTMENT`, with `Session` holding the actual bookable time slots (recurring classes generate many `Session` rows; appointments are booked per slot)
- **§3 HQ Service Templates** → `ServiceTemplate` (HQ-owned) vs `Service` (location-activated instance, optionally linked back via `templateId`)
- **§4/§5 Scheduling & coaches** → `Session`, `CoachAvailability`, `ServiceCoach` (many-to-many coach↔service)
- **§6 Customer accounts / §5 one coach account across locations** → single `User` row + `UserLocation` join table carrying a **per-location role** (a coach at Twin Waters, customer elsewhere, etc.) — this is the mechanism that satisfies "one account across the network" (spec §18)
- **§7 Memberships** → `MembershipPlan` (config-driven: type, price, billing period, cross-location access) + `UserMembership`
- **§8 Packages/credits** → `CreditPackage` (purchasable definition) + `CreditBalance` (per-user balance) + `CreditTransaction` (audit trail of redemption/return)
- **§9 Booking engine / §10 Waitlist** → `Booking`, `WaitlistEntry` (ordered by `position`, `status` drives the notify/claim flow from §10)
- **§11 Attendance** → `Attendance` (1:1 with `Booking`)
- **§14 Payments** → `Payment` (never stores card data — `provider` + `providerRef` point to Stripe/etc.)
- **§18 Audit requirement** → `AuditLog` + the fact that `CreditTransaction`/`Payment`/`Booking` are append-only-style records rather than mutated in place

This is a starting skeleton (deliverable #26 in the spec: "proposed database/entity structure") —
expect to refine field-level details once wireframes are locked in.

## 3. Role/permission matrix (spec §17)

| Role            | Scope                                                                 |
|------------------|------------------------------------------------------------------------|
| HQ_ADMIN         | All locations; manages `ServiceTemplate`, `MembershipPlan` (global), permissions, network reporting |
| LOCATION_ADMIN   | Their `UserLocation`-linked location(s) only; activates templates into `Service`, manages local schedules/pricing/customers |
| COACH            | Their assigned `Session`s and `ServiceCoach` links only; attendance for their sessions |
| CUSTOMER         | Own `User` row: bookings, memberships, credits, profile |

Enforce this with NestJS Guards reading `UserLocation` rows — never trust a client-supplied role.

## 4. Build order (suggested milestones)

1. **Foundation** (this scaffold): monorepo, Prisma schema, empty Next.js/NestJS apps — ✅ done
2. **Auth & RBAC**: user signup/login (NestJS + JWT), `UserLocation` role guards, shared session on web/admin
3. **Locations + HQ Service Templates**: HQ CRUD, location activation flow (spec §3 example: HQ creates → Twin Waters activates → assigns coach → sets schedule)
4. **Scheduling**: recurring class generation, appointment slots, coach availability, double-booking prevention (spec §4, §18)
5. **Booking engine**: capacity-safe booking (use a DB transaction + row lock or unique constraint to prevent overbooking — spec §18 "capacity must be enforced server-side"), waitlist join/notify/claim
6. **Memberships, packages, credits**: plan config, purchase flow, credit redemption/return on cancellation
7. **Payments**: Stripe integration (or similar), webhook-driven `Payment` status updates
8. **Attendance + reporting**: coach attendance UI, HQ/Location dashboards with CSV export
9. **Notifications**: transactional email (booking confirm/cancel/reminder/waitlist) via Resend/SendGrid
10. **Acceptance testing**: run the 3 scenarios from spec §25 end-to-end (full booking loop, waitlist promotion, cross-location account reuse)

## 5. What's deliberately deferred (per spec §23)

Native mobile apps, AI recommendations, T3 performance engine, payroll/commission, marketing
CRM, e-commerce/inventory, loyalty/gamification, social features, complex corporate accounts.
The schema/API should stay additive-friendly for these (e.g. `User` and `Booking` aren't
hard-coded to only support what V1 needs), but don't build UI for them now.

## 6. Local dev setup

See the root `README.md` for install/run steps and Postgres setup.
