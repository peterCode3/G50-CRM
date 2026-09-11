"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Location, Service, Session, StaffMember } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

const inputClass =
  "rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ServiceSchedulePage() {
  const { id: locationId, serviceId } = useParams<{ id: string; serviceId: string }>();
  const { user, loading: userLoading } = useCurrentUser();

  const [location, setLocation] = useState<Location | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOneOff, setShowOneOff] = useState(false);
  const [showRecurring, setShowRecurring] = useState(false);

  const coaches = staff.filter((s) => s.role === "COACH" || s.role === "LOCATION_ADMIN");

  useEffect(() => {
    if (!user) return;
    load().catch(() => setLoadError("Couldn't load this schedule — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    const [loc, svc, stf] = await Promise.all([
      apiFetch<Location>(`/locations/${locationId}`),
      apiFetch<Service>(`/services/${serviceId}`),
      apiFetch<StaffMember[]>(`/locations/${locationId}/staff`),
    ]);
    setLocation(loc);
    setService(svc);
    setStaff(stf);
    await loadSessions();
  }

  async function loadSessions() {
    const from = new Date().toISOString();
    setSessions(await apiFetch<Session[]>(`/services/${serviceId}/sessions?from=${from}`));
  }

  async function onCancelSession(sessionId: string) {
    await apiFetch(`/sessions/${sessionId}/cancel`, { method: "POST" });
    await loadSessions();
  }

  if (loadError) {
    return <div className="flex h-screen items-center justify-center text-red-600">{loadError}</div>;
  }

  if (userLoading || !location || !service || sessions === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">Loading...</div>
    );
  }

  return (
    <>
      <PageHeader
        title={`Schedule — ${service.name}`}
        description={`${location.name} · ${service.type === "CLASS" ? "Class" : "Appointment"} · ${service.durationMinutes} min`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowRecurring(true)} className="text-xs">
              + Recurring sessions
            </Button>
            <Button onClick={() => setShowOneOff(true)} className="text-xs">
              + One-off session
            </Button>
            <Link href={`/locations/${locationId}`}>
              <Button variant="ghost" className="text-xs">
                ← Back to location
              </Button>
            </Link>
          </div>
        }
      />

      <OneOffSessionModal
        open={showOneOff}
        onClose={() => setShowOneOff(false)}
        serviceId={serviceId}
        coaches={coaches}
        defaultCapacity={service.capacity}
        onCreated={loadSessions}
      />
      <RecurringSessionsModal
        open={showRecurring}
        onClose={() => setShowRecurring(false)}
        serviceId={serviceId}
        coaches={coaches}
        defaultCapacity={service.capacity}
        onCreated={loadSessions}
      />

      <div className="flex flex-col gap-6 p-8">
        <Card title={`Upcoming sessions (${sessions.length})`}>
          {sessions.length === 0 ? (
            <p className="text-sm text-teal-700">
              No upcoming sessions yet — create a one-off session or a recurring schedule above.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Coach</th>
                  <th className="py-2 pr-4">Capacity</th>
                  <th className="py-2 pr-4">Booked</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {sessions.map((s) => {
                  const coach = coaches.find((c) => c.userId === s.coachId);
                  return (
                    <tr key={s.id}>
                      <td className="py-2.5 pr-4 font-medium text-teal-900">
                        {formatDateTime(s.startTime)}
                      </td>
                      <td className="py-2.5 pr-4 text-teal-700">
                        {coach ? `${coach.firstName} ${coach.lastName}` : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-teal-700">{s.capacity ?? "—"}</td>
                      <td className="py-2.5 pr-4">
                        {s.capacity != null ? (
                          <Badge variant={s.spotsLeft === 0 ? "danger" : "success"}>
                            {s.bookedCount} / {s.capacity}
                          </Badge>
                        ) : (
                          <span className="text-teal-700">{s.bookedCount}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <Button
                          variant="danger"
                          className="!px-2 !py-1 text-xs"
                          onClick={() => onCancelSession(s.id)}
                        >
                          Cancel
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

function OneOffSessionModal({
  open,
  onClose,
  serviceId,
  coaches,
  defaultCapacity,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  coaches: StaffMember[];
  defaultCapacity: number | null;
  onCreated: () => Promise<void>;
}) {
  const [startTime, setStartTime] = useState("");
  const [coachId, setCoachId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/services/${serviceId}/sessions`, {
        method: "POST",
        body: JSON.stringify({
          startTime: new Date(startTime).toISOString(),
          coachId: coachId || undefined,
          capacity: capacity ? Number(capacity) : undefined,
        }),
      });
      setStartTime("");
      setCoachId("");
      setCapacity("");
      onClose();
      await onCreated();
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
      title="Create a one-off session"
      description="A single scheduled class or appointment slot."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Date & time</span>
          <input
            required
            autoFocus
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Coach</span>
            <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className={inputClass}>
              <option value="">No specific coach</option>
              {coaches.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Capacity</span>
            <input
              type="number"
              placeholder={defaultCapacity != null ? `Default: ${defaultCapacity}` : "Unlimited"}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create session"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RecurringSessionsModal({
  open,
  onClose,
  serviceId,
  coaches,
  defaultCapacity,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  coaches: StaffMember[];
  defaultCapacity: number | null;
  onCreated: () => Promise<void>;
}) {
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [time, setTime] = useState("16:00");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [coachId, setCoachId] = useState("");
  const [capacity, setCapacity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ createdCount: number; skipped: unknown[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ createdCount: number; skipped: unknown[] }>(
        `/services/${serviceId}/sessions/recurring`,
        {
          method: "POST",
          body: JSON.stringify({
            daysOfWeek,
            startTime: time,
            rangeStart,
            rangeEnd,
            coachId: coachId || undefined,
            capacity: capacity ? Number(capacity) : undefined,
          }),
        },
      );
      setResult(res);
      await onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function onCloseAndReset() {
    setDaysOfWeek([]);
    setRangeStart("");
    setRangeEnd("");
    setCoachId("");
    setCapacity("");
    setResult(null);
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onCloseAndReset}
      title="Create recurring sessions"
      description="Generates one session per matching day within the date range."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <span className="text-sm font-medium text-teal-900">Repeats on</span>
          <div className="mt-1.5 flex gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`h-9 w-11 rounded-md border text-xs font-medium transition ${
                  daysOfWeek.includes(d.value)
                    ? "border-gold-500 bg-gold-500 text-teal-900"
                    : "border-teal-300 text-teal-700 hover:bg-teal-50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Time</span>
            <input
              required
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Coach</span>
            <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className={inputClass}>
              <option value="">No specific coach</option>
              {coaches.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">From</span>
            <input
              required
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Until</span>
            <input
              required
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Capacity</span>
            <input
              type="number"
              placeholder={defaultCapacity != null ? `Default: ${defaultCapacity}` : "Unlimited"}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {result && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Created {result.createdCount} session{result.createdCount === 1 ? "" : "s"}.
            {result.skipped.length > 0
              ? ` ${result.skipped.length} skipped (coach conflict) — see list below.`
              : ""}
          </p>
        )}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCloseAndReset}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button type="submit" disabled={submitting || daysOfWeek.length === 0}>
              {submitting ? "Creating..." : "Create sessions"}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
