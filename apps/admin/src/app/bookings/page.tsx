"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminBooking, BookingStatus, Location } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

const STATUS_VARIANT: Record<BookingStatus, "success" | "danger" | "neutral" | "warning" | "gold"> = {
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "warning",
  WAITLISTED: "neutral",
};

const STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "WAITLISTED"];

export default function BookingsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");

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
    if (status) params.set("status", status);
    return params.toString();
  }, [search, locationId, status]);

  async function load() {
    setLoadingBookings(true);
    try {
      setBookings(await apiFetch<AdminBooking[]>(`/bookings/admin/all?${queryString}`));
    } catch {
      setError("Couldn't load bookings — please refresh.");
    } finally {
      setLoadingBookings(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, queryString]);

  async function onCancel(booking: AdminBooking) {
    setActionError(null);
    try {
      await apiFetch(`/bookings/${booking.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Cancelled by admin" }),
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

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
      <PageHeader title="Bookings" description="Every booking across the network, filterable by location, status and customer." />

      <div className="flex flex-col gap-6 p-8">
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
              Search
              <input
                placeholder="Customer name or email..."
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
            <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
              >
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            {loadingBookings && <Spinner />}
          </div>
        </Card>

        {actionError && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{actionError}</p>
        )}

        <Card>
          {bookings === null ? (
            <p className="text-sm text-teal-700">Loading...</p>
          ) : bookings.length === 0 ? (
            <p className="text-sm text-teal-700">No bookings match these filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Service</th>
                  <th className="py-2 pr-4">Location</th>
                  <th className="py-2 pr-4">Session</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 pr-4">
                      <Link href={`/customers/${b.userId}`} className="font-medium text-teal-900 hover:underline">
                        {b.user.firstName} {b.user.lastName}
                      </Link>
                      <p className="text-xs text-teal-700">{b.user.email}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-teal-900">{b.session.service.name}</td>
                    <td className="py-2.5 pr-4 text-teal-700">{b.location.name}</td>
                    <td className="py-2.5 pr-4 text-teal-700">
                      {new Date(b.session.startTime).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={STATUS_VARIANT[b.status]}>{b.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-teal-700">
                      {b.priceCharged ? `$${b.priceCharged}` : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {b.status === "CONFIRMED" && (
                        <Button variant="danger" className="!px-2 !py-1 text-xs" onClick={() => onCancel(b)}>
                          Cancel
                        </Button>
                      )}
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
