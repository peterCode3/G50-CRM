"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";
import type {
  BookingPaymentMethod,
  CreditBalance,
  Location,
  Service,
  SessionWithAvailability,
  UserMembership,
} from "@/lib/types";
import { StripePaymentPanel } from "@/components/StripePaymentPanel";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ClockIcon, FlagIcon, PinIcon } from "@/components/icons";

function formatDateHeading(date: Date): string {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function groupByDay(sessions: SessionWithAvailability[]): [string, SessionWithAvailability[]][] {
  const groups = new Map<string, SessionWithAvailability[]>();
  for (const s of sessions) {
    const key = new Date(s.startTime).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return [...groups.entries()];
}

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [location, setLocation] = useState<Location | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [sessionsByService, setSessionsByService] = useState<
    Record<string, SessionWithAvailability[]>
  >({});
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [myMemberships, setMyMemberships] = useState<UserMembership[]>([]);
  const [myBalances, setMyBalances] = useState<CreditBalance[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load().catch(() => setError("Couldn't load this location — please refresh."));
    apiFetch<AuthenticatedUser>("/auth/me")
      .then(() => {
        setIsLoggedIn(true);
        return Promise.all([
          apiFetch<UserMembership[]>("/memberships/my"),
          apiFetch<CreditBalance[]>("/credit-balances/my"),
        ]);
      })
      .then((result) => {
        if (result) {
          setMyMemberships(result[0]);
          setMyBalances(result[1]);
        }
      })
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

  const classes = services.filter((s) => s.type === "CLASS");
  const appointments = services.filter((s) => s.type === "APPOINTMENT");

  const commonProps = {
    isLoggedIn,
    myMemberships,
    myBalances,
    onNeedLogin: () => router.push("/login"),
    onChanged: refreshSessionsFor,
  };

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40">
      <section className="border-b border-teal-100 bg-gradient-to-br from-teal-900 to-teal-700 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-sm text-teal-100/80 transition hover:text-white hover:underline"
          >
            ← All locations
          </Link>
          <h1 className="animate-fade-in-up mt-2 text-3xl font-semibold text-white">
            {location.name}
          </h1>
          {location.address && (
            <p className="animate-fade-in-up mt-2 flex items-center gap-1.5 text-teal-100">
              <PinIcon className="h-4 w-4 shrink-0" />
              {location.address}
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {services.length === 0 && (
          <p className="text-sm text-teal-700">No classes or appointments available yet.</p>
        )}

        {classes.length > 0 && (
          <div className="mb-10">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-teal-900">
              <FlagIcon className="h-5 w-5 text-teal-700" />
              Classes
            </h2>
            <div className="flex flex-col gap-6">
              {classes.map((svc, i) => (
                <ServiceCard key={svc.id} service={svc} index={i} {...commonProps} sessions={sessionsByService[svc.id] ?? []} />
              ))}
            </div>
          </div>
        )}

        {appointments.length > 0 && (
          <div>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-teal-900">
              <ClockIcon className="h-5 w-5 text-gold-900" />
              Appointments
            </h2>
            <div className="flex flex-col gap-6">
              {appointments.map((svc, i) => (
                <ServiceCard key={svc.id} service={svc} index={i} {...commonProps} sessions={sessionsByService[svc.id] ?? []} />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function ServiceCard({
  service,
  sessions,
  index,
  isLoggedIn,
  myMemberships,
  myBalances,
  onNeedLogin,
  onChanged,
}: {
  service: Service;
  sessions: SessionWithAvailability[];
  index: number;
  isLoggedIn: boolean;
  myMemberships: UserMembership[];
  myBalances: CreditBalance[];
  onNeedLogin: () => void;
  onChanged: (serviceId: string) => void;
}) {
  const now = new Date();
  const accent = service.type === "CLASS" ? "border-l-teal-600" : "border-l-gold-500";

  const hasEligibleMembership = myMemberships.some((m) => {
    if (m.status !== "ACTIVE") return false;
    if (m.endDate && new Date(m.endDate) <= now) return false;
    const plan = m.plan;
    return plan.crossLocationAccess || !plan.locationId || plan.locationId === service.locationId;
  });

  const hasEligibleCredit = myBalances.some((b) => {
    if (b.creditsRemaining <= 0) return false;
    if (b.expiresAt && new Date(b.expiresAt) <= now) return false;
    return (
      !b.package || !b.package.eligibleServiceType || b.package.eligibleServiceType === service.type
    );
  });

  const dayGroups = groupByDay(sessions);

  return (
    <div
      style={{ animationDelay: `${index * 60}ms` }}
      className={`animate-fade-in-up rounded-xl border border-l-4 border-teal-100 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md ${accent}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-teal-900">{service.name}</h3>
          {service.description && (
            <p className="mt-1 text-sm text-teal-700">{service.description}</p>
          )}
        </div>
        <Badge variant={service.type === "CLASS" ? "neutral" : "gold"}>{service.type}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-teal-700">
        <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1">
          <ClockIcon className="h-3 w-3" />
          {service.durationMinutes} min
        </span>
        <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium">${service.price}</span>
        {service.memberPrice && (
          <span className="rounded-full bg-gold-50 px-2.5 py-1 font-medium text-gold-900">
            Members ${service.memberPrice}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {sessions.length === 0 && (
          <p className="text-sm text-teal-700">No upcoming sessions in the next 30 days.</p>
        )}
        {dayGroups.map(([dayKey, daySessions]) => (
          <div key={dayKey}>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
              {formatDateHeading(new Date(dayKey))}
            </p>
            <div className="flex flex-col divide-y divide-teal-50">
              {daySessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  isLoggedIn={isLoggedIn}
                  hasEligibleMembership={hasEligibleMembership}
                  hasEligibleCredit={hasEligibleCredit}
                  price={service.price}
                  memberPrice={service.memberPrice}
                  onNeedLogin={onNeedLogin}
                  onChanged={() => onChanged(service.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  isLoggedIn,
  hasEligibleMembership,
  hasEligibleCredit,
  price,
  memberPrice,
  onNeedLogin,
  onChanged,
}: {
  session: SessionWithAvailability;
  isLoggedIn: boolean;
  hasEligibleMembership: boolean;
  hasEligibleCredit: boolean;
  price: string;
  memberPrice: string | null;
  onNeedLogin: () => void;
  onChanged: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isFull, setIsFull] = useState(session.spotsLeft != null && session.spotsLeft <= 0);
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>("FULL_PRICE");
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);

  const start = new Date(session.startTime);
  const timeLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const showPaymentSelector = hasEligibleMembership || hasEligibleCredit;

  const spotsBadge =
    session.spotsLeft == null ? null : session.spotsLeft <= 0 ? (
      <Badge variant="danger">Full</Badge>
    ) : session.spotsLeft <= 2 ? (
      <Badge variant="warning">{session.spotsLeft} left</Badge>
    ) : (
      <Badge variant="success">{session.spotsLeft} spots</Badge>
    );

  async function onBook() {
    if (!isLoggedIn) {
      onNeedLogin();
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const booking = await apiFetch<{ id: string; priceCharged: string | null }>(
        `/sessions/${session.id}/bookings`,
        { method: "POST", body: JSON.stringify({ paymentMethod }) },
      );
      setMessage({ text: "Booked! See it in My Bookings.", isError: false });
      if (paymentMethod === "FULL_PRICE" && booking.priceCharged && Number(booking.priceCharged) > 0) {
        setPayingBookingId(booking.id);
      }
      onChanged();
    } catch (err) {
      // A 409 covers two distinct cases from the API: "session is full" (offer
      // the waitlist) and "you already have a booking here" (a duplicate —
      // nothing to offer, the golfer is already in). Only the former should
      // flip the UI to "Join Waitlist"; conflating them misleads a golfer who
      // simply double-clicked into thinking a session that has room is full.
      const isCapacityConflict =
        err instanceof ApiError &&
        err.status === 409 &&
        /full|filled up/i.test(err.message);
      if (isCapacityConflict) {
        setIsFull(true);
      }
      setMessage({
        text: err instanceof ApiError ? err.message : "Something went wrong",
        isError: true,
      });
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
    <div className="flex flex-col gap-2 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-teal-900">{timeLabel}</span>
          {spotsBadge}
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <span className={`text-xs ${message.isError ? "text-red-600" : "text-green-700"}`}>
              {message.text}
            </span>
          )}
          {isFull ? (
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={onJoinWaitlist} disabled={submitting}>
              {submitting ? "..." : "Join Waitlist"}
            </Button>
          ) : (
            <>
              {showPaymentSelector && isLoggedIn && (
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as BookingPaymentMethod)}
                  className="rounded-md border border-teal-300 px-2 py-1.5 text-xs text-teal-900"
                >
                  <option value="FULL_PRICE">Pay full price</option>
                  {hasEligibleMembership && (
                    <option value="MEMBERSHIP">
                      Use membership{memberPrice ? ` ($${memberPrice})` : ""}
                    </option>
                  )}
                  {hasEligibleCredit && <option value="CREDIT">Use 1 credit</option>}
                </select>
              )}
              <Button className="!px-3 !py-1.5 text-xs" onClick={onBook} disabled={submitting}>
                {submitting ? "..." : "Book"}
              </Button>
            </>
          )}
        </div>
      </div>

      {payingBookingId && (
        <StripePaymentPanel
          intentPath={`/payments/bookings/${payingBookingId}/intent`}
          amountLabel={`$${price}`}
          onSuccess={() => {
            setPayingBookingId(null);
            setMessage({ text: "Payment successful!", isError: false });
          }}
        />
      )}
    </div>
  );
}
