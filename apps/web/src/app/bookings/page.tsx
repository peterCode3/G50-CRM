"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { Booking, SessionWithAvailability, WaitlistEntry } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { CalendarIcon, ChevronDownIcon, PinIcon } from "@/components/icons";

function formatSessionTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function paymentLabel(b: Booking): string {
  if (b.userMembershipId) return "Paid via membership";
  if (b.priceCharged === "0") return "Paid with 1 credit";
  return b.priceCharged ? `$${b.priceCharged}` : "";
}

const STATUS_VARIANT = {
  PENDING: "gold",
  CANCELLED: "danger",
  COMPLETED: "success",
  NO_SHOW: "warning",
  CONFIRMED: "neutral",
  WAITLISTED: "neutral",
} as const;

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const [b, w] = await Promise.all([
        apiFetch<Booking[]>("/bookings/my"),
        apiFetch<WaitlistEntry[]>("/waitlist/my"),
      ]);
      setBookings(b);
      setWaitlist(w);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
      } else {
        setLoadError("Couldn't load your bookings — please refresh.");
      }
    }
  }

  async function onCancel(bookingId: string) {
    setActionError(null);
    setBusyId(bookingId);
    try {
      await apiFetch(`/bookings/${bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function onClaim(entryId: string) {
    setActionError(null);
    setBusyId(entryId);
    try {
      await apiFetch(`/waitlist/${entryId}/claim`, { method: "POST" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (loadError) {
    return <main className="flex flex-1 items-center justify-center text-red-600">{loadError}</main>;
  }

  if (bookings === null || waitlist === null) {
    return (
      <main className="flex flex-1 items-center justify-center bg-teal-50/40 text-teal-700">
        <Spinner className="h-6 w-6" />
      </main>
    );
  }

  const now = new Date();
  const upcoming = bookings
    .filter((b) => (b.status === "CONFIRMED" || b.status === "PENDING") && new Date(b.session.startTime) >= now)
    .sort((a, b) => a.session.startTime.localeCompare(b.session.startTime));
  const past = bookings
    .filter(
      (b) => !(b.status === "CONFIRMED" || b.status === "PENDING") || new Date(b.session.startTime) < now,
    )
    .sort((a, b) => b.session.startTime.localeCompare(a.session.startTime));

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40">
      <section className="border-b border-teal-100 bg-gradient-to-br from-teal-900 to-teal-700 px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display animate-fade-in-up text-3xl font-semibold text-white">
            My Bookings
          </h1>
          <p className="animate-fade-in-up mt-2 text-teal-100">
            Your upcoming sessions, waitlist spots and history.
          </p>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
        {actionError && (
          <p className="animate-fade-in rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">
            {actionError}
          </p>
        )}

        {waitlist.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-teal-700 uppercase">
              Waitlist
            </h2>
            <div className="flex flex-col gap-2">
              {waitlist.map((w, i) => (
                <div
                  key={w.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="animate-fade-in-up flex items-center justify-between rounded-lg border border-teal-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="text-sm">
                    <p className="font-medium text-teal-900">{w.session.service.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-teal-700">
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                      {formatSessionTime(w.session.startTime)}
                      <PinIcon className="ml-1 h-3.5 w-3.5 shrink-0" />
                      {w.session.location.name}
                    </p>
                    <p className="mt-1.5">
                      {w.status === "NOTIFIED" ? (
                        <Badge variant="success">A spot is open for you!</Badge>
                      ) : (
                        <Badge variant="neutral">Waiting — position {w.position}</Badge>
                      )}
                    </p>
                  </div>
                  {w.status === "NOTIFIED" && (
                    <Button disabled={busyId === w.id} onClick={() => onClaim(w.id)}>
                      {busyId === w.id ? "..." : "Claim spot"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-teal-700 uppercase">
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-teal-100 bg-white p-6 text-center text-sm">
              <p className="text-teal-700">No upcoming bookings yet.</p>
              <Link href="/" className="mt-2 inline-block font-medium text-teal-900 hover:underline">
                Browse locations →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((b, i) => (
                <div
                  key={b.id}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="animate-fade-in-up overflow-hidden rounded-lg border border-teal-100 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between p-4">
                    <div className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-teal-900">{b.session.service.name}</p>
                        {b.status === "PENDING" && <Badge variant="gold">Awaiting confirmation</Badge>}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-teal-700">
                        <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                        {formatSessionTime(b.session.startTime)}
                        <PinIcon className="ml-1 h-3.5 w-3.5 shrink-0" />
                        {b.session.location.name}
                      </p>
                      <p className="mt-1 text-xs text-teal-700/70">{paymentLabel(b)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={busyId === b.id}
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => setReschedulingId(reschedulingId === b.id ? null : b.id)}
                      >
                        Reschedule
                        <ChevronDownIcon
                          className={`ml-1 inline h-3 w-3 transition-transform ${reschedulingId === b.id ? "rotate-180" : ""}`}
                        />
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={busyId === b.id}
                        className="!border-red-400 !bg-red-50 !px-3 !py-1.5 !text-red-700 text-xs hover:!bg-red-100"
                        onClick={() => onCancel(b.id)}
                      >
                        {busyId === b.id ? "..." : b.status === "PENDING" ? "Withdraw" : "Cancel"}
                      </Button>
                    </div>
                  </div>

                  {reschedulingId === b.id && (
                    <RescheduleOptions
                      booking={b}
                      onDone={() => {
                        setReschedulingId(null);
                        load();
                      }}
                      onError={(msg) => setActionError(msg)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {past.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-teal-700 uppercase">
              History
            </h2>
            <div className="flex flex-col gap-2">
              {past.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-teal-50 bg-white/60 p-4 text-sm"
                >
                  <div>
                    <p className="font-medium text-teal-900">{b.session.service.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-teal-700">
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
                      {formatSessionTime(b.session.startTime)}
                      <PinIcon className="ml-1 h-3.5 w-3.5 shrink-0" />
                      {b.session.location.name}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[b.status]}>{b.status.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function RescheduleOptions({
  booking,
  onDone,
  onError,
}: {
  booking: Booking;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [sessions, setSessions] = useState<SessionWithAvailability[] | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  useEffect(() => {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    apiFetch<SessionWithAvailability[]>(
      `/services/${booking.session.service.id}/sessions?from=${now.toISOString()}&to=${in30Days.toISOString()}`,
    )
      .then((all) => setSessions(all.filter((s) => s.id !== booking.sessionId)))
      .catch(() => setSessions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.id]);

  async function onMove(sessionId: string) {
    setMovingId(sessionId);
    try {
      await apiFetch(`/bookings/${booking.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ newSessionId: sessionId }),
      });
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "Something went wrong");
      setMovingId(null);
    }
  }

  return (
    <div className="animate-fade-in-up border-t border-teal-50 bg-teal-50/40 p-4">
      <p className="mb-2 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
        Choose a new time
      </p>
      {sessions === null ? (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-teal-700">No other upcoming times available for this service.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sessions.map((s) => {
            const isFull = s.spotsLeft != null && s.spotsLeft <= 0;
            return (
              <button
                key={s.id}
                type="button"
                disabled={isFull || movingId !== null}
                onClick={() => onMove(s.id)}
                className="flex items-center justify-between rounded-md border-2 border-teal-100 bg-white px-3 py-2 text-left text-sm transition hover:border-gold-500 hover:bg-gold-50/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-medium text-teal-900">{formatSessionTime(s.startTime)}</span>
                {isFull ? (
                  <span className="text-xs text-teal-500">Full</span>
                ) : movingId === s.id ? (
                  <Spinner />
                ) : (
                  <span className="text-xs text-teal-600">Move here</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
