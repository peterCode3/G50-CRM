# G50.Golf — Build Roadmap & Status

One doc, kept up to date: what's done, what's left, and a ready-to-use prompt for each
remaining step. Work through the "Remaining" phases in order — each one builds on the last.
After finishing a phase, move its entry from Remaining to Done (with a one-line note on what
actually got built, since implementations may diverge slightly from the prompt).

---

## ✅ Done

- **Monorepo scaffold** — pnpm workspaces + Turborepo, `apps/web` (Next.js, port 3000),
  `apps/admin` (Next.js, port 3001), `apps/api` (NestJS, port 3333), `packages/db` (Prisma),
  `packages/shared` (role/enum constants), `infra/docker-compose.yml` (optional local Postgres).
- **Database schema** (`packages/db/prisma/schema.prisma`) — models the full V1 spec: Location,
  User/UserLocation (per-location roles), ServiceTemplate/Service (HQ template vs
  location-activated), Session (scheduling), CoachAvailability, MembershipPlan/UserMembership,
  CreditPackage/CreditBalance/CreditTransaction, Booking, WaitlistEntry, Attendance, Payment,
  AuditLog.
- **API foundation** — NestJS app with `PrismaModule`/`PrismaService` wired in, CORS open for
  web+admin, `ConfigModule` for env vars. No feature modules yet (auth, locations, etc. below).
- **Branding** — logo processed into header/favicon variants (`docs/brand/`), wired into both
  `apps/web` and `apps/admin` (favicon via Next's `app/icon.png` convention, header logo via a
  shared `Header` component), and a real gold/teal Tailwind v4 color theme (`gold-50…900`,
  `teal-50…900`) added to both apps' `globals.css`, sampled from the actual logo pixels — see
  `docs/BRANDING.md` for the full palette and usage notes.
- **Database is live and migrated** — found PostgreSQL 18 already running natively on this
  machine (no Docker needed), created the `g50golf` user/database, ran the initial migration —
  all 19 tables exist. Connection strings live in `packages/db/.env` and `apps/api/.env`
  (gitignored, not committed).
- **Fixed a real runtime bug**: `apps/api` is an ESM project and was crashing on boot
  (`ERR_UNKNOWN_FILE_EXTENSION`) because `@g50golf/db`/`@g50golf/shared` pointed `main` at raw
  `.ts` source files, which Node's native loader can't execute — only surfaced by actually
  running the app, not by `tsc`/`nest build` alone. Fixed by giving both packages a real `build`
  script (`tsc` → `dist/`), pointing `main`/`types` at the compiled output, and making Turborepo's
  `dev` task depend on `^build` so workspace packages compile before the API starts.
- **Verified end-to-end, live**: `pnpm dev` runs all three apps together; confirmed with curl
  that web (3000), admin (3001), and api (3333) all return 200, the logo/favicon assets load,
  and the API is actually querying through Prisma to the real Postgres database (not just
  serving a static page). This is the first point where "it builds" became "it runs."
