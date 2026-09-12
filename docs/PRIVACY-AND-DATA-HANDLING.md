# Privacy & Data Handling

Status: written to close a gap the V1 spec audit flagged as completely
unaddressed (spec §24: "Appropriate Australian privacy/data handling
considerations"). This documents what the platform actually collects and
does today, mapped against the Australian Privacy Principles (APPs) under
the *Privacy Act 1988 (Cth)*. **This is an engineering-authored working
document, not a substitute for legal review** — G50 should have a solicitor
confirm this before it's published to golfers as an actual privacy policy,
particularly around the Notifiable Data Breaches (NDB) scheme obligations
and whether G50's turnover brings it within the Act's small-business
exemption threshold.

## What personal information is actually collected

From `packages/db/prisma/schema.prisma`'s `User` model and the booking/
payment flow around it:

| Data | Where | Why it's collected |
|---|---|---|
| Name, email, phone | `User` | Account identity, contacting the golfer about their bookings |
| Password | `User.passwordHash` | Bcrypt-hashed (12 rounds), never stored or logged in plain text |
| Date of birth, gender | `User` | Junior/age-restricted class eligibility, demographic reporting |
| Address, city, postal code | `User` | Membership/location eligibility, invoicing |
| Home phone, work phone, referred-by | `User` | Optional profile fields collected at signup |
| Booking, attendance, payment history | `Booking`, `Attendance`, `Payment` | Core service delivery — what was booked, attended, paid |
| Payment card details | **Not stored** | Handled entirely by Stripe; G50's database only ever holds a `providerRef` (Stripe's payment intent id), never card number/CVV/expiry |

## Who else sees it (APP 6 — use and disclosure)

- **Coaches** see the name, email, and booking details of golfers booked
  into their own sessions only (`assertCanManageSession` — see
  `apps/api/src/auth/location-access.util.ts`) — not the full customer base.
- **Location Admins** see golfers who have booked at a location they manage,
  not the whole network (`resolveLocationScope`).
- **HQ Admins** can see network-wide data — this is the one broad-access
  role, matching spec §17's admin hierarchy.
- **Stripe** (payment processing) and **Resend** (transactional email
  delivery) are the only third parties data is shared with, and only the
  minimum needed for each: Stripe gets the amount and the golfer's name/email
  for the payment; Resend gets the recipient email address and the email
  body being sent. Neither receives booking history, address, or DOB.

## Where data is stored (APP 8 — cross-border disclosure)

The database runs on Postgres; in this development environment that's a
local Windows install. Wherever this is hosted in production, confirm the
hosting region — if the database or its backups end up outside Australia,
that's a cross-border disclosure under APP 8 and needs its own disclosure to
users, even if the processor (e.g. AWS, a US-based Postgres host) has its
own adequate safeguards. Stripe and Resend are both US-headquartered
processors; their own privacy policies govern that leg of the data flow —
G50's own policy should link to both.

## Retention and deletion

Nothing in the codebase currently deletes account data automatically —
`User.isActive` supports suspending an account, but there's no "delete my
account" flow or a data-retention expiry job. Under APP 11, personal
information should be destroyed or de-identified once it's no longer needed
for the purpose it was collected for. Two concrete gaps worth closing before
a real launch:

- No customer-initiated account deletion request path (a support/manual
  process is the fallback today — HQ can deactivate via the admin Customers
  page, but nothing purges the row).
- No defined retention period for cancelled bookings, expired memberships,
  or exhausted credit balances — they persist indefinitely today.

## Security measures already in place

- Passwords: bcrypt, 12 salt rounds, never returned by any API response
  (every admin-facing customer/staff endpoint explicitly excludes
  `passwordHash` — verified during the Bookings/Customers/Payments admin
  round after a real leak was caught and fixed).
- Auth: JWT in an httpOnly cookie, re-validated against the live `User` row
  on every request (a suspended account's existing session stops working
  immediately, not just at next login).
- Role-based access control restricts every admin-facing read/write to the
  data that role is meant to see (see the Admin Hierarchy section of the
  build roadmap and `apps/api/src/auth/`).
- Payment card data is never handled or stored by G50's own systems.

## Recommended next steps before go-live

1. Have a solicitor turn this document into an actual published Privacy
   Policy (this file is the engineering input to that, not the finished
   policy itself).
2. Decide and implement a retention/deletion policy (APP 11) and a
   customer-facing "delete my account" request path.
3. Confirm the production hosting region for Postgres and backups, and
   disclose it if data leaves Australia (APP 8).
4. Confirm whether G50's business size brings it inside or outside the
   Privacy Act's small-business exemption — this changes which obligations
   are legally mandatory versus best-practice.
