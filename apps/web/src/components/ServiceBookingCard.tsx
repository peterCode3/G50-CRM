"use client";

import { useMemo, useState } from "react";
import { resolveImageUrl } from "@/lib/api";
import { groupByTimeOfDay } from "@/lib/calendar";
import type { Service, SessionWithAvailability } from "@/lib/types";
import { Badge } from "./Badge";
import { SessionBookingRow } from "./SessionBookingRow";
import { ChevronDownIcon, ClockIcon, FlagIcon, UsersIcon } from "./icons";

const DESCRIPTION_TRUNCATE_LENGTH = 160;

function formatDateHeading(date: Date): string {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function ServiceBookingCard({
  service,
  sessions,
  hasEligibleMembership,
  hasEligibleCredit,
  defaultOpen = false,
  locationName,
  locationAddress,
  onGate,
  onRefresh,
}: {
  service: Service;
  sessions: SessionWithAvailability[];
  hasEligibleMembership: boolean;
  hasEligibleCredit: boolean;
  defaultOpen?: boolean;
  locationName?: string;
  locationAddress?: string | null;
  /** Runs `action` immediately, or after login/profile-completion, whichever the golfer still needs. */
  onGate: (action: () => void) => void;
  /** Re-fetches this service's sessions (spot counts, etc.) after a booking/waitlist change. */
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [staffId, setStaffId] = useState("any");
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) if (s.coach) map.set(s.coach.id, `${s.coach.firstName} ${s.coach.lastName}`);
    return [...map.entries()];
  }, [sessions]);

  const filtered = staffId === "any" ? sessions : sessions.filter((s) => s.coachId === staffId);

  // `sessions` already arrives sorted ascending by start time from the API,
  // so grouping by insertion order keeps days in chronological order without
  // needing to re-sort the (non-chronologically-sortable-as-strings) group keys.
  const groups = useMemo(() => {
    const map = new Map<string, SessionWithAvailability[]>();
    for (const s of filtered) {
      const key = new Date(s.startTime).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm transition hover:shadow-md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-expanded={expanded}
      >
        <div
          className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${
            service.type === "CLASS" ? "from-teal-900 to-teal-700" : "from-gold-700 to-teal-900"
          }`}
        >
          {service.images.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveImageUrl(service.images[0])}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : service.type === "CLASS" ? (
            <FlagIcon className="h-5 w-5 text-white/80" />
          ) : (
            <ClockIcon className="h-5 w-5 text-white/80" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium text-teal-900">{service.name}</p>
            <Badge variant={service.type === "CLASS" ? "neutral" : "gold"}>
              {service.type === "CLASS" ? "Class" : "1:1 Appointment"}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-teal-700">
            ${service.price} · {service.durationMinutes} min
            {sessions.length > 0 && ` · ${sessions.length} upcoming`}
          </p>
          {staffOptions.length > 0 && (
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-teal-700/80">
              <UsersIcon className="h-3 w-3 shrink-0" />
              {staffOptions.length === 1
                ? staffOptions[0][1]
                : `${staffOptions.length} coaches: ${staffOptions.map(([, name]) => name).join(", ")}`}
            </p>
          )}
        </div>

        <ChevronDownIcon
          className={`h-5 w-5 shrink-0 text-teal-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="animate-fade-in-up border-t border-teal-50 px-4 pb-5">
          {service.description && (
            <div className="pt-4 text-sm text-teal-700">
              <p>
                {!descriptionExpanded && service.description.length > DESCRIPTION_TRUNCATE_LENGTH
                  ? `${service.description.slice(0, DESCRIPTION_TRUNCATE_LENGTH).trimEnd()}…`
                  : service.description}
              </p>
              {service.description.length > DESCRIPTION_TRUNCATE_LENGTH && (
                <button
                  type="button"
                  onClick={() => setDescriptionExpanded((v) => !v)}
                  className="mt-1 text-xs font-medium text-teal-900 hover:underline"
                >
                  {descriptionExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {staffOptions.length > 1 && (
            <label className="mt-4 flex items-center gap-2 text-sm">
              <UsersIcon className="h-4 w-4 shrink-0 text-teal-600" />
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="rounded-md border border-teal-300 px-2.5 py-1.5 text-sm text-teal-900"
              >
                <option value="any">Any coach</option>
                {staffOptions.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {groups.length === 0 ? (
            <p className="mt-4 rounded-md bg-teal-50/60 px-3 py-3 text-sm text-teal-700">
              No upcoming availability in the next 30 days.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {groups.map(([dayKey, daySessions]) => (
                <div key={dayKey}>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                    {formatDateHeading(new Date(dayKey))}
                  </p>
                  <div className="flex flex-col gap-3">
                    {groupByTimeOfDay(daySessions, (s) => new Date(s.startTime)).map(
                      ([period, periodSessions]) => (
                        <div key={period}>
                          <p className="mb-1 text-xs font-medium text-teal-700/60">{period}</p>
                          <div className="flex flex-col divide-y divide-teal-50 overflow-hidden rounded-lg border border-teal-100">
                            {periodSessions.map((session) => (
                              <SessionBookingRow
                                key={session.id}
                                session={session}
                                service={service}
                                hasEligibleMembership={hasEligibleMembership}
                                hasEligibleCredit={hasEligibleCredit}
                                locationName={locationName}
                                locationAddress={locationAddress}
                                onGate={onGate}
                                onRefresh={onRefresh}
                              />
                            ))}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