- **Phase 1 — Auth & RBAC** — built and verified with curl, not just compiled:
  - `apps/api/src/auth/`: `AuthModule` with register/login/logout/me endpoints, bcrypt password
    hashing (`bcryptjs`, 12 salt rounds), JWT issued via `@nestjs/jwt` and delivered as an
    httpOnly, `SameSite=Lax` cookie (`g50_token`) — never returned in the response body.
  - **JWT payload carries only `{ sub: userId }`** — no role/location claims. `JwtStrategy` looks
    up the user fresh from Postgres (with their `UserLocation` rows) on *every* request, so a
    role change takes effect immediately and a stale/forged token can't claim elevated access.
  - **`JwtAuthGuard` + `RolesGuard` are global** (deny-by-default), with a `@Public()` decorator
    to opt individual routes out (register/login/logout, and the root health-check route).
    `@Roles(...)` gates a route to specific `GlobalRole`/`LocationRole` values; `HQ_ADMIN` always
    passes as a superuser; a location-scoped role additionally checks the request's `locationId`
    param/body against the caller's `UserLocation` rows.
  - **Caught and fixed a real ordering bug before it shipped**: registering `RolesGuard` as the
    only global guard meant it ran *before* `JwtAuthGuard`, so `request.user` was never populated
    when a role check needed it. Fixed by making both guards global, in explicit order
    (`JwtAuthGuard` → `RolesGuard`).
  - **Verified with curl, including CORS preflight** (not just the direct requests a browser
    would never actually send): register → 201 with cookie set; wrong password → 401; duplicate
    email → 409; invalid body → 400 (via a global `ValidationPipe`); `/auth/me` with no cookie →
    401; a temporary role-gated test route confirmed customer → 403, HQ admin → 200, no auth →
    401, then was removed once confirmed; an explicit `OPTIONS` preflight from
    `Origin: http://localhost:3000` confirmed `Access-Control-Allow-Origin`/`-Credentials`/
    `-Methods`/`-Headers` are all correct for the real cross-port browser flow.
  - **Seed script** (`packages/db/prisma/seed.ts`, run via `pnpm db:seed`) creates an initial HQ
    admin (`hqadmin@g50.golf` / `changeme123` — change before any real deployment) since staff
    accounts aren't self-registered per spec §5.
  - **Frontend**: `apps/web` gets `/register`, `/login`, `/account` (golfer-facing,
    self-registration allowed); `apps/admin` gets `/login`, `/dashboard` (staff-facing, no
    self-register — matches spec §5's "HQ or authorised Location Admins must be able to create
    staff accounts"). Both are thin client components calling the API with
    `credentials: "include"`; the API's cookie is host-only for `localhost` so it's sent
    correctly across the 3000/3001/3333 ports without extra config.
  - **Not yet built**: password reset, email verification, refresh tokens (7-day JWT with no
    rotation for now).
- **Phase 2 — Locations & HQ Service Templates** — built and verified with curl using a
  realistic multi-location scenario, not just single-user happy-path checks:
  - **API**: `LocationsModule` (`GET /locations` public/active-only, `GET /locations/admin/all`
    HQ-only for full status visibility, `GET /locations/:id` public, `POST`/`PATCH`/
    `:id/activate`/`:id/deactivate` HQ-only), `ServiceTemplatesModule` (HQ-only writes, browsable
    by HQ or *any* location admin), `ServicesModule` split across
    `LocationServicesController` (`/locations/:locationId/services` — public GET, HQ/Location
    Admin POST to activate a template into a `Service`, copying template defaults with optional
    price/capacity/duration overrides) and `ServicesController` (`/services/:id` — public GET,
    HQ/Location Admin PATCH), and `StaffModule` (`POST /staff` reuses an existing `User` by email
    or creates one, then adds a `UserLocation` row — this is the actual mechanism behind "one
    coach account across multiple locations"; `GET /locations/:locationId/staff` to list).
  - **Found and fixed a real authorization gap in Phase 1's `RolesGuard` before it caused
    damage**: the old logic checked `requiredRoles.includes(user.globalRole)` as a fast-path,
    which meant a Location Admin's `User.globalRole` (set once at account creation) would satisfy
    *any* `@Roles(LOCATION_ADMIN)` check globally, with no actual location scoping — a Location
    Admin at Twin Waters could have managed Sunshine Coast too. This was never caught in Phase 1
    because the only role tested there was the HQ_ADMIN superuser bypass; Phase 2 was the first
    time a genuinely location-scoped role was exercised in anger. Fixed: `user.globalRole` is now
    used *only* to recognize the true superuser (`HQ_ADMIN`); every other role is checked against
    actual `UserLocation` rows — scoped to a specific `locationId` when the request has one (e.g.
    activating a template at a specific location), or matched against *any* of the user's
    location roles when it doesn't (e.g. browsing the global template catalog, which isn't tied
    to one location).
  - **Two-layer authorization pattern established** (for Phase 3+ to reuse): a coarse
    `@Roles()` check at the route (must be *some* HQ/Location Admin) plus a precise
    service-layer ownership check for routes addressed by a bare resource id with no `locationId`
    in the URL (e.g. `PATCH /services/:id` — the guard can't know which location that service
    belongs to without a DB lookup, so `ServicesService.update()` fetches the service and checks
    the caller's `UserLocation` rows against its actual `locationId` itself).
  - **Verified with a real two-location, three-account scenario** (not just single-actor checks):
    created Twin Waters + Sunshine Coast, a Twin Waters-only Location Admin, and a coach shared
    across both. Confirmed: Location Admin activates a template at their own location (201) but
    is blocked activating one at the other location (403, the exact bug above) and blocked
    `PATCH`-ing a service HQ created at the other location (403, service-layer check); HQ's
    superuser bypass still works everywhere; the shared coach logs in and sees **the same user
    id** with both `UserLocation` entries — this is spec §25's third acceptance test ("same
    golfer/coach accounts operate correctly across multiple locations without duplication")
    passing for real, not asserted; CORS confirmed working from both the web (3000) and admin
    (3001) origins.
  - **Frontend** (`apps/admin` only — no golfer-facing changes this phase): `/locations` (HQ:
    full list + create + activate/deactivate; Location Admin: only their own, fetched via their
    `/auth/me` location roles), `/locations/[id]` (services activated there, the HQ template
    catalog with per-template "Activate" buttons, staff list + an add-staff form), `/templates`
    (HQ-only list/create). A `useCurrentUser` hook replaced the copy-pasted auth-check-on-mount
    logic from Phase 1 now that three pages needed it.
  - **Known simplification, revisit later**: `GET /locations/:id` and the public service-browsing
    endpoints don't currently filter out inactive locations/services for anonymous callers (only
    the top-level `GET /locations` list does) — fine for now since nothing depends on that
    boundary yet, but worth tightening once the booking engine (Phase 4) actually cares which
    locations/services are bookable by the public.
- **Admin UI redesign** — the plain forms-on-white-page look was replaced with a real CRM shell:
  `apps/admin/src/components/AppShell.tsx` + `Sidebar.tsx` (persistent dark-teal/gold nav, hidden
  only on `/login`), `PageHeader`, `Card`, `StatCard`, `Badge`, `Button` as shared primitives used
  consistently across every page. Dashboard now shows real stat cards (location/template counts
  pulled live from the API) instead of a raw user-info list; Locations/Templates use proper
  `<table>` data grids instead of `<li>` rows; forms are collapsible ("+ New ...") instead of
  always-open. Sidebar nav items are scoped to what the logged-in user can actually do
  (`hqOnly`/`coachOnly`/`locationAdminOnly` flags) rather than showing everything to everyone —
  a pure coach like Jon sees only Dashboard + My Schedule, not Locations or Templates. A grayed-out
  "Coming soon" section (Bookings, Customers, Payments, Reports) previews the app's eventual scope.
  Verified visually with Playwright screenshots (installed temporarily, removed after), not just a
  successful build — screenshots caught two real problems a build can't: (1) the brand logo had
  `naturalWidth: 0` (silently failed to load) on both the Sidebar and Login page because Next.js
  `<Image>` defaults to `loading="lazy"`, and these are above-the-fold brand elements — fixed by
  adding `priority`, matching what `apps/web`'s header already had; (2) every page's data-loading
  `useEffect` had no `.catch()`, so any future fetch failure would leave the UI stuck on
  "Loading..." forever with no error shown — added a `loadError` state + message to all four pages
  as a defensive fix (not an active bug today, but a real gap).
- **Phase 3 — Scheduling** — built and verified with curl, including the spec's explicit
  double-booking rule, plus a real coach-facing UI:
  - **API** (`apps/api/src/scheduling/`): `SessionsService`/`ServiceSessionsController`
    (`POST /services/:serviceId/sessions` one-off, `POST .../sessions/recurring` generates many
    `Session` rows from a day-of-week + time + date range, `GET .../sessions` public listing with
    `from`/`to` filters), `SessionsController` (`GET /sessions/my` — a coach's own upcoming
    schedule across every location they coach at; `POST /sessions/:id/cancel` — soft-cancel,
    preserves the row for audit per spec §18), and `CoachAvailabilityService`/`Controller`
    (create/list/delete availability + time-off, self-service for the coach or managed by
    HQ/Location Admin).
  - **Double-booking prevention, for real**: every `Session` create runs inside a Postgres
    `SERIALIZABLE` transaction that checks for an overlapping `Session` on the same `coachId`
    before inserting; a genuine concurrent race gets a `P2034` serialization failure from
    Postgres itself, which is caught and surfaced as the same 409 a plain overlap check would
    give. Verified: booking a coach at an overlapping time returns 409 with the exact conflicting
    window in the message; a non-overlapping time on the same day succeeds; the recurring
    generator, run twice over the same coach/time, creates the new slots and cleanly **skips**
    (not aborts) the one that collides, reporting why.
  - **Two-layer auth pattern reused, not reinvented**: same coarse `@Roles(HQ_ADMIN,
    LOCATION_ADMIN)` + `assertManagesLocation()` service-layer check from Phase 2, now imported
    from the shared `apps/api/src/auth/location-access.util.ts` rather than duplicated a third
    time.
  - **Frontend**: `/schedule` in `apps/admin` — a coach's own upcoming sessions grouped by day
    ("Today"/"Tomorrow"/weekday), showing time, location, capacity, and service type. Only shown
    in the sidebar nav to users who actually coach somewhere (or HQ, for testing).
  - **Not yet built**: `CoachAvailability` has no UI yet (API only) — time-off/availability
    windows aren't consumed by session creation either (a session can currently be booked outside
    a coach's stated availability; nothing enforces it yet). Booked-vs-capacity count on the
    coach's schedule isn't shown because `Booking` doesn't exist until Phase 4.
- **Dashboard charts + login/logout polish**:
  - New API endpoint `GET /sessions/summary?days=` aggregates upcoming sessions by day and by
    location, scoped identically to everything else (HQ sees the network, a Location Admin sees
    only what they manage).
  - Added a real chart component (`apps/admin/src/components/BarChart.tsx`) following the
    dataviz skill's procedure, not just "add a chart library": picked the form (single-series
    magnitude → bar chart), then **ran the palette validator** on the branding gold before using
    it as chart ink — `gold-500`/`gold-700` both failed the chroma floor ("reads as gray" at
    OKLCH C ≈0.09-0.10, below the 0.10 floor) even though they look fine as UI accent colors. Used
    a punchier same-hue-family gold (`#B8860B`, added as `--color-chart-gold`, scoped to charts
    only — branding tokens untouched) that passes lightness/chroma/contrast cleanly. Built to the
    mark spec (≤24px bars, 4px rounded top, square baseline, direct value labels) and the
    interaction spec (a real floating tooltip on hover/focus — value leads, label follows — not
    just the native SVG `<title>`, which is slow and inconsistent), plus a screen-reader-only
    data table per chart so the values are never hover-gated. Verified by rendering it and
    actually looking at a screenshot (per the skill's last step), which is what caught the
    tooltip being underbuilt on the first pass.
  - `apps/web`'s `/login`, `/register`, `/account` still had Phase 1's plain unstyled forms while
    `apps/admin` had since been redesigned — brought them up to the same bar: centered branded
    card, teal-tinted page background, labeled inputs, an avatar-initial profile card on
    `/account`. Added a proper loading spinner + disabled state to every logout button (web
    account page, admin sidebar) — previously logout gave no feedback while the request was in
    flight.
- **Phase 4 — Booking Engine & Waitlist** — the core commercial logic of the platform, verified
  with a real two-golfer concurrency scenario, not single-actor happy-path checks:
  - **API**: `BookingsModule` (`POST /sessions/:sessionId/bookings` — capacity-safe create;
    `GET /bookings/my`; `POST /bookings/:id/cancel`) and `WaitlistModule`
    (`POST /sessions/:sessionId/waitlist` — join, only allowed once a session is actually full;
    `GET /waitlist/my`; `POST /waitlist/:id/claim`). `SessionsService.findForService` (the public
    session listing) now returns `bookedCount`/`spotsLeft` per session (spec §9: "display
    remaining class capacity") without exposing raw booking rows.
  - **Capacity safety reuses Phase 3's exact pattern**: booking creation runs inside a
    `SERIALIZABLE` transaction that counts `CONFIRMED` bookings against `Session.capacity` before
    inserting; a genuine race between two concurrent bookers gets Postgres's own `P2034`
    serialization failure, surfaced as the same 409 a plain capacity check would give. The
    waitlist's claim step re-runs the same capacity check inside its own transaction (the notify
    step doesn't reserve the spot, so a claim can still lose a race to another claim).
  - **Verified spec §25's second acceptance test for real**: created a capacity-1 session, golfer
    A books the only spot, golfer B's booking attempt gets 409 and is redirected to "join
    waitlist" (blocked outright if attempted while the session still has room — the API rejects
    joining a waitlist for a non-full session), golfer B joins the waitlist at position 1, golfer
    A cancels, golfer B's waitlist entry flips to `NOTIFIED` automatically, golfer B claims and
    gets a real `CONFIRMED` booking. Also verified: a non-owner, non-staff user gets 403
    cancelling someone else's booking; the Twin Waters location admin (staff at that location)
    *can* cancel a golfer's booking there; a golfer's cancelled booking stays visible in their own
    history (audit trail, never deleted).
  - **Frontend, replacing `apps/web`'s placeholder homepage for the first time**: `/` now browses
    real active locations (public, no login needed — matches spec §13's "browse before login");
    `/locations/[id]` lists each active service with its upcoming sessions (30-day window),
    spots-left, and a Book button that becomes "Join Waitlist" once a session fills — verified
    through an actual browser click, not just the API: booking a session live-updated its spots
    count in the UI and showed a confirmation message. `/bookings` lists upcoming (cancellable),
    waitlist entries (with a "Claim spot" button once notified), and cancelled history.
  - **Known simplification, revisit later**: "cancellation-window rules" from the prompt are
    implemented as a single hard rule (can't cancel/book a session that has already started) —
    there's no configurable "must cancel N hours before" policy yet, since no such field exists
    on `Service`/`MembershipPlan` in the schema. Reschedule isn't a dedicated endpoint yet either —
    for V1 a golfer reschedules by cancelling and re-booking, which already works end-to-end
    through the existing cancel + book endpoints; a combined atomic reschedule endpoint can be
    added later if the two-step UX proves confusing. Pricing on `Booking.priceCharged` is always
    `Service.price` — no membership discount or credit redemption yet (that's Phase 5).
- **Admin forms converted to modals**: Create Location, Create Service Template, and Add Staff
  were always-visible inline cards pushing the page content down; they're now a shared
  `apps/admin/src/components/Modal.tsx` (portal-rendered overlay, Escape-to-close, backdrop-click-
  to-close, scroll-locked background) with labeled fields consistent with the rest of the app.
  Verified visually, including a real layout bug the first version had: the Templates modal's
  3-column pricing row clipped against the modal's right edge at the original `max-w-lg` — widened
  to `max-w-xl` and re-verified with a screenshot.
- **Phase 5 — Memberships, Packages & Credits** — verified with real payment-method branching,
  not just CRUD:
  - **API**: `MembershipsModule` (`MembershipPlansController` — public browse/detail, HQ-only
    write, `POST /membership-plans/:id/subscribe` for any authenticated golfer;
    `MyMembershipsController` — `GET /memberships/my`) and `CreditsModule`
    (`CreditPackagesController` — same public/HQ-only split, `POST /credit-packages/:id/purchase`;
    `MyCreditBalancesController` — `GET /credit-balances/my`). Subscribing computes `endDate` from
    `BillingPeriod` (`WEEKLY`/`MONTHLY`/`QUARTERLY`/`ANNUAL`/`NONE`→indefinite) and, if the plan
    has `includedCredits`, also grants a matching `CreditBalance` — the schema already modeled
    this combination (spec §7 "included sessions or credits"), so wiring it up was a small
    addition once the base subscribe flow existed.
  - **The core integration**: `BookingsService.create` now takes a `paymentMethod`
    (`FULL_PRICE`/`MEMBERSHIP`/`CREDIT`, default `FULL_PRICE`) and resolves it *inside* the same
    `SERIALIZABLE` transaction as the capacity check — an active membership or an eligible credit
    balance is exactly as racy a resource as the seat itself, so it's checked and consumed
    atomically with everything else, not as a separate step that could desync under concurrency.
    `MEMBERSHIP` applies `Service.memberPrice` (falls back to `Service.price` if unset) and
    respects `MembershipPlan.crossLocationAccess`/`locationId` (a location-scoped, non-cross plan
    is rejected at a different location — verified: a global cross-location plan worked at Twin
    Waters, a location-scoped one would not have). `CREDIT` calls a new
    `CreditsService.findEligibleBalance` (soonest-expiring first, filtered by
    `CreditPackage.eligibleServiceType` when set) and `redeemOne` (decrements + records a
    `CreditTransaction`), both taking the transaction's `tx` client so they participate in the
    same atomic operation. `BookingsService.cancel` mirrors this: it looks up the original debit
    `CreditTransaction` by `bookingId` and calls `refundOne` to reverse it, alongside the existing
    waitlist-notify logic, all in one transaction.
  - **Verified with curl, not just asserted**: subscribe → `endDate` correctly +30 days for
    `MONTHLY`; duplicate subscribe → 409; purchase → `CreditBalance` created with the right
    `expiresAt`; booking with `CREDIT` → `priceCharged: "0"`, balance 5→4; booking with
    `MEMBERSHIP` → `priceCharged` equals `memberPrice`, `userMembershipId` linked; cancelling the
    credit-paid booking → balance back to 5; a golfer with neither → 400 on both `CREDIT` and
    `MEMBERSHIP` attempts with distinct messages; `eligibleServiceType` filtering confirmed by
    creating an `APPOINTMENT` service and confirming a `CLASS`-only credit balance is correctly
    rejected there — **and that the rejected attempt didn't consume a credit**, proving the
    transaction actually rolled back the whole branch, not just the final insert.
  - **A UI bug caught only by actually clicking through the browser, not curl**: the booking
    page's error handler treated *any* 409 as "session is full" and flipped the button to "Join
    Waitlist" — including the unrelated "you already have a booking for this session" duplicate
    conflict, which meant a golfer who'd already booked a session with plenty of room got a
    misleading "full" prompt. Fixed by checking the error message for "full"/"filled up" before
    treating it as a capacity conflict. This is a fragile mechanism (string-matching a message)
    worth revisiting with structured error codes later, but the API's messages are
    developer-controlled text, not user input, so it's safe for now.
  - **Frontend**: `apps/web` gets `/membership` (browse plans + packages, subscribe/purchase,
    shows the golfer's current credit balances and active-membership state) and a payment-method
    `<select>` on each bookable session in `/locations/[id]` that only appears — and only offers
    the options — the golfer actually qualifies for right now (computed client-side from
    `/memberships/my` + `/credit-balances/my`, enforced authoritatively server-side regardless).
    `/bookings` now shows how each booking was paid for ("Paid via membership" / "Paid with 1
    credit" / the dollar amount).
  - **Known simplification, revisit later**: no late-cancellation-forfeit window — every
    cancellation that reaches `BookingsService.cancel` (which already requires the session hasn't
    started) refunds the credit in full, since no field models a configurable forfeit window yet.
    Waitlist claims (`WaitlistService.claim`) still always charge full price — extending
    membership/credit payment to the claim flow would be a small follow-up if it matters in
    practice.
  - **Follow-up fix**: Phase 5 originally shipped with no way for HQ to manage `MembershipPlan`s
    or `CreditPackage`s from `apps/admin` — only golfers could browse/subscribe/purchase from
    `apps/web`, and creating a plan or package required calling the API directly. Added
    `GET /membership-plans/admin/all` and `GET /credit-packages/admin/all` (HQ-only, includes
    inactive ones — same pattern as `GET /locations/admin/all` from Phase 2) plus a new
    `apps/admin` `/memberships` page (sidebar item, HQ-only): two tables (plans, packages) each
    with a "+ New ..." button opening a `Modal` create form and an activate/deactivate toggle per
    row (reusing the existing `isActive` field on `UpdateMembershipPlanDto`/
    `UpdateCreditPackageDto` rather than adding separate endpoints). Verified with a real
    browser click-through: created a `JUNIOR` plan through the modal and confirmed it appeared
    correctly in the table with the right access/status.
- **Admin app audit + fixes** — prompted by user feedback ("admin dashboard doesn't feel
  complete, UI isn't good, something technical seems missing") plus a WellnessLiving screenshot
  as a concrete reference point. Did a full visual audit (screenshotted every admin page) rather
  than guessing, which surfaced one severe functional gap and several polish gaps:
  - **The severe one**: there was no way to create a bookable session (class time slot or
    appointment slot) from `apps/admin` at all — confirmed by checking `/schedule` and finding it
    empty even though sessions existed, because every session in the dev database had been
    created via direct `curl` calls while testing Phases 3–5. Fixed with a dedicated
    `/locations/[id]/services/[serviceId]/schedule` page (linked from each activated service):
    lists upcoming sessions (coach, capacity, booked count, cancel action) plus modals for a
    one-off session and a recurring weekly schedule (day-of-week toggle buttons, time, date
    range, optional coach/capacity override) — using the `ServiceSessionsController` API that's
    existed since Phase 3 but never had a UI. Verified with a real click-through: created a
    Tue/Thu recurring schedule, confirmed 7 sessions appeared with correct times, cancelled one
    and confirmed it dropped off the list.
  - **Visual redesign of Locations + Staff**, matching the reference's card-grid style instead of
    plain tables: `/locations` is now a responsive card grid — a gradient cover banner (alternates
    across 3 brand-palette combinations so a grid of cards doesn't read as one flat block), an
    overlapping avatar-initial circle, an active/inactive status badge, and a search box (no image
    upload feature exists yet, so covers are a CSS gradient + large translucent initials rather
    than a real photo — a reasonable stand-in until file upload is built). The location detail
    page's Staff section is now a card grid too (avatar-initial circle, name, email, role badge)
    instead of a plain table.
  - **Still open, not addressed this round** (flagged for a future pass, not silently dropped):
    no edit action anywhere for an already-created Location/Service/Template (only
    activate/deactivate); "Bookings" and "Customers" are still grayed-out "Coming Soon" sidebar
    items despite the booking API existing since Phase 4 — there's still no admin view of who
    booked what, and no customer list/profile view; the Dashboard still has no revenue or booking
    stats, only location/template counts and session-count charts. Templates/Memberships pages
    still use plain tables rather than the new card style — lower priority since they're simpler,
    lower-volume lists than Locations/Staff.
- **Edit actions everywhere + a real font bug fix** — direct follow-up after the user clarified
  what they actually wanted: not a literal WellnessLiving clone, but *our* feature set with that
  level of design polish, using WellnessLiving's Locations/Staff Roles pages as concrete
  reference points.
  - **Found a real, longstanding bug while chasing "the font isn't good"**: both apps load the
    Geist font via `next/font` (exposed as `--font-geist-sans`) but `globals.css` hardcoded
    `font-family: Arial, Helvetica, sans-serif` directly on `body`, silently overriding it —
    every page in both apps had been rendering in Arial the entire time, not the font that was
    actually loaded. Fixed in both `apps/web` and `apps/admin`; confirmed via
    `getComputedStyle(document.body).fontFamily` in a real browser that it now resolves to
    `Geist, "Geist Fallback", ui-sans-serif, ...` instead of Arial.
  - **Edit added for every create-only entity**: Location (name, address, phone, email,
    description, logo URL), activated Service (name, duration, capacity, price, member price),
    HQ Service Template (same fields), Membership Plan, and Credit Package — all via a `Modal`
    edit form pre-filled from the current record, `PATCH`ing the same endpoints the toggle
    actions already used. `Modal` gained a `wide` variant (`max-w-2xl`) for the denser Location
    form rather than cramming everything into the default width.
  - **Business hours, for real**: `Location.openingHours` (a `Json?` column that existed in the
    schema since Phase 0 but had no UI) is now a structured 7-day editor in the Location edit
    modal — a checkbox per day (open/closed) plus `<input type="time">` pairs when open, matching
    the reference's day-by-day toggle pattern. Saved as a typed `OpeningHours` object
    (`apps/admin/src/lib/types.ts`), not a loose blob. Also surfaced read-only on the location
    detail page in a new "Contact & hours" card, so the data isn't buried inside an edit modal.
  - **Known limitation, called out to the user rather than silently faked**: there's no real
    image upload — no file storage/serving infrastructure exists yet (would need multer or
    similar on the API plus a storage decision: local disk vs. a cloud bucket). The Location edit
    form takes a **Logo URL** text field instead (the schema already had `logoUrl: String?`) as an
    honest interim stand-in, with a visible caption explaining why. Building real upload is a
    reasonable follow-up but is a distinct, larger feature, not a quick styling fix.
  - **Deliberately not built**: WellnessLiving-specific features that don't map to the G50 spec at
    all — "Explorer Listing" (their public marketplace/SEO directory), "Integrations" (their app
    marketplace), "Leads" — the user was explicit that they want *our* documented feature set, not
    WellnessLiving's, just at that visual/UX quality bar.
- **Classes and Appointments split into separate sections** — direct follow-up after the user
  showed WellnessLiving's actual "Classes" and "Appointments" pages (under their sidebar's
  Services group) as reference: distinct card grids, a colored left-border accent per card, an
  image/logo thumbnail, and a "⋮" menu with Edit/Deactivate/Delete, grouped by category. Adapted
  (not cloned) for what we actually have:
  - `apps/admin`'s merged `/templates` page (mixing `CLASS` and `APPOINTMENT` templates in one
    table) is now two sidebar items — **Classes** and **Appointments** — both rendering a shared
    `ServiceTemplatesPage` component (`apps/admin/src/components/ServiceTemplatesPage.tsx`)
    parameterized by `type`, so the two pages can't drift apart in behavior. Cards use a teal
    left-border for Classes, gold for Appointments, the G50 logo mark as a thumbnail (no
    per-template images exist), and a new `DropdownMenu` component (click-outside-to-close) for
    the "⋮" actions — Edit, Activate/Deactivate, Delete.
  - **Added a real, guarded `DELETE /service-templates/:id`** — the reference shows "Delete
    Class" as a plain menu item, but a template that's already been activated at one or more
    locations can't just disappear (`Service.templateId` would dangle, and those locations'
    booking data references it). The endpoint counts activations first and returns 409 with a
    clear message ("activated at N locations — deactivate instead") rather than deleting; only a
    never-activated template can actually be removed. Verified both paths with curl: blocked on
    an activated template, succeeded on a fresh throwaway one.
  - **Also split the location detail page's template-activation list** the same way — two cards,
    "Classes — activate at this location" and "Appointments — activate at this location" — instead
    of one mixed list, via a new `TemplateActivationCard` component, so the split is consistent
    everywhere a location admin browses the catalog, not just at the HQ level.
  - **Caught and fixed a real string bug while building this**: naive `${singular.toLowerCase()}s`
    pluralization produced "Search classs..." (double s) for "Class" → wrong. Added a small
    `pluralize()` helper (handles the `s`/`x`/`ch`/`sh` → `+es` case) instead of hardcoding `+s`
    everywhere.
- **Phase 7 (half) — Attendance** — the spec's §25 acceptance test literally cannot pass without
  this, so it was prioritized ahead of Payments/Notifications even though those come earlier in
  the phase list. Verified with curl (RBAC, roster, marking, booking-status sync) and a real
  browser click-through.
  - **API** (`apps/api/src/attendance/`): `GET /sessions/:sessionId/roster` (names/emails of
    everyone confirmed into a session, plus their current attendance status) and
    `POST /bookings/:id/attendance` (mark `ATTENDED`/`ABSENT`/`LATE_CANCEL`/`NO_SHOW`). Permission
    is a new `assertCanManageSession()` helper in `auth/location-access.util.ts` — same idea as
    Phase 2's `assertManagesLocation()`, but also lets through the coach actually assigned to that
    specific session (a coach isn't a `LOCATION_ADMIN`, but still needs to manage their own
    session's roster).
  - **Booking status syncs with attendance**: marking `ATTENDED` flips the `Booking` to
    `COMPLETED`; anything else flips it to `NO_SHOW` — so a golfer's own booking history in
    `apps/web` shows what actually happened instead of sitting at `CONFIRMED` forever. The
    `Attendance` row keeps the precise reason (which of the three non-attended cases applied);
    `Booking` only distinguishes attended vs. not.
  - **Credit forfeiture "just works" without new logic**: the spec (§8) wants a late
    cancellation/no-show to forfeit an already-spent credit rather than refund it. Since a credit
    is debited at *booking* time (Phase 5) and only refunded by the explicit pre-start
    `BookingsService.cancel()` path, marking a booking `NO_SHOW`/`ABSENT` after the fact never
    touches the credit ledger at all — it simply never gets refunded. No new code was needed for
    this; it falls out of the existing design.
  - **Verified the exact bug class Phase 2 taught us to check for**: an unrelated customer
    (not the coach, not staff at that location) correctly gets 403 on the roster; the assigned
    coach and HQ can both mark attendance; attempting to mark attendance on an already-cancelled
    booking correctly returns 400 rather than silently succeeding.
  - **Frontend**: a "Roster" button on every session in the coach's `/schedule` page and on the
    location's per-service schedule page, opening a shared `AttendanceModal` — one row per
    booked golfer with four status buttons, the active one highlighted. Confirmed via a real
    browser click-through that a status marked earlier (via curl) correctly shows as
    pre-selected when the modal re-opens — the roster reflects real, persisted state, not just
    an optimistic local guess.
  - **Not yet built (the other half of Phase 7)**: filterable HQ/Location dashboards (by date/
    coach/service/customer), revenue and class-utilisation reporting, coach activity, CSV export.
    Renamed the remaining prompt below to "Phase 7 — Reporting & Dashboards" to reflect that
    Attendance itself is done.
- **UI animation pass** — direct response to "make the UI fully animated, best UI/UX," applied
  as a small reusable motion system rather than one-off effects, so it's consistent everywhere
  and easy to extend:
  - `apps/admin/src/app/globals.css` now registers real Tailwind utilities (`animate-fade-in`,
    `animate-fade-in-up`, `animate-scale-in`, `animate-slide-down`, `animate-shimmer`) backed by
    actual `@keyframes`, plus a `prefers-reduced-motion` override that collapses all of them to
    near-zero duration — accessibility isn't an afterthought bolted on later.
  - Applied to the shared components everything else already builds on, so the coverage is broad
    without touching every page individually: `Modal` (backdrop fade + panel scale-in),
    `DropdownMenu` (scale-in + press feedback on the trigger), `Button` (press-scale on every
    button in the app), `Card`/`StatCard` (fade-in-up entrance + hover-lift shadow, with an
    optional stagger delay — used on the dashboard's stat row).
  - New shared `Spinner` component replacing ad-hoc inline SVGs, used in `AttendanceModal`'s
    loading state.
  - **Deliberately not done**: full page-transition animations (Next.js App Router doesn't have
    this built in without a routing-transition library; not worth the dependency weight for what
    was asked) and a toast/notification system (existing inline error/success banners just gained
    a fade-in rather than being replaced wholesale — a bigger toast-queue rework is a reasonable
    separate follow-up if it's wanted).
- **Phase 7 (second half) — Reporting & Dashboards** — completes Phase 7 now that Attendance
  feeds real data into it. Verified with curl against real dev data (not just empty-state checks)
  and confirmed HQ vs. Location Admin scoping behaves like every other reports-adjacent endpoint.
  - **API** (`apps/api/src/reports/`): `GET /reports/overview` (filterable by `locationId`, `from`,
    `to`, `serviceId`, `coachId`) aggregates bookings-by-status, attendance-by-status +
    attendance rate, revenue total + by-day series, class utilisation (booked vs. session capacity
    per service), coach activity (sessions run/bookings handled/attendance marked per coach), and
    active/expired membership counts — all from one pass over the filtered `Booking` rows (plus a
    small second query for session capacity), aggregated in application code the same way
    `SessionsService.findUpcomingSummary` already does, not raw SQL. `GET /reports/export.csv`
    returns the same filtered scope as row-per-booking CSV (date, location, service, coach,
    golfer, statuses, price) with a real `Content-Disposition: attachment` header.
  - **Revenue definition, deliberately narrow**: only `CONFIRMED`/`COMPLETED`/`NO_SHOW` bookings'
    `priceCharged` count as revenue — a `CANCELLED` booking's `priceCharged` is never counted,
    since nothing was ultimately collected for it (no Stripe integration exists yet to model an
    actual refund; see Phase 6, still not built). This falls directly out of Phase 4/5's existing
    fields, no schema change needed.
  - **Reused the exact scoping pattern from every prior phase**: `assertManagesLocation()` when a
    `locationId` filter is given; when it isn't, HQ gets the whole network (`null` scope) and a
    Location Admin is silently restricted to the location(s) they actually manage (an empty array
    if they manage none — returns a real zeroed-out response shape, not an error, matching
    `findUpcomingSummary`'s empty-state precedent).
  - **Verified with curl against real data**: HQ's unscoped overview and a Twin Waters Location
    Admin's unscoped overview returned identical numbers (Twin Waters is the only location with
    data in dev) — confirming the auto-scope actually filters rather than coincidentally matching;
    filtering to a location the Twin Waters admin does *not* manage correctly 403s with the same
    message `assertManagesLocation` gives everywhere else; a `CUSTOMER` account correctly 403s on
    `/reports/overview` outright (route-level `@Roles(HQ_ADMIN, LOCATION_ADMIN)`); CSV export
    verified by inspecting real output rows against the same filtered dataset.
  - **Frontend**: new `/reports` page in `apps/admin` (sidebar item moved out of "Coming soon" —
    only Bookings/Customers/Payments remain there now), with location + date-range filters, four
    stat cards (bookings, revenue, attendance rate, active memberships), a revenue-by-day
    `BarChart` (reusing the existing component from the dashboard chart work), bookings-by-status
    and attendance-by-status breakdowns, and class-utilisation / coach-activity tables. "Export
    CSV" is a plain link straight to the API's CSV endpoint (not a fetch+blob dance) — the auth
    cookie is host-only for `localhost` with no domain restriction, so it's sent automatically
    across the 3001→3333 port boundary on a direct navigation, same as any other same-host request.
  - **Not yet built**: there's no `Payment` data to report on (Phase 6 isn't built yet) — revenue
    is derived entirely from `Booking.priceCharged`, which is accurate for what's actually been
    charged today but won't reflect refunds/failed charges once Stripe exists. Membership/credit
    package *sales* revenue isn't broken out separately from booking revenue yet.

- **Phase 6 — Payments (Stripe)** — real Payment Intents wired end-to-end; verified with curl
  (ownership/status/RBAC edge cases, a clean Stripe auth error confirming the whole plumbing
  works up to the point where real API keys are needed) and a live Playwright click-through of
  both the booking and package-purchase flows.
  - **Schema**: added `userMembershipId`/`creditBalanceId` (both optional) to `Payment`, alongside
    the existing `bookingId` — a `Payment` now links to whichever of the three things it's paying
    for (migration `add_payment_links`).
  - **API** (`apps/api/src/payments/`): `POST /payments/bookings/:id/intent`,
    `/payments/memberships/:id/intent`, `/payments/credit-balances/:id/intent` each create (or
    reuse a still-pending) Stripe PaymentIntent for that specific already-created
    booking/membership/credit-balance and return a `clientSecret`; `GET /payments/my`;
    `POST /payments/webhook` (public, signature-verified via NestJS's `rawBody: true` app option
    rather than a raw-body-parser workaround); `POST /payments/:id/refund` (HQ/Location Admin,
    scoped via `assertManagesLocation` for booking-linked payments, HQ-only for
    membership/package payments since those aren't location-scoped the same way).
  - **Design: reserve-then-charge, not charge-then-reserve.** Bookings/memberships/credit-balances
    are still created synchronously first (Phase 4/5's existing, already-tested
    capacity/transaction logic is untouched), then a PaymentIntent is created against the
    already-existing row. If the webhook later reports `payment_intent.payment_failed`, the
    grant is undone: a failed **booking** payment releases the seat through a new
    `BookingsService.releaseForFailedPayment()` (extracted from the existing `cancel()`'s
    transaction body, so it gets the exact same credit-refund + waitlist-notify side effects as a
    normal cancellation); a failed **membership** payment sets it `CANCELLED`; a failed
    **package** payment zeroes the credit balance. This avoids redesigning the Serializable
    capacity-check transaction to hold open across an async Stripe round-trip.
  - **Revenue-safe status handling**: only `CONFIRMED`/`COMPLETED`/`NO_SHOW` bookings' amounts
    ever counted as revenue (Phase 7); a booking whose payment later fails becomes `CANCELLED`
    (via the release path above) and drops out of that count automatically — no separate
    reconciliation step needed between Phase 6 and Phase 7's reporting.
  - **Verified with curl**: a non-owner gets 403 creating a payment intent for someone else's
    booking; a zero-price booking (credit/membership-paid) and a cancelled booking both correctly
    400 rather than attempting a charge; a forged/bad webhook signature returns a clean 400 (was
    initially an unhandled 500 from Stripe's own thrown error — caught and fixed); refunding a
    non-existent payment 404s; a plain customer 403s on the refund route outright. Actually
    charging a card, and the webhook firing for real, needs the account's real Stripe test keys —
    not yet supplied, so those two steps are wired but unexercised; `StripeClientService` logs a
    clear warning and every payment-intent call fails with Stripe's own "Invalid API Key" error
    (not a crash) until `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are set in `apps/api/.env`.
  - **Frontend** (`apps/web`): new `StripePaymentPanel` component (Stripe Elements, `@stripe/
    stripe-js` + `@stripe/react-stripe-js`) dropped into the booking flow (`/locations/[id]`) and
    the membership/package flow (`/membership`) right after the existing create/subscribe/
    purchase call succeeds, gated on the item actually having a price > 0. If
    `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` isn't set (true in this dev environment right now), it
    renders an honest inline notice instead of a broken card form — confirmed via a live browser
    click-through (screenshots) that both flows still complete normally with that notice in place,
    not a crash.
  - **Not built**: an admin-facing UI for the refund endpoint (still curl/API-only — `apps/admin`
    has no Bookings/Payments list page yet at all, a pre-existing gap noted since the admin-audit
    phase); partial refunds (only full-amount); Apple Pay/Google Pay wallets (Stripe's
    PaymentElement supports them automatically once real keys are in place, no extra code needed,
    just untested here).
- **Phase 8 — Notifications** — transactional emails triggered from service methods (never
  controllers), verified with curl by exercising every real trigger against live dev data and
  reading the resulting log lines back (Resend isn't configured in this environment, so sends are
  logged instead of dispatched — see below).
  - **API** (`apps/api/src/notifications/`): `MailService` wraps the Resend SDK behind one
    `send(to, subject, html)` method that never throws — a missing `RESEND_API_KEY` or a failed
    send is caught/logged, never propagated, since an email failure must not break the booking/
    payment/waitlist operation that triggered it. `NotificationsService` sits on top with one
    named method per event (`bookingConfirmed`, `bookingCancelled`, `waitlistAvailable`,
    `paymentConfirmed`, `membershipConfirmed`, `packageConfirmed`) plus `templates.ts` for the
    actual subject/HTML. `RemindersService` runs `@Cron(EVERY_HOUR)`, scanning `CONFIRMED`
    bookings whose session starts 23–25h out and `reminderSentAt IS NULL` — the 2-hour-wide
    window against an hourly tick means a booking is never missed, and the new
    `Booking.reminderSentAt` column (migration `add_booking_reminder_sent`) makes re-checks
    idempotent instead of double-sending.
  - **Triggers wired into the actual service methods** (matching the prompt's "not from
    controllers" requirement): `BookingsService.create` → booking confirmed;
    `BookingsService`'s shared `releaseBooking` (used by both a golfer's own cancellation and
    Phase 6's failed-payment release) → cancellation email to the booking's owner, **and** a
    waitlist-availability email to whoever just got `NOTIFIED`, both fetched via the same
    transaction's return value rather than a second round-trip; `MembershipPlansService.subscribe`
    → membership confirmed; `CreditsService.purchase` → package confirmed;
    `PaymentsService.handleWebhookEvent`'s `payment_intent.succeeded` branch → payment confirmed.
  - **Reschedule has no separate template**, matching the existing V1 simplification that
    reschedule is cancel + rebook — that already produces a cancellation email and a fresh booking
    confirmation, covering the same ground spec §15 asks for.
  - **Verified with curl against live data, reading real log output back** (not just "the code
    compiles"): a real booking → `[MailService] [mail:not-configured] to=golfer1@test.com
    subject="Booking confirmed: G50 Driver Session"`; cancelling it → the matching cancellation
    log line; a capacity-1 session with golfer2 on the waitlist, golfer1 cancelling → **both** a
    cancellation email to golfer1 and a waitlist-availability email to golfer2, correctly
    addressed to each; subscribing to a plan and purchasing a package → their respective
    confirmation lines. The reminder window itself was verified by creating a session exactly
    ~24h out, booking it, and running the exact same Prisma query the cron uses — confirmed it
    matches precisely that booking and no others.
  - **Not exercised for real**: actual delivery (needs a `RESEND_API_KEY`, not yet supplied — every
    trigger above falls back to a structured log line instead, by design) and the `@Cron` tick
    actually firing on the hour (standard `@nestjs/schedule` behavior, not re-tested beyond
    confirming the module boots without error and the underlying query is correct).

---

## 🔲 Remaining — in build order

Each phase below is meant to be handed to Claude as its own prompt, one at a time, so the work
stays reviewable in chunks instead of one giant change.

### Phase 9 — Acceptance Testing

**Flow:** prove the 3 end-to-end scenarios required before V1 is considered complete (spec §25).

**Prompt:**
> Write end-to-end tests (or a manual UAT script) covering the 3 acceptance scenarios from the
> spec: (1) the full HQ → Location Admin → coach → golfer booking loop through to
> attendance/payment/reporting; (2) a full class accepts a waitlist entry, and a cancellation
> correctly promotes it; (3) the same golfer and coach accounts operate correctly across two
> different locations without duplication.

---

## How to use this doc

1. Pick the next unchecked phase.
2. Paste its prompt into a message to Claude (add any specifics — e.g. "use Resend, my API key
   is in `.env` as `RESEND_API_KEY`" — if it matters).
3. Once it's working and you're happy with it, move that phase up into **Done** with a short
   note on what was actually built, and cross it out below or delete the entry.
