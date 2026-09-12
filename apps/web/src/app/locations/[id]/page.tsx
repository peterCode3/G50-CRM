"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, type AuthenticatedUser } from "@/lib/api";
import type {
  CreditBalance,
  Location,
  Service,
  SessionWithAvailability,
  UserMembership,
} from "@/lib/types";
import { CompleteProfileModal } from "@/components/CompleteProfileModal";
import { ServiceBookingCard } from "@/components/ServiceBookingCard";
import { PinIcon } from "@/components/icons";

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
          <h1 className="animate-fade-in-up font-display mt-2 text-3xl font-semibold text-white">
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

        <div className="mt-6 flex flex-col gap-3">
          {filteredServices.length === 0 && (
            <p className="rounded-xl border border-teal-100 bg-white p-6 text-center text-sm text-teal-700">
              {services.length === 0 ? "No services available yet." : "Nothing matches your search."}
            </p>
          )}
          {filteredServices.map((svc, i) => (
            <div key={svc.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-in-up">
              <ServiceBookingCard
                service={svc}
                sessions={sessionsByService[svc.id] ?? []}
                hasEligibleMembership={isEligibleMembership(svc, myMemberships)}
                hasEligibleCredit={isEligibleCredit(svc, myBalances)}
                onGate={gate}
                onRefresh={() => refreshSessionsFor(svc.id)}
              />
            </div>
          ))}
        </div>
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
