"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { AttendanceStatus, RosterEntry } from "@/lib/types";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string }[] = [
  { value: "ATTENDED", label: "Attended", activeClass: "bg-green-600 text-white border-green-600" },
  { value: "ABSENT", label: "Absent", activeClass: "bg-teal-700 text-white border-teal-700" },
  { value: "LATE_CANCEL", label: "Late cancel", activeClass: "bg-amber-500 text-white border-amber-500" },
  { value: "NO_SHOW", label: "No-show", activeClass: "bg-red-600 text-white border-red-600" },
];

export function AttendanceModal({
  sessionId,
  title,
  onClose,
}: {
  sessionId: string | null;
  title?: string;
  onClose: () => void;
}) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setRoster(null);
      return;
    }
    setError(null);
    apiFetch<RosterEntry[]>(`/sessions/${sessionId}/roster`)
      .then(setRoster)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load the roster."));
  }, [sessionId]);

  async function onMark(bookingId: string, status: AttendanceStatus) {
    setSavingId(bookingId);
    setError(null);
    try {
      await apiFetch(`/bookings/${bookingId}/attendance`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setRoster((prev) =>
        prev?.map((r) => (r.bookingId === bookingId ? { ...r, attendanceStatus: status } : r)) ?? null,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Modal
      open={!!sessionId}
      onClose={onClose}
      title="Attendance"
      description={title}
      wide
    >
      {error && (
        <p className="mb-4 animate-fade-in rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {roster === null ? (
        <div className="flex items-center justify-center py-10">
          <Spinner className="h-6 w-6 text-teal-500" />
        </div>
      ) : roster.length === 0 ? (
        <p className="py-6 text-center text-sm text-teal-700">No one is booked into this session.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-teal-50">
          {roster.map((entry, i) => (
            <li
              key={entry.bookingId}
              style={{ animationDelay: `${i * 40}ms` }}
              className="flex animate-fade-in-up flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-teal-900">
                  {entry.firstName} {entry.lastName}
                </p>
                <p className="truncate text-xs text-teal-700">{entry.email}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = entry.attendanceStatus === opt.value;
                  const isSaving = savingId === entry.bookingId;
                  return (
                    <button
                      key={opt.value}
                      disabled={isSaving}
                      onClick={() => onMark(entry.bookingId, opt.value)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                        isActive
                          ? opt.activeClass
                          : "border-teal-200 text-teal-700 hover:border-teal-400 hover:bg-teal-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
