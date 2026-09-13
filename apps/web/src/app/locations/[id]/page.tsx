"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, resolveImageUrl, type AuthenticatedUser } from "@/lib/api";
import type {
  CreditBalance,
  Location,
  OpeningHours,
  Service,
  SessionWithAvailability,
  UserMembership,
} from "@/lib/types";
import { CompleteProfileModal } from "@/components/CompleteProfileModal";
import { ServiceBookingCard } from "@/components/ServiceBookingCard";
import { SessionBookingRow } from "@/components/SessionBookingRow";
import { ChevronDownIcon, MailIcon, PinIcon } from "@/components/icons";

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

const DAY_KEYS: (keyof OpeningHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const DAY_LABELS: Record<keyof OpeningHours, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

function isOpenNow(hours: OpeningHours): boolean {
  const now = new Date();
  const key = DAY_KEYS[(now.getDay() + 6) % 7]; // Date#getDay is 0=Sunday; align to Monday-first
  const today = hours[key];
  if (today.closed) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  return minutesNow >= oh * 60 + om && minutesNow < ch * 60 + cm;
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
  const [tab, setTab] = useState<"ALL" | "CLASS" | "APPOINTMENT">("ALL");
  const [showHours, setShowHours] = useState(false);
  const [view, setView] = useState<"CARDS" | "SCHEDULE">("CARDS");

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

  // Gate any booking/waitlist action behind login, then a completed profile
  // (matches the "Complete profile information" step in the reference
  // booking flow) — a golfer who's already complete never sees either gate.
  function gate(action: () => void) {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    if (currentUser && !currentUser.profileComplete) {
      setPendingAction(() => action);
    } else {
      action();
    }
  }

  const filteredServices = useMemo(() => {
    if (!services) return [];
    const term = search.trim().toLowerCase();
    return services.filter((svc) => {
      if (tab !== "ALL" && svc.type !== tab) return false;
      if (term && !svc.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [services, search, tab]);

  const counts = useMemo(() => {
    if (!services) return { CLASS: 0, APPOINTMENT: 0 };
    return {
      CLASS: services.filter((s) => s.type === "CLASS").length,
      APPOINTMENT: services.filter((s) => s.type === "APPOINTMENT").length,
    };
  }, [services]);

  // Group the catalog by category (e.g. "Ladies", "Fitness") so it reads like
  // a real studio's service menu rather than a flat list — services with no
  // category set fall back to their type as a generic bucket.
  const categoryGroups = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const svc of filteredServices) {
      const key = svc.category || (svc.type === "CLASS" ? "Classes" : "Appointments");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(svc);
    }
    return [...map.entries()];
  }, [filteredServices]);

  // Every upcoming session across the filtered services, in one chronological
  // list grouped by day — a separate way to browse from the per-class cards,
  // for anyone who'd rather see "what's on this week" than pick a class first.
  const scheduleGroups = useMemo(() => {
    const all = filteredServices.flatMap((svc) =>
      (sessionsByService[svc.id] ?? []).map((session) => ({ session, service: svc })),
    );
    all.sort((a, b) => a.session.startTime.localeCompare(b.session.startTime));
    const map = new Map<string, typeof all>();
    for (const entry of all) {
      const key = new Date(entry.session.startTime).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    }
    return [...map.entries()];
  }, [filteredServices, sessionsByService]);

  if (error) {
    return <main className="flex flex-1 items-center justify-center text-red-600">{error}</main>;
  }

  if (!location || !services) {
    return (
      <main className="flex flex-1 items-center justify-center text-teal-700">Loading...</main>
    );
  }

  const tabs: { key: "ALL" | "CLASS" | "APPOINTMENT"; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: services.length },
    { key: "CLASS", label: "Classes", count: counts.CLASS },
    { key: "APPOINTMENT", label: "Appointments", count: counts.APPOINTMENT },
  ];

  const coverImage = location.images[0];
  const openNow = location.openingHours ? isOpenNow(location.openingHours) : null;

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40">
      <section className="relative overflow-hidden border-b border-teal-100 px-6 py-14">
        {coverImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveImageUrl(coverImage)}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-teal-950/90 via-teal-900/70 to-teal-900/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-teal-900 to-teal-700" />
        )}

        <div className="relative mx-auto max-w-4xl">
          <Link
            href="/"
            className="text-sm text-teal-100/80 transition hover:text-white hover:underline"
          >
            ← All locations
          </Link>
          <div className="mt-2 flex items-center gap-3">
            {location.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveImageUrl(location.logoUrl)}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full border-2 border-white/70 bg-white object-contain p-1 shadow-lg"
              />
            )}
            <h1 className="animate-fade-in-up font-display text-3xl font-semibold text-white">
              {location.name}
            </h1>
          </div>

          <div className="animate-fade-in-up mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-teal-100">
            {location.address && (
              <span className="flex items-center gap-1.5">
                <PinIcon className="h-3.5 w-3.5 shrink-0" />
                {location.address}
              </span>
            )}
            {location.phone && (
              <a href={`tel:${location.phone}`} className="flex items-center gap-1.5 hover:text-white hover:underline">
                {location.phone}
              </a>
            )}
            {location.email && (
              <a href={`mailto:${location.email}`} className="flex items-center gap-1.5 hover:text-white hover:underline">
                <MailIcon className="h-3.5 w-3.5 shrink-0" />
                {location.email}
              </a>
            )}
            {location.openingHours && (
              <button
                onClick={() => setShowHours((v) => !v)}
                className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 font-medium text-white transition hover:bg-white/20"
              >
                {openNow ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
                )}
                {openNow ? "Open now" : "Closed now"}
                <ChevronDownIcon
                  className={`h-3 w-3 transition-transform ${showHours ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>

          {showHours && location.openingHours && (
            <div className="animate-fade-in-up mt-3 grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-white/10 p-3 text-xs text-teal-50 backdrop-blur-sm">
              {DAY_KEYS.map((key) => {
                const day = location.openingHours![key];
                return (
                  <div key={key} className="flex items-center justify-between gap-2">
                    <span>{DAY_LABELS[key]}</span>
                    <span className="text-teal-100/80">
                      {day.closed ? "Closed" : `${formatHour(day.open)} – ${formatHour(day.close)}`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h2 className="font-display text-xl font-semibold text-teal-900">
          Classes &amp; appointments
        </h2>
        <p className="mt-1 text-sm text-teal-700">
          Tap anything below to see upcoming times and book — no popups, just pick a time and go.
        </p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1 rounded-lg bg-teal-100/60 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
                  tab === t.key ? "bg-white text-teal-900 shadow-sm" : "text-teal-700 hover:text-teal-900"
                }`}
              >
                {t.label} <span className="text-teal-500">({t.count})</span>
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-teal-300 px-3 py-2 text-sm text-teal-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 sm:w-64"
          />
        </div>

        <div className="mt-4 flex gap-1 rounded-lg border border-teal-100 bg-white p-1 sm:w-fit">
          <button
            onClick={() => setView("CARDS")}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
              view === "CARDS" ? "bg-teal-900 text-white" : "text-teal-700 hover:bg-teal-50"
            }`}
          >
            By class
          </button>
          <button
            onClick={() => setView("SCHEDULE")}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition ${
              view === "SCHEDULE" ? "bg-teal-900 text-white" : "text-teal-700 hover:bg-teal-50"
            }`}
          >
            Full schedule
          </button>
        </div>

        {view === "CARDS" ? (
          <div className="mt-6 flex flex-col gap-6">
            {filteredServices.length === 0 && (
              <p className="rounded-xl border border-teal-100 bg-white p-6 text-center text-sm text-teal-700">
                {services.length === 0 ? "No services available yet." : "Nothing matches your search."}
              </p>
            )}
            {categoryGroups.map(([categoryName, svcs], groupIndex) => (
              <div key={categoryName}>
                {categoryGroups.length > 1 && (
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                    {categoryName}
                  </h3>
                )}
                <div className="flex flex-col gap-3">
                  {svcs.map((svc, i) => (
                    <div
                      key={svc.id}
                      style={{ animationDelay: `${(groupIndex * svcs.length + i) * 40}ms` }}
                      className="animate-fade-in-up"
                    >
                      <ServiceBookingCard
                        service={svc}
                        sessions={sessionsByService[svc.id] ?? []}
                        hasEligibleMembership={isEligibleMembership(svc, myMemberships)}
                        hasEligibleCredit={isEligibleCredit(svc, myBalances)}
                        defaultOpen={svc.type === "CLASS"}
                        locationName={location.name}
                        locationAddress={location.address}
                        onGate={gate}
                        onRefresh={() => refreshSessionsFor(svc.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            {scheduleGroups.length === 0 && (
              <p className="rounded-xl border border-teal-100 bg-white p-6 text-center text-sm text-teal-700">
                No upcoming sessions in the next 30 days.
              </p>
            )}
            {scheduleGroups.map(([dayKey, entries], i) => (
              <div key={dayKey} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-in-up">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                  {formatDateHeading(new Date(dayKey))}
                </p>
                <div className="flex flex-col divide-y divide-teal-50 overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm">
                  {entries.map(({ session, service: svc }) => (
                    <SessionBookingRow
                      key={session.id}
                      session={session}
                      service={svc}
                      showServiceName
                      hasEligibleMembership={isEligibleMembership(svc, myMemberships)}
                      hasEligibleCredit={isEligibleCredit(svc, myBalances)}
                      locationName={location.name}
                      locationAddress={location.address}
                      onGate={gate}
                      onRefresh={() => refreshSessionsFor(svc.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
