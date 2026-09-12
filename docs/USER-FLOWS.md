# User Flows (as-built)

Status: closes spec §26's wireframe requirement retroactively. That
deliverable list was meant to be produced *before* development started, as
a proposal to get sign-off on; this project instead built first and is
documenting the result after the fact. These are flow diagrams of the actual
shipped routes, not pre-build wireframes — treat them as an as-built map for
onboarding/QA, not evidence the original approval gate was followed.

## Golfer / Customer (`apps/web`)

```mermaid
flowchart TD
    A["/ — browse locations"] --> B["/locations/[id] — services list"]
    B -->|expand a service| C[inline: upcoming sessions]
    C -->|pick a time| D{Logged in?}
    D -->|No| E["/login or /register"]
    E --> D
    D -->|Yes, profile incomplete| F[Complete-profile inline gate]
    F --> G
    D -->|Yes, complete| G[inline payment choice: full price / membership / credit]
    G --> H{Session full?}
    H -->|Yes| I[Join waitlist]
    H -->|No| J[Confirm booking]
    J --> K{Service type}
    K -->|Class| L[Booking CONFIRMED immediately]
    K -->|Appointment| M[Booking PENDING — awaiting coach]
    L --> N["/bookings — My Bookings"]
    M --> N
    N --> O[Reschedule inline / Cancel-Withdraw]
    N --> P["/receipts/[id] — view/print receipt"]
    Q["/account"] --> R[Edit profile inline]
    Q --> S[Quick stats: upcoming, membership, credits]
    Q --> T[Payment history list]
    U["/membership"] --> V[Subscribe to a plan, optional auto-renew]
    U --> W[Purchase a credit package]
```

## Coach / Staff (`apps/admin`, COACH role)

```mermaid
flowchart TD
    A[Login] --> B["/dashboard"]
    B --> C["/schedule — My Schedule"]
    C --> D[Open a session's roster]
    D --> E[Mark Attended / Absent / Late-cancel / No-show]
    B --> F["/booking-requests"]
    F --> G{Pending appointment request}
    G -->|Accept| H[Booking CONFIRMED, golfer notified]
    G -->|Decline| I[Booking CANCELLED as declined, seat freed to waitlist]
```

A coach's sidebar only ever shows Dashboard, My Schedule, and Booking
Requests — every HQ/Location-Admin-only page (Locations, Staff, Classes,
Reports, Bookings, Customers, Payments) is hidden by role, not just
soft-disabled (`apps/admin/src/components/Sidebar.tsx`).

## Location Admin (`apps/admin`, LOCATION_ADMIN role)

```mermaid
flowchart TD
    A[Login] --> B["/dashboard — location-scoped stats"]
    B --> C["/locations/[id]"]
    C --> D[Activate an HQ class/appointment template]
    D --> E[Set local price/capacity, assign a coach]
    E --> F["Session schedule: one-off or recurring"]
    B --> G["/staff — add/remove coaches at this location"]
    B --> H["/customers — golfers who've booked here"]
    H --> I[Edit profile, suspend/reactivate, adjust credits]
    B --> J["/bookings — cancel a booking"]
    B --> K["/payments — refund a payment"]
    B --> L["/reports — filter by service/coach/customer, export CSV"]
```

## HQ Admin (`apps/admin`, HQ_ADMIN role)

```mermaid
flowchart TD
    A[Login] --> B["/dashboard — network-wide stats"]
    B --> C["/locations — create/edit/activate/deactivate"]
    B --> D["/classes, /appointments — HQ service templates"]
    B --> E["/memberships — plans and credit packages"]
    B --> F["/staff — network-wide directory"]
    F --> G["/staff/[id] — services delivered, schedule, clients"]
    B --> H["/customers — network-wide, Add customer"]
    B --> I["/bookings, /payments — network-wide"]
    B --> J["/reports — network-wide, CSV export"]
```

## What these diagrams intentionally don't cover

- Error/edge states (expired session, declined payment, capacity races) —
  those are documented in code comments at the point they're handled, not
  duplicated here.
- The Stripe payment-collection UI itself, since it's a third-party embedded
  element (`StripePaymentPanel`), not a G50-built screen.
