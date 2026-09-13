"use client";

import { useState } from "react";

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

/**
 * An inline month-grid date picker — not a modal, sits directly inside an
 * already-expanded service card. Days with at least one bookable session get
 * a dot marker and are clickable; everything else is disabled.
 */
export function MonthCalendar({
  availableDates,
  selectedDate,
  onSelectDate,
}: {
  /** Calendar days (local midnight) that have at least one upcoming session. */
  availableDates: Set<string>;
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

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
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded-md p-1.5 text-teal-600 transition hover:bg-teal-50"
          aria-label="Previous month"
        >
          ←
        </button>
        <span className="text-sm font-medium text-teal-900">{monthLabel}</span>
        <button
          type="button"
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
          const hasSessions = availableDates.has(date.toDateString());
          const isPast = date < startOfToday;
          const isSelected = selectedDate != null && isSameDay(date, selectedDate);
          return (
            <button
              key={i}
              type="button"
              disabled={isPast || !hasSessions}
              onClick={() => onSelectDate(date)}
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
    </div>
  );
}
