# Backup & Recovery Strategy

Status: written to close a gap the V1 spec audit flagged as completely unaddressed
(spec §24: "Backup/recovery strategy"). This describes what should run in the
current environment and what changes once this moves to a real hosting
provider — it does not itself run anything on a schedule yet, since this
development environment is a native Windows Postgres install, not a managed
database with its own backup product.

## What actually needs protecting

Every piece of state that matters lives in one place: the PostgreSQL database
(`g50golf`) that `packages/db/prisma/schema.prisma` defines. There are two
secondary stores:

- **Uploaded images** (`apps/api/uploads/` — location/service gallery
  photos), stored on local disk. Not currently backed up at all; low
  priority to restore (re-uploadable) but should still be captured by whatever
  file-level backup the host already runs.
- **Email delivery** (Resend) and **payments** (Stripe) — both third-party
  systems of record for their own data (delivery logs, transaction history).
  Nothing G50-specific needs backing up there beyond what's already mirrored
  into the `Payment` table.

Everything else — bookings, memberships, credits, attendance, staff/roles,
audit trail — is Postgres rows. A correct Postgres backup covers all of it.

## Recommended approach

**Managed hosting (recommended for production)**: if/when this deploys to a
managed Postgres provider (Railway, Render, Supabase, RDS, etc.), turn on
that provider's built-in automated backups — daily full snapshot, point-in-
time recovery (PITR) for at least 7 days, retained for 30 days. This is
the correct answer for a real launch: it needs no custom scripting, and
restoring from a provider snapshot is far less error-prone than restoring a
hand-rolled dump. Do not build custom backup tooling if the host already
offers this — configure it and document the restore runbook instead.

**Self-managed Postgres (current dev environment / a self-hosted VM)**: use
`pg_dump` on a schedule. A daily logical dump is sufficient for this
system's write volume (bookings/payments, not high-frequency telemetry):

```powershell
# Windows Task Scheduler, daily at 02:00 — adjust path/credentials to match
# whatever's in apps/api/.env's DATABASE_URL.
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
& "C:\Program Files\PostgreSQL\<version>\bin\pg_dump.exe" `
  --format=custom `
  --file="D:\g50golf-backups\g50golf-$stamp.dump" `
  --dbname="postgresql://g50golf:g50golf@localhost:5432/g50golf"
# Prune anything older than 30 days
Get-ChildItem "D:\g50golf-backups" -Filter *.dump |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
  Remove-Item
```

Keep the last 30 daily dumps, and copy the most recent one off-machine at
least weekly (a second disk, cloud storage bucket, wherever) — a backup that
only exists on the same machine as the database it protects doesn't survive
that machine failing.

## Restore runbook

1. Stop the API (`pnpm dev` / the running `apps/api` process) so nothing
   writes to the database mid-restore.
2. `pg_restore --clean --if-exists --dbname=<connection string> <dump file>`
   (or use the managed provider's own "restore to point in time" UI).
3. Run `pnpm --filter @g50golf/db exec prisma migrate deploy` to confirm the
   restored schema matches the current migration history (it should, if the
   dump was taken after the last deployed migration — this step is a
   safety check, not expected to change anything).
4. Restart the API, then spot-check: log in as HQ, load `/reports`, confirm a
   known recent booking is present.

## What's still open

- No backup currently runs anywhere in this environment — the above is the
  documented plan, not yet a scheduled task. Set up the Task Scheduler job
  (or the managed-host equivalent) before this handles real customer data.
- Uploaded images aren't covered by any of the above; decide whether they
  need their own backup once real production images exist, or accept the
  "re-upload if lost" risk given they're cosmetic (cover photos), not
  transactional data.
