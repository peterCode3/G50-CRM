"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { Booking, WaitlistEntry } from "@/lib/types";

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

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
    try {
      await apiFetch(`/bookings/${bookingId}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onClaim(entryId: string) {
    setActionError(null);
    try {
      await apiFetch(`/waitlist/${entryId}/claim`, { method: "POST" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (loadError) {
    return <main className="flex flex-1 items-center justify-center text-red-600">{loadError}</main>;
  }

  if (bookings === null || waitlist === null) {
    return (
      <main className="flex flex-1 items-center justify-center text-teal-700">Loading...</main>
    );
  }

  const now = new Date();
  const upcoming = bookings
    .filter((b) => b.status === "CONFIRMED" && new Date(b.session.startTime) >= now)
    .sort((a, b) => a.session.startTime.localeCompare(b.session.startTime));
  const past = bookings
    .filter((b) => b.status !== "CONFIRMED" || new Date(b.session.startTime) < now)
    .sort((a, b) => b.session.startTime.localeCompare(a.session.startTime));

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40 px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-teal-900">My Bookings</h1>

        {actionError && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{actionError}</p>
        )}

        {waitlist.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-teal-700 uppercase">
              Waitlist
            </h2>
            <div className="flex flex-col gap-2">
              {waitlist.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-lg border border-teal-100 bg-white p-4 shadow-sm"
                >
                  <div className="text-sm">
                    <p className="font-medium text-teal-900">{w.session.service.name}</p>
                    <p className="text-teal-700">
                      {formatSessionTime(w.session.startTime)} · {w.session.location.name}
                    </p>
                    <p className="mt-1 text-xs text-teal-700/70">
                      {w.status === "NOTIFIED"
                        ? "A spot is open for you!"
                        : `Waiting — position ${w.position}`}
                    </p>
                  </div>
                  {w.status === "NOTIFIED" && (
                    <button
                      onClick={() => onClaim(w.id)}
                      className="rounded-md bg-gold-500 px-3 py-1.5 text-xs font-medium text-teal-900 transition hover:bg-gold-700"
                    >
                      Claim spot
                    </button>
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
            <p className="text-sm text-teal-700">No upcoming bookings.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {upcoming.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg border border-teal-100 bg-white p-4 shadow-sm"
                >
                  <div className="text-sm">
                    <p className="font-medium text-teal-900">{b.session.service.name}</p>
                    <p className="text-teal-700">
                      {formatSessionTime(b.session.startTime)} · {b.session.location.name}
                    </p>
                    <p className="mt-0.5 text-xs text-teal-700/70">{paymentLabel(b)}</p>
                  </div>
                  <button
                    onClick={() => onCancel(b.id)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Cancel
                  </button>
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
                    <p className="text-teal-700">
                      {formatSessionTime(b.session.startTime)} · {b.session.location.name}
                    </p>
                  </div>
                  <span className="text-xs text-teal-700/70">{b.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
