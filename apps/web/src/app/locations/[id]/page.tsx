"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";
import type {
  CreditBalance,
  Location,
  Service,
  SessionWithAvailability,
  UserMembership,
} from "@/lib/types";
import { CompleteProfileModal } from "@/components/CompleteProfileModal";
import { CheckoutModal } from "@/components/CheckoutModal";
import { BookingModal } from "@/components/BookingModal";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ClockIcon, FlagIcon, PinIcon, UsersIcon } from "@/components/icons";

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

interface ScheduleEntry {
  session: SessionWithAvailability;
  service: Service;
}

function isEligibleMembership(service: Service, myMemberships: UserMembership[]): boolean {
  const now = new Date();
  return myMemberships.some((m) => {
    if (m.status !== "ACTIVE") return false;
    if (m.endDate && new Date(m.endDate) <= now) return false;
    const plan = m.plan;
    return plan.crossLocationAccess || !plan.locationId || plan.locationId === service.locationId;
  });
}

function isEligibleCredit(service: Service, myBalances: CreditBalance[]): boolean {
  const now = new Date();
  return myBalances.some((b) => {
    if (b.creditsRemaining <= 0) return false;
    if (b.expiresAt && new Date(b.expiresAt) <= now) return false;
    return (
      !b.package || !b.package.eligibleServiceType || b.package.eligibleServiceType === service.type
    );
  });
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
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [myMemberships, setMyMemberships] = useState<UserMembership[]>([]);
  const [myBalances, setMyBalances] = useState<CreditBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bookingService, setBookingService] = useState<Service | null>(null);
  const [checkout, setCheckout] = useState<ScheduleEntry | null>(null);
  const [rowMessages, setRowMessages] = useState<Record<string, { text: string; isError: boolean }>>({});
  const [fullSessionIds, setFullSessionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    load().catch(() => setError("Couldn't load this location — please refresh."));
    apiFetch<AuthenticatedUser>("/auth/me")
      .then((me) => {
        setIsLoggedIn(true);
        setCurrentUser(me);
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

  // Gate any booking/waitlist action behind a completed profile (matches the
  // "Complete profile information" step in the reference booking flow) — a
  // golfer who's already complete never sees the modal at all.
  function requireCompleteProfile(action: () => void) {
    if (currentUser && !currentUser.profileComplete) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  function openBookingModal(service: Service) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    requireCompleteProfile(() => setBookingService(service));
  }

  function openCheckout(entry: ScheduleEntry) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    requireCompleteProfile(() => setCheckout(entry));
  }

  async function onJoinWaitlist(entry: ScheduleEntry) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    requireCompleteProfile(async () => {
      try {
        await apiFetch(`/sessions/${entry.session.id}/waitlist`, { method: "POST" });
        setRowMessages((prev) => ({
          ...prev,
          [entry.session.id]: { text: "Added to the waitlist.", isError: false },
        }));
      } catch (err) {
        setRowMessages((prev) => ({
          ...prev,
          [entry.session.id]: {
            text: err instanceof ApiError ? err.message : "Something went wrong",
            isError: true,
          },
        }));
      }
    });
  }

  const categories = useMemo(() => {
    if (!services) return [];
    const groups = new Map<string, Service[]>();
    for (const svc of services) {
      const key = svc.category || (svc.type === "CLASS" ? "Classes" : "Appointments");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(svc);
    }
    return [...groups.entries()];
  }, [services]);

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories
      .map(([name, svcs]) => [name, svcs.filter((s) => s.name.toLowerCase().includes(term))] as const)
      .filter(([, svcs]) => svcs.length > 0);
  }, [categories, search]);

  const scheduleGroups = useMemo(() => {
    if (!services) return [];
    const all: ScheduleEntry[] = services.flatMap((svc) =>
      (sessionsByService[svc.id] ?? []).map((session) => ({ session, service: svc })),
    );
    all.sort((a, b) => a.session.startTime.localeCompare(b.session.startTime));
    const groups = new Map<string, ScheduleEntry[]>();
    for (const entry of all) {
      const key = new Date(entry.session.startTime).toDateString();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }
    return [...groups.entries()];
  }, [services, sessionsByService]);

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
      <section className="border-b border-teal-100 bg-gradient-to-br from-teal-900 to-teal-700 px-6 py-12">
        <div className="mx-auto max-w-6xl">
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

      <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[340px_1fr]">
          {/* Left: searchable service catalog */}
          <div>
            <h2 className="text-lg font-semibold text-teal-900">Select a service to book</h2>
            <p className="mt-1 text-sm text-teal-700">Explore services below.</p>
            <input
              type="search"
              placeholder="Search by service name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-4 w-full rounded-md border border-teal-300 px-3 py-2 text-sm text-teal-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />

            {services.length === 0 && (
              <p className="mt-4 text-sm text-teal-700">No services available yet.</p>
            )}

            <div className="mt-5 flex flex-col gap-6">
              {filteredCategories.map(([category, svcs]) => (
                <div key={category}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                    {category}
                  </p>
                  <div className="flex flex-col gap-2">
                    {svcs.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() => openBookingModal(svc)}
                        className="flex items-center gap-3 rounded-lg border border-teal-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-md"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${
                            svc.type === "CLASS" ? "from-teal-900 to-teal-700" : "from-gold-700 to-teal-900"
                          }`}
                        >
                          {svc.type === "CLASS" ? (
                            <FlagIcon className="h-4 w-4 text-white/80" />
                          ) : (
                            <ClockIcon className="h-4 w-4 text-white/80" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-teal-900">{svc.name}</p>
                          <p className="text-xs text-teal-700">
                            ${svc.price} · {svc.durationMinutes}min
                          </p>
                        </div>
                        <span className="text-teal-400">›</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredCategories.length === 0 && (
                <p className="text-sm text-teal-700">No services match your search.</p>
              )}
            </div>
          </div>

          {/* Right: unified schedule across every service */}
          <div>
            <h2 className="text-lg font-semibold text-teal-900">Schedule</h2>
            <p className="mt-1 text-sm text-teal-700">Upcoming classes and appointments, next 30 days.</p>

            <div className="mt-5 flex flex-col gap-6">
              {scheduleGroups.length === 0 && (
                <p className="text-sm text-teal-700">No upcoming sessions in the next 30 days.</p>
              )}
              {scheduleGroups.map(([dayKey, entries]) => (
                <div key={dayKey}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                    {formatDateHeading(new Date(dayKey))}
                  </p>
                  <div className="flex flex-col divide-y divide-teal-50 rounded-xl border border-teal-100 bg-white shadow-sm">
                    {entries.map((entry) => {
                      const isFull =
                        fullSessionIds.has(entry.session.id) ||
                        (entry.session.spotsLeft != null && entry.session.spotsLeft <= 0);
                      const message = rowMessages[entry.session.id];
                      const timeLabel = new Date(entry.session.startTime).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      });
                      return (
                        <div key={entry.session.id} className="flex items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-teal-900">{entry.service.name}</p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-teal-700">
                              <span className="flex items-center gap-1">
                                <ClockIcon className="h-3 w-3" />
                                {timeLabel} · {entry.service.durationMinutes} min
                              </span>
                              {entry.session.coach && (
                                <span className="flex items-center gap-1">
                                  <UsersIcon className="h-3 w-3" />
                                  {entry.session.coach.firstName}
                                </span>
                              )}
                            </p>
                            {message && (
                              <p className={`mt-1 text-xs ${message.isError ? "text-red-600" : "text-green-700"}`}>
                                {message.text}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {!isFull && entry.session.spotsLeft != null && entry.session.spotsLeft <= 2 && (
                              <Badge variant="warning">{entry.session.spotsLeft} left</Badge>
                            )}
                            {isFull ? (
                              <Button variant="secondary" onClick={() => onJoinWaitlist(entry)}>
                                Join Waitlist
                              </Button>
                            ) : (
                              <Button onClick={() => openCheckout(entry)}>Book now</Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {bookingService && (
        <BookingModal
          service={bookingService}
          sessions={sessionsByService[bookingService.id] ?? []}
          locationName={location.name}
          locationAddress={location.address}
          onClose={() => setBookingService(null)}
          onSelectSession={(session) => {
            const service = bookingService;
            setBookingService(null);
            setCheckout({ session, service });
          }}
        />
      )}

      {checkout && (
        <CheckoutModal
          serviceName={checkout.service.name}
          locationName={location.name}
          startTime={checkout.session.startTime}
          price={checkout.service.price}
          memberPrice={checkout.service.memberPrice}
          hasEligibleMembership={isEligibleMembership(checkout.service, myMemberships)}
          hasEligibleCredit={isEligibleCredit(checkout.service, myBalances)}
          sessionId={checkout.session.id}
          onClose={() => setCheckout(null)}
          onBooked={() => refreshSessionsFor(checkout.service.id)}
          onCapacityConflict={() => {
            setFullSessionIds((prev) => new Set(prev).add(checkout.session.id));
            setCheckout(null);
          }}
        />
      )}

      {pendingAction && currentUser && (
        <CompleteProfileModal
          user={currentUser}
          onClose={() => setPendingAction(null)}
          onComplete={(updated) => {
            setCurrentUser(updated);
            const action = pendingAction;
            setPendingAction(null);
            action();
          }}
        />
      )}
    </main>
  );
}
