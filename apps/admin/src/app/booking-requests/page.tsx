"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { PendingBooking } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

export default function BookingRequestsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [requests, setRequests] = useState<PendingBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setRequests(await apiFetch<PendingBooking[]>("/bookings/pending"));
    } catch {
      setError("Couldn't load booking requests — please refresh.");
    }
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onAccept(booking: PendingBooking) {
    setActionError(null);
    setBusyId(booking.id);
    try {
      await apiFetch(`/bookings/${booking.id}/accept`, { method: "POST" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  async function onDecline(booking: PendingBooking) {
    if (!confirm(`Decline ${booking.user.firstName} ${booking.user.lastName}'s request for ${booking.session.service.name}?`)) {
      return;
    }
    setActionError(null);
    setBusyId(booking.id);
    try {
      await apiFetch(`/bookings/${booking.id}/decline`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;
  }

  if (userLoading || requests === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Booking Requests"
        description="Appointment requests awaiting your confirmation."
      />

      <div className="flex flex-col gap-6 p-8">
        {actionError && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{actionError}</p>}

        {requests.length === 0 ? (
          <Card>
            <p className="text-sm text-teal-700">No pending requests right now.</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {requests.map((r) => (
              <Card key={r.id}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-teal-900">
                        {r.user.firstName} {r.user.lastName}
                      </p>
                      <Badge variant="gold">{r.session.service.type}</Badge>
                    </div>
                    <p className="text-sm text-teal-700">{r.user.email}</p>
                    <p className="mt-1 text-sm text-teal-900">{r.session.service.name}</p>
                    <p className="mt-0.5 text-xs text-teal-700">
                      {new Date(r.session.startTime).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {r.location.name}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="!border-red-400 !bg-red-50 !text-red-700 hover:!bg-red-100"
                      disabled={busyId === r.id}
                      onClick={() => onDecline(r)}
                    >
                      Decline
                    </Button>
                    <Button disabled={busyId === r.id} onClick={() => onAccept(r)}>
                      {busyId === r.id ? "..." : "Accept"}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
