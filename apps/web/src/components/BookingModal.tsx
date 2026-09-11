"use client";

import { useMemo, useState } from "react";
import type { Service, SessionWithAvailability } from "@/lib/types";
import { ClockIcon, FlagIcon, PinIcon, UsersIcon } from "./icons";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

export function BookingModal({
  service,
  sessions,
  locationName,
  locationAddress,
  onClose,
  onSelectSession,
}: {
  service: Service;
  sessions: SessionWithAvailability[];
  locationName: string;
  locationAddress: string | null;
  onClose: () => void;
  onSelectSession: (session: SessionWithAvailability) => void;
}) {
  const today = new Date();
  const bookable = useMemo(
    () => sessions.filter((s) => s.spotsLeft == null || s.spotsLeft > 0),
    [sessions],
  );

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of bookable) {
      if (s.coach) map.set(s.coach.id, `${s.coach.firstName} ${s.coach.lastName}`);
    }
    return [...map.entries()];
  }, [bookable]);

  const [staffId, setStaffId] = useState<string>("any");
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const filtered = staffId === "any" ? bookable : bookable.filter((s) => s.coachId === staffId);

  const sessionsByDateKey = useMemo(() => {
    const map = new Map<string, SessionWithAvailability[]>();
    for (const s of filtered) {
      const key = new Date(s.startTime).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [filtered]);

  const grid = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
    if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDate(null);
  }

  const selectedDaySessions = selectedDate
    ? (sessionsByDateKey.get(selectedDate.toDateString()) ?? [])
    : [];

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-teal-950/50 px-4 py-10">
      <div className="animate-scale-in w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-teal-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-teal-900">
            Book {service.type === "CLASS" ? "a class" : "an appointment"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-teal-400 transition hover:bg-teal-50 hover:text-teal-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          <div
            className={`flex h-28 items-center justify-center bg-gradient-to-br ${
              service.type === "CLASS" ? "from-teal-900 to-teal-700" : "from-gold-700 to-teal-900"
            }`}
          >
            {service.type === "CLASS" ? (
              <FlagIcon className="h-10 w-10 text-white/70" />
            ) : (
              <ClockIcon className="h-10 w-10 text-white/70" />
            )}
          </div>

          <div className="px-6 py-5">
            <h3 className="text-lg font-semibold text-teal-900">{service.name}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-teal-700">
              <span className="rounded-full bg-teal-50 px-2.5 py-1 font-medium">${service.price}</span>
              <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1">
                <ClockIcon className="h-3 w-3" />
                {service.durationMinutes} min
              </span>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-teal-700">
              <PinIcon className="h-3.5 w-3.5 shrink-0" />
              {locationName}
              {locationAddress ? ` — ${locationAddress}` : ""}
            </p>
            {service.description && (
              <p className="mt-2 text-sm text-teal-700">{service.description}</p>
            )}

            <hr className="my-4 border-teal-50" />
            <h4 className="text-sm font-semibold text-teal-900">Select date & time</h4>

            {staffOptions.length > 0 && (
              <label className="mt-3 flex flex-col gap-1.5 text-sm">
                <span className="flex items-center gap-1.5 font-medium text-teal-900">
                  <UsersIcon className="h-3.5 w-3.5" />
                  Staff member
                </span>
                <select
                  value={staffId}
                  onChange={(e) => {
                    setStaffId(e.target.value);
                    setSelectedDate(null);
                  }}
                  className="rounded-md border border-teal-300 px-3 py-2 text-sm text-teal-900"
                >
                  <option value="any">Any staff member</option>
                  {staffOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => changeMonth(-1)}
                className="rounded-md p-1.5 text-teal-600 transition hover:bg-teal-50"
                aria-label="Previous month"
              >
                ←
              </button>
              <span className="text-sm font-medium text-teal-900">{monthLabel}</span>
              <button
                onClick={() => changeMonth(1)}
                className="rounded-md p-1.5 text-teal-600 transition hover:bg-teal-50"
                aria-label="Next month"
              >
                →
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="py-1 font-medium text-teal-700/60">
                  {d}
                </div>
              ))}
              {grid.map((date, i) => {
                if (!date) return <div key={i} />;
                const hasSessions = sessionsByDateKey.has(date.toDateString());
                const isPast = date < startOfToday;
                const isSelected = selectedDate != null && isSameDay(date, selectedDate);
                return (
                  <button
                    key={i}
                    disabled={isPast || !hasSessions}
                    onClick={() => setSelectedDate(date)}
                    className={`relative rounded-md py-1.5 transition ${
                      isSelected
                        ? "bg-gold-500 font-semibold text-teal-900"
                        : hasSessions && !isPast
                          ? "text-teal-900 hover:bg-teal-50"
                          : "text-teal-300"
                    }`}
                  >
                    {date.getDate()}
                    {hasSessions && !isPast && !isSelected && (
                      <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gold-500" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                  {selectedDate.toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                {selectedDaySessions.length === 0 ? (
                  <p className="rounded-md bg-teal-50/60 px-3 py-2 text-sm text-teal-700">
                    No slots available on this date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {selectedDaySessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => onSelectSession(s)}
                        className="rounded-md border-2 border-teal-200 px-2 py-2 text-xs font-medium text-teal-800 transition hover:border-gold-500 hover:bg-gold-50"
                      >
                        {new Date(s.startTime).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {bookable.length === 0 && (
              <p className="mt-4 rounded-md bg-teal-50/60 px-3 py-2 text-sm text-teal-700">
                No upcoming availability in the next 30 days.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
