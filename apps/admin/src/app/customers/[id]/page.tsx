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

            <Card title="Credit balances">
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
                        <td className="py-2.5 pr-4 text-teal-700">
                          {b.priceCharged ? `$${b.priceCharged}` : "—"}
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
    </>
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
