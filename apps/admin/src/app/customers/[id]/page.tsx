"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { BookingStatus, CustomerDetail } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";

const BOOKING_STATUS_VARIANT: Record<BookingStatus, "success" | "danger" | "neutral" | "warning" | "gold"> = {
  PENDING: "gold",
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "warning",
  WAITLISTED: "neutral",
};

const inputClass =
  "rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showAdjustCredits, setShowAdjustCredits] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  async function load() {
    const result = await apiFetch<CustomerDetail>(`/customers/${id}`);
    setCustomer(result);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't load this customer — please refresh."),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onToggleStatus() {
    if (!customer) return;
    const nextActive = !customer.isActive;
    if (!nextActive && !confirm(`Suspend ${customer.firstName} ${customer.lastName}'s account? They won't be able to log in.`)) {
      return;
    }
    setStatusBusy(true);
    setStatusError(null);
    try {
      await apiFetch(`/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive }),
      });
      await load();
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setStatusBusy(false);
    }
  }

  if (error) {
    return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;
  }

  if (!customer) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">
        <Spinner />
      </div>
    );
  }

  const initial = customer.firstName.charAt(0).toUpperCase();

  return (
    <>
      <PageHeader
        title={`${customer.firstName} ${customer.lastName}`}
        description={customer.email}
        action={
          <Link href="/customers" className="text-sm text-teal-700 hover:underline">
            ← All customers
          </Link>
        }
      />

      <div className="flex flex-col gap-6 p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-700 text-2xl font-semibold text-teal-900">
                {initial}
              </div>
              <div>
                <p className="font-semibold text-teal-900">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="text-sm text-teal-700">{customer.email}</p>
              </div>
              <Badge variant={customer.isActive ? "success" : "danger"}>
                {customer.isActive ? "Active" : "Suspended"}
              </Badge>
            </div>

            <dl className="mt-5 flex flex-col gap-2 border-t border-teal-50 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-teal-700">Phone</dt>
                <dd className="text-teal-900">{customer.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-teal-700">Date of birth</dt>
                <dd className="text-teal-900">
                  {customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString() : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-teal-700">Address</dt>
                <dd className="text-teal-900">{customer.address ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-teal-700">City</dt>
                <dd className="text-teal-900">{customer.city ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-teal-700">Postal code</dt>
                <dd className="text-teal-900">{customer.postalCode ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-teal-700">Joined</dt>
                <dd className="text-teal-900">
                  {new Date(customer.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>

            {statusError && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{statusError}</p>
            )}

            <div className="mt-5 flex flex-col gap-2 border-t border-teal-50 pt-4">
              <Button variant="secondary" onClick={() => setShowEdit(true)}>
                Edit profile
              </Button>
              <Button
                variant={customer.isActive ? "danger" : "primary"}
                disabled={statusBusy}
                onClick={onToggleStatus}
              >
                {statusBusy ? "..." : customer.isActive ? "Suspend account" : "Reactivate account"}
              </Button>
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <Card title="Memberships">
              {customer.memberships.length === 0 ? (
                <p className="text-sm text-teal-700">No memberships.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-teal-50">
                  {customer.memberships.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-teal-900">{m.plan.name}</p>
                        <p className="text-xs text-teal-700">
                          Since {new Date(m.startDate).toLocaleDateString()}
                          {m.endDate ? ` · until ${new Date(m.endDate).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      <Badge variant={m.status === "ACTIVE" ? "success" : "neutral"}>{m.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Credit balances"
              action={
                <button
                  onClick={() => setShowAdjustCredits(true)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-50"
                >
                  Adjust
                </button>
              }
            >
              {customer.creditBalances.length === 0 ? (
                <p className="text-sm text-teal-700">No credit balances.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-teal-50">
                  {customer.creditBalances.map((b) => (
                    <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-teal-900">{b.package?.name ?? "Credits"}</p>
                        {b.expiresAt && (
                          <p className="text-xs text-teal-700">
                            Expires {new Date(b.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-teal-900">{b.creditsRemaining} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`Booking history (${customer.bookings.length})`}>
              {customer.bookings.length === 0 ? (
                <p className="text-sm text-teal-700">No bookings yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                      <th className="py-2 pr-4">Service</th>
                      <th className="py-2 pr-4">Location</th>
                      <th className="py-2 pr-4">Session</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Attendance</th>
                      <th className="py-2 pr-4">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {customer.bookings.map((b) => (
                      <tr key={b.id}>
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
                          <Badge variant={BOOKING_STATUS_VARIANT[b.status]}>{b.status.replace("_", " ")}</Badge>
                        </td>
                        <td className="py-2.5 pr-4">
                          {b.attendance ? (
                            <Badge variant={b.attendance.status === "ATTENDED" ? "success" : "warning"}>
                              {b.attendance.status.replace("_", " ")}
                            </Badge>
                          ) : (
                            <span className="text-teal-700/50">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-teal-700">
                          {b.priceCharged ? `$${b.priceCharged}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title={`Payment history (${customer.payments.length})`}>
              {customer.payments.length === 0 ? (
                <p className="text-sm text-teal-700">No payments yet.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                      <th className="py-2 pr-4">Item</th>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {customer.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-4 text-teal-900">
                          {p.booking?.session.service.name ??
                            p.userMembership?.plan.name ??
                            p.creditBalance?.package?.name ??
                            p.purpose}
                        </td>
                        <td className="py-2.5 pr-4 text-teal-700">
                          {new Date(p.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Badge
                            variant={
                              p.status === "PAID"
                                ? "success"
                                : p.status === "REFUNDED"
                                  ? "neutral"
                                  : p.status === "FAILED"
                                    ? "danger"
                                    : "gold"
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-teal-700">
                          ${p.amount} {p.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </div>
      </div>

      <EditCustomerModal
        open={showEdit}
        customer={customer}
        onClose={() => setShowEdit(false)}
        onSaved={load}
      />
      <AdjustCreditsModal
        open={showAdjustCredits}
        customerId={customer.id}
        onClose={() => setShowAdjustCredits(false)}
        onSaved={load}
      />
    </>
  );
}

function AdjustCreditsModal({
  open,
  customerId,
  onClose,
  onSaved,
}: {
  open: boolean;
  customerId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDelta("");
    setReason("");
    setError(null);
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = Number(delta);
    if (!value) {
      setError("Enter a non-zero number of credits");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/customers/${customerId}/credits/adjust`, {
        method: "POST",
        body: JSON.stringify({ delta: value, reason }),
      });
      onClose();
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust credits"
      description="Manually grant or remove credits, outside a purchase — e.g. a goodwill credit or correcting an error."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Amount</span>
          <input
            required
            type="number"
            placeholder="e.g. 3 to add, -1 to remove"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            className="rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
          <span className="text-xs text-teal-700">Positive to add credits, negative to remove.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Reason</span>
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Goodwill credit for cancelled class"
            className="rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </label>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Apply"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditCustomerModal({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer: CustomerDetail;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState(customer.firstName);
  const [lastName, setLastName] = useState(customer.lastName);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [address, setAddress] = useState(customer.address ?? "");
  const [city, setCity] = useState(customer.city ?? "");
  const [postalCode, setPostalCode] = useState(customer.postalCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName(customer.firstName);
    setLastName(customer.lastName);
    setPhone(customer.phone ?? "");
    setAddress(customer.address ?? "");
    setCity(customer.city ?? "");
    setPostalCode(customer.postalCode ?? "");
    setError(null);
  }, [open, customer]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/customers/${customer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone || undefined,
          address: address || undefined,
          city: city || undefined,
          postalCode: postalCode || undefined,
        }),
      });
      onClose();
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit customer" description={customer.email}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">First name</span>
            <input required autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Last name</span>
            <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">City</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Postal code</span>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClass} />
          </label>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
