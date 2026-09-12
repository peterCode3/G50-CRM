"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { AdminPayment, Location, PaymentPurpose, PaymentStatus } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

const STATUS_VARIANT: Record<PaymentStatus, "success" | "danger" | "neutral" | "warning" | "gold"> = {
  PAID: "success",
  PENDING: "warning",
  FAILED: "danger",
  REFUNDED: "neutral",
};

const STATUSES: PaymentStatus[] = ["PAID", "PENDING", "FAILED", "REFUNDED"];
const PURPOSES: PaymentPurpose[] = ["BOOKING", "MEMBERSHIP", "PACKAGE"];

export default function PaymentsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [payments, setPayments] = useState<AdminPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refundingId, setRefundingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");

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
    if (purpose) params.set("purpose", purpose);
    return params.toString();
  }, [search, locationId, status, purpose]);

  async function load() {
    setLoadingPayments(true);
    try {
      setPayments(await apiFetch<AdminPayment[]>(`/payments/admin/all?${queryString}`));
    } catch {
      setError("Couldn't load payments — please refresh.");
    } finally {
      setLoadingPayments(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, queryString]);

  async function onRefund(payment: AdminPayment) {
    if (!confirm(`Refund $${payment.amount} to ${payment.user.firstName} ${payment.user.lastName}?`)) {
      return;
    }
    setActionError(null);
    setRefundingId(payment.id);
    try {
      await apiFetch(`/payments/${payment.id}/refund`, { method: "POST" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setRefundingId(null);
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
      <PageHeader title="Payments" description="Stripe payments across the network — refund from here." />

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
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
              Purpose
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
              >
                <option value="">All</option>
                {PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            {loadingPayments && <Spinner />}
          </div>
        </Card>

        {actionError && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{actionError}</p>
        )}

        <Card>
          {payments === null ? (
            <p className="text-sm text-teal-700">Loading...</p>
          ) : payments.length === 0 ? (
            <p className="text-sm text-teal-700">No payments match these filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">For</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-4">
                      <Link href={`/customers/${p.userId}`} className="font-medium text-teal-900 hover:underline">
                        {p.user.firstName} {p.user.lastName}
                      </Link>
                      <p className="text-xs text-teal-700">{p.user.email}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-teal-700">
                      {p.purpose === "BOOKING" && p.booking
                        ? `${p.booking.session.service.name} · ${p.booking.location.name}`
                        : p.purpose.charAt(0) + p.purpose.slice(1).toLowerCase()}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-teal-900">${p.amount}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-teal-700">
                      {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {p.status === "PAID" && (
                        <Button
                          variant="danger"
                          className="!px-2 !py-1 text-xs"
                          disabled={refundingId === p.id}
                          onClick={() => onRefund(p)}
                        >
                          {refundingId === p.id ? "Refunding..." : "Refund"}
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
