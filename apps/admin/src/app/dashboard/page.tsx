"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { Location, ServiceTemplate } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { BarChart, type BarChartDatum } from "@/components/BarChart";

interface SessionsSummary {
  byDay: { date: string; count: number }[];
  byLocation: { locationId: string; locationName: string; count: number }[];
}

function toDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", timeZone: "UTC" });
}

export default function DashboardPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [templates, setTemplates] = useState<ServiceTemplate[] | null>(null);
  const [summary, setSummary] = useState<SessionsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHqAdmin = user?.globalRole === "HQ_ADMIN";
  const isLocationAdminAnywhere =
    isHqAdmin || (user?.locations.some((l) => l.role === "LOCATION_ADMIN") ?? false);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setError("Couldn't load dashboard data — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (isHqAdmin) {
      const [locs, tpls, summ] = await Promise.all([
        apiFetch<Location[]>("/locations/admin/all"),
        apiFetch<ServiceTemplate[]>("/service-templates"),
        apiFetch<SessionsSummary>("/sessions/summary?days=14"),
      ]);
      setLocations(locs);
      setTemplates(tpls);
      setSummary(summ);
    } else {
      const myLocationIds = user!.locations
        .filter((l) => l.role === "LOCATION_ADMIN")
        .map((l) => l.locationId);
      const [locs, summ] = await Promise.all([
        Promise.all(myLocationIds.map((id) => apiFetch<Location>(`/locations/${id}`))),
        isLocationAdminAnywhere
          ? apiFetch<SessionsSummary>("/sessions/summary?days=14")
          : Promise.resolve(null),
      ]);
      setLocations(locs);
      setTemplates([]);
      setSummary(summ);
    }
  }

  if (error) {
    return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;
  }

  if (userLoading || !user || locations === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">Loading...</div>
    );
  }

  const activeCount = locations.filter((l) => l.isActive).length;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.firstName}`}
        description={
          isHqAdmin
            ? "Network-wide overview across all G50 locations."
            : "Overview of the location(s) you manage."
        }
      />

      <div className="flex flex-col gap-6 p-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label={isHqAdmin ? "Total locations" : "My locations"}
            value={locations.length}
          />
          <StatCard label="Active locations" value={activeCount} />
          {isHqAdmin && (
            <StatCard label="Service templates" value={templates?.length ?? 0} />
          )}
          <StatCard
            label="Your role"
            value={user.globalRole.replace("_", " ")}
            hint={user.locations.length > 0 ? `${user.locations.length} location role(s)` : undefined}
          />
        </div>

        {isLocationAdminAnywhere && summary && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Upcoming sessions, next 14 days">
              <BarChart
                title="Upcoming sessions by day, next 14 days"
                data={summary.byDay.map<BarChartDatum>((d) => ({
                  label: toDayLabel(d.date),
                  value: d.count,
                }))}
              />
            </Card>
            <Card title="Upcoming sessions by location">
              <BarChart
                title="Upcoming sessions by location, next 14 days"
                data={summary.byLocation.map<BarChartDatum>((d) => ({
                  label: d.locationName,
                  value: d.count,
                }))}
              />
            </Card>
          </div>
        )}

        <Card
          title={isHqAdmin ? "All locations" : "My locations"}
          action={
            <Link href="/locations">
              <Button variant="ghost" className="!px-2 !py-1 text-xs">
                View all →
              </Button>
            </Link>
          }
        >
          {locations.length === 0 ? (
            <p className="text-sm text-teal-700">
              {isHqAdmin ? "No locations yet — create one to get started." : "No locations assigned to you yet."}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-teal-50">
              {locations.slice(0, 5).map((loc) => (
                <li key={loc.id} className="flex items-center justify-between py-3">
                  <Link href={`/locations/${loc.id}`} className="text-sm font-medium text-teal-900 hover:underline">
                    {loc.name}
                  </Link>
                  <Badge variant={loc.isActive ? "success" : "danger"}>
                    {loc.isActive ? "Active" : "Inactive"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
