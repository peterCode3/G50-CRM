"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";
import type { Location, Service, SessionWithAvailability } from "@/lib/types";

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [location, setLocation] = useState<Location | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [sessionsByService, setSessionsByService] = useState<
    Record<string, SessionWithAvailability[]>
  >({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load().catch(() => setError("Couldn't load this location — please refresh."));
    apiFetch<AuthenticatedUser>("/auth/me")
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const [loc, svcs] = await Promise.all([
      apiFetch<Location>(`/locations/${id}`),
      apiFetch<Service[]>(`/locations/${id}/services`),
    ]);
    setLocation(loc);
    setServices(svcs);

    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sessionLists = await Promise.all(
      svcs.map((svc) =>
        apiFetch<SessionWithAvailability[]>(
          `/services/${svc.id}/sessions?from=${now.toISOString()}&to=${in30Days.toISOString()}`,
        ),
      ),
    );
    const map: Record<string, SessionWithAvailability[]> = {};
    svcs.forEach((svc, i) => {
      map[svc.id] = sessionLists[i];
    });
    setSessionsByService(map);
  }

  async function refreshSessionsFor(serviceId: string) {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sessions = await apiFetch<SessionWithAvailability[]>(
      `/services/${serviceId}/sessions?from=${now.toISOString()}&to=${in30Days.toISOString()}`,
    );
    setSessionsByService((prev) => ({ ...prev, [serviceId]: sessions }));
  }

  if (error) {
    return <main className="flex flex-1 items-center justify-center text-red-600">{error}</main>;
  }

  if (!location || !services) {
    return (
      <main className="flex flex-1 items-center justify-center text-teal-700">Loading...</main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40">
      <section className="border-b border-teal-100 bg-white px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <Link href="/" className="text-sm text-teal-700 hover:underline">
            ← All locations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-teal-900">{location.name}</h1>
          {location.address && <p className="mt-1 text-teal-700">{location.address}</p>}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {services.length === 0 && (
          <p className="text-sm text-teal-700">No classes or appointments available yet.</p>
        )}
        <div className="flex flex-col gap-6">
          {services.map((svc) => (
            <ServiceCard
              key={svc.id}
              service={svc}
              sessions={sessionsByService[svc.id] ?? []}
              isLoggedIn={isLoggedIn}
              onNeedLogin={() => router.push("/login")}
              onChanged={() => refreshSessionsFor(svc.id)}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function ServiceCard({
  service,
  sessions,
  isLoggedIn,
  onNeedLogin,
  onChanged,
}: {
  service: Service;
  sessions: SessionWithAvailability[];
  isLoggedIn: boolean;
  onNeedLogin: () => void;
  onChanged: () => void;
}) {
  return (
    <div className="rounded-xl border border-teal-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-teal-900">{service.name}</h2>
          {service.description && (
            <p className="mt-1 text-sm text-teal-700">{service.description}</p>
          )}
        </div>
        <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
          {service.type}
        </span>
      </div>
      <p className="mt-2 text-sm text-teal-700">
        {service.durationMinutes} min · ${service.price}
        {service.memberPrice ? ` (members $${service.memberPrice})` : ""}
      </p>

      <div className="mt-4 flex flex-col divide-y divide-teal-50">
        {sessions.length === 0 && (
          <p className="py-3 text-sm text-teal-700">No upcoming sessions in the next 30 days.</p>
        )}
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            isLoggedIn={isLoggedIn}
            onNeedLogin={onNeedLogin}
            onChanged={onChanged}
          />
        ))}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isLoggedIn,
  onNeedLogin,
  onChanged,
}: {
  session: SessionWithAvailability;
  isLoggedIn: boolean;
  onNeedLogin: () => void;
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isFull, setIsFull] = useState(session.spotsLeft != null && session.spotsLeft <= 0);

  const start = new Date(session.startTime);
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  async function onBook() {
    if (!isLoggedIn) {
      onNeedLogin();
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await apiFetch(`/sessions/${session.id}/bookings`, { method: "POST" });
      setMessage({ text: "Booked! See it in My Bookings.", isError: false });
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setIsFull(true);
        setMessage({ text: err.message, isError: true });
      } else {
        setMessage({
          text: err instanceof ApiError ? err.message : "Something went wrong",
          isError: true,
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onJoinWaitlist() {
    if (!isLoggedIn) {
      onNeedLogin();
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      await apiFetch(`/sessions/${session.id}/waitlist`, { method: "POST" });
      setMessage({ text: "Added to the waitlist — check My Bookings for updates.", isError: false });
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : "Something went wrong",
        isError: true,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm">
        <span className="font-medium text-teal-900">{dateLabel}</span>
        <span className="ml-2 text-teal-700">{timeLabel}</span>
        {session.spotsLeft != null && (
          <span className="ml-2 text-xs text-teal-700/70">
            {session.spotsLeft > 0
              ? `${session.spotsLeft} spot${session.spotsLeft === 1 ? "" : "s"} left`
              : "Full"}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {message && (
          <span className={`text-xs ${message.isError ? "text-red-600" : "text-green-700"}`}>
            {message.text}
          </span>
        )}
        {isFull ? (
          <button
            onClick={onJoinWaitlist}
            disabled={submitting}
            className="rounded-md border border-teal-500 px-3 py-1.5 text-xs font-medium text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
          >
            {submitting ? "..." : "Join Waitlist"}
          </button>
        ) : (
          <button
            onClick={onBook}
            disabled={submitting}
            className="rounded-md bg-gold-500 px-3 py-1.5 text-xs font-medium text-teal-900 transition hover:bg-gold-700 disabled:opacity-60"
          >
            {submitting ? "..." : "Book"}
          </button>
        )}
      </div>
    </div>
  );
}
