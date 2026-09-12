"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { CustomerSummary, Location } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Spinner } from "@/components/Spinner";

export default function CustomersPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [customers, setCustomers] = useState<CustomerSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");

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

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (locationId) params.set("locationId", locationId);
    return params.toString();
  }, [search, locationId]);

  useEffect(() => {
    if (!user) return;
    setLoadingCustomers(true);
    apiFetch<CustomerSummary[]>(`/customers/admin/all?${queryString}`)
      .then(setCustomers)
      .catch(() => setError("Couldn't load customers — please refresh."))
      .finally(() => setLoadingCustomers(false));
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

  return (
    <>
      <PageHeader title="Customers" description="Every golfer who has booked, filterable by location." />

      <div className="flex flex-col gap-6 p-8">
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
              Search
              <input
                placeholder="Name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
              />
            </label>
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
            {loadingCustomers && <Spinner />}
          </div>
        </Card>

        <Card>
          {customers === null ? (
            <p className="text-sm text-teal-700">Loading...</p>
          ) : customers.length === 0 ? (
            <p className="text-sm text-teal-700">No customers match these filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Bookings</th>
                  <th className="py-2 pr-4">Joined</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4">
                      <Link href={`/customers/${c.id}`} className="font-medium text-teal-900 hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-teal-700">{c.email}</td>
                    <td className="py-2.5 pr-4 text-teal-700">{c.phone ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-teal-700">{c._count.bookings}</td>
                    <td className="py-2.5 pr-4 text-teal-700">
                      {new Date(c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={c.isActive ? "success" : "danger"}>{c.isActive ? "Active" : "Inactive"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
