"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { CustomerSummary, Location, ReportOverview, Service, StaffMember } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { BarChart, type BarChartDatum } from "@/components/BarChart";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultFrom(): string {
  return isoDate(new Date(Date.now() - 30 * 24 * 60 * 60_000));
}

function defaultTo(): string {
  return isoDate(new Date());
}

function toDayLabel(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const BOOKING_STATUS_VARIANT: Record<string, "success" | "danger" | "neutral" | "warning" | "gold"> = {
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "warning",
  WAITLISTED: "neutral",
};

const ATTENDANCE_STATUS_VARIANT: Record<string, "success" | "danger" | "neutral" | "warning" | "gold"> = {
  ATTENDED: "success",
  ABSENT: "danger",
  LATE_CANCEL: "warning",
  NO_SHOW: "danger",
};

export default function ReportsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  const [locationId, setLocationId] = useState<string>("");
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [services, setServices] = useState<Service[]>([]);
  const [coaches, setCoaches] = useState<StaffMember[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerLabel, setCustomerLabel] = useState("");
  const [customerError, setCustomerError] = useState<string | null>(null);

  const isHqAdmin = user?.globalRole === "HQ_ADMIN";

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (isHqAdmin) {
        setLocations(await apiFetch<Location[]>("/locations/admin/all"));
      } else {
        const myLocationIds = user.locations
          .filter((l) => l.role === "LOCATION_ADMIN")
          .map((l) => l.locationId);
        setLocations(await Promise.all(myLocationIds.map((id) => apiFetch<Location>(`/locations/${id}`))));
      }
    })().catch(() => setError("Couldn't load your locations — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Service/coach filters only make sense once a single location is picked —
  // there's no network-wide "all services" listing endpoint to populate them from otherwise.
  useEffect(() => {
    setServiceId("");
    setCoachId("");
    if (!locationId) {
      setServices([]);
      setCoaches([]);
      return;
    }
    apiFetch<Service[]>(`/locations/${locationId}/services`).then(setServices).catch(() => setServices([]));
    apiFetch<StaffMember[]>(`/locations/${locationId}/staff`)
      .then((staff) => setCoaches(staff.filter((s) => s.role === "COACH")))
      .catch(() => setCoaches([]));
  }, [locationId]);

  async function onApplyCustomerFilter() {
    setCustomerError(null);
    const term = customerSearch.trim();
    if (!term) {
      setCustomerId("");
      setCustomerLabel("");
      return;
    }
    try {
      const matches = await apiFetch<CustomerSummary[]>(
        `/customers/admin/all?search=${encodeURIComponent(term)}`,
      );
      const exact = matches.find((m) => m.email.toLowerCase() === term.toLowerCase()) ?? matches[0];
      if (!exact) {
        setCustomerError("No customer found with that name or email");
        return;
      }
      setCustomerId(exact.id);
      setCustomerLabel(`${exact.firstName} ${exact.lastName}`);
    } catch {
      setCustomerError("Couldn't look up that customer");
    }
  }

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (locationId) params.set("locationId", locationId);
    if (from) params.set("from", new Date(`${from}T00:00:00.000Z`).toISOString());
    if (to) params.set("to", new Date(`${to}T23:59:59.999Z`).toISOString());
    if (serviceId) params.set("serviceId", serviceId);
    if (coachId) params.set("coachId", coachId);
    if (customerId) params.set("customerId", customerId);
    return params.toString();
  }, [locationId, from, to, serviceId, coachId, customerId]);

  useEffect(() => {
    if (!user) return;
    setLoadingOverview(true);
    apiFetch<ReportOverview>(`/reports/overview?${queryString}`)
      .then(setOverview)
      .catch(() => setError("Couldn't load report data — please refresh."))
      .finally(() => setLoadingOverview(false));
  }, [user, queryString]);

  if (error) {
    return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;
  }

  if (userLoading || locations === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">
        <Spinner />
      </div>
    );
  }

  const revenueChartData: BarChartDatum[] =
    overview?.revenue.byDay.map((d) => ({ label: toDayLabel(d.date), value: Number(d.amount) })) ?? [];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Bookings, attendance, revenue and coach activity — filterable by location and date range."
        action={
          <a href={`${API_URL}/reports/export.csv?${queryString}`} target="_blank" rel="noreferrer">
            <Button variant="secondary">Export CSV</Button>
          </a>
        }
      />

      <div className="flex flex-col gap-6 p-8">
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            {locations.length > 1 && (
              <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
                Location
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
                >
                  <option value="">{isHqAdmin ? "All locations" : "All my locations"}</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
              From
              <input
                type="date"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
              To
              <input
                type="date"
                value={to}
                min={from}
                max={defaultTo()}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
              />
            </label>
            {locationId && services.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
                Service
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
                >
                  <option value="">All services</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {locationId && coaches.length > 0 && (
              <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
                Coach
                <select
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value)}
                  className="rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
                >
                  <option value="">All coaches</option>
                  {coaches.map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
              Customer
              <div className="flex items-center gap-1.5">
                <input
                  placeholder="Name or email..."
                  value={customerLabel || customerSearch}
                  onChange={(e) => {
                    setCustomerLabel("");
                    setCustomerSearch(e.target.value);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && onApplyCustomerFilter()}
                  className="w-48 rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
                />
                {customerId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerId("");
                      setCustomerLabel("");
                      setCustomerSearch("");
                    }}
                    className="text-xs text-teal-600 hover:underline"
                  >
                    Clear
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onApplyCustomerFilter}
                    className="text-xs text-teal-600 hover:underline"
                  >
                    Apply
                  </button>
                )}
              </div>
              {customerError && <span className="text-xs text-red-600">{customerError}</span>}
            </label>
            {loadingOverview && <Spinner />}
          </div>
        </Card>

        {overview && (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard label="Bookings" value={overview.bookings.total} delayMs={0} />
              <StatCard label="Revenue" value={`$${overview.revenue.total}`} delayMs={60} />
              <StatCard
                label="Attendance rate"
                value={overview.attendance.attendanceRate != null ? `${overview.attendance.attendanceRate}%` : "—"}
                hint={`${overview.attendance.total} recorded`}
                delayMs={120}
              />
              <StatCard label="Active memberships" value={overview.memberships.activeCount} delayMs={180} />
            </div>

            <Card title="Revenue by day">
              <BarChart
                title="Revenue by day"
                data={revenueChartData}
                formatValue={(v) => `$${v.toFixed(0)}`}
              />
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card title="Bookings by status">
                <ul className="flex flex-col divide-y divide-teal-50">
                  {Object.entries(overview.bookings.byStatus).map(([status, count]) => (
                    <li key={status} className="flex items-center justify-between py-2.5">
                      <Badge variant={BOOKING_STATUS_VARIANT[status] ?? "neutral"}>
                        {status.replace("_", " ")}
                      </Badge>
                      <span className="text-sm font-semibold text-teal-900">{count}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card title="Attendance by status">
                {overview.attendance.total === 0 ? (
                  <p className="text-sm text-teal-700">No attendance recorded in this range.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-teal-50">
                    {Object.entries(overview.attendance.byStatus).map(([status, count]) => (
                      <li key={status} className="flex items-center justify-between py-2.5">
                        <Badge variant={ATTENDANCE_STATUS_VARIANT[status] ?? "neutral"}>
                          {status.replace("_", " ")}
                        </Badge>
                        <span className="text-sm font-semibold text-teal-900">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card title="Class utilisation">
              {overview.classUtilisation.length === 0 ? (
                <p className="text-sm text-teal-700">No bookings in this range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium tracking-wide text-teal-700 uppercase">
                      <th className="pb-2">Service</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Booked</th>
                      <th className="pb-2">Capacity</th>
                      <th className="pb-2">Utilisation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {overview.classUtilisation.map((s) => (
                      <tr key={s.serviceId}>
                        <td className="py-2.5 font-medium text-teal-900">{s.serviceName}</td>
                        <td className="py-2.5">
                          <Badge variant={s.type === "CLASS" ? "neutral" : "gold"}>{s.type}</Badge>
                        </td>
                        <td className="py-2.5 text-teal-900">{s.totalBooked}</td>
                        <td className="py-2.5 text-teal-900">{s.totalCapacity ?? "—"}</td>
                        <td className="py-2.5 text-teal-900">
                          {s.utilisationPct != null ? `${s.utilisationPct}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title="Coach activity">
              {overview.coachActivity.length === 0 ? (
                <p className="text-sm text-teal-700">No coach-assigned sessions in this range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium tracking-wide text-teal-700 uppercase">
                      <th className="pb-2">Coach</th>
                      <th className="pb-2">Sessions run</th>
                      <th className="pb-2">Bookings handled</th>
                      <th className="pb-2">Attendance marked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {overview.coachActivity.map((c) => (
                      <tr key={c.coachId}>
                        <td className="py-2.5 font-medium text-teal-900">{c.name}</td>
                        <td className="py-2.5 text-teal-900">{c.sessionsRun}</td>
                        <td className="py-2.5 text-teal-900">{c.bookingsHandled}</td>
                        <td className="py-2.5 text-teal-900">{c.attendanceMarked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
