"use client";

import { useEffect, useMemo, useState } from "react";
import { resolveImageUrl } from "@/lib/api";
import { groupByTimeOfDay } from "@/lib/calendar";
import type { Service, SessionWithAvailability } from "@/lib/types";
import { Badge } from "./Badge";
import { MonthCalendar } from "./MonthCalendar";
import { SessionBookingRow } from "./SessionBookingRow";
import { ChevronDownIcon, ClockIcon, FlagIcon, PinIcon, UsersIcon } from "./icons";

const DESCRIPTION_TRUNCATE_LENGTH = 160;

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const staffOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) if (s.coach) map.set(s.coach.id, `${s.coach.firstName} ${s.coach.lastName}`);
    return [...map.entries()];
  }, [sessions]);

  const filtered = staffId === "any" ? sessions : sessions.filter((s) => s.coachId === staffId);

  const availableDates = useMemo(() => {
    const set = new Set<string>();
    for (const s of filtered) set.add(new Date(s.startTime).toDateString());
    return set;
  }, [filtered]);

  // Default (and re-pick, if the staff filter changes) to the soonest day
  // that actually has something bookable — mirrors the reference calendar
  // opening on the nearest available date rather than an empty "today".
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedDate(null);
      return;
    }
    const soonest = new Date(filtered[0].startTime);
    setSelectedDate((prev) => {
      if (prev && availableDates.has(prev.toDateString())) return prev;
      return soonest;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, availableDates]);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDate) return [];
    return filtered.filter((s) => new Date(s.startTime).toDateString() === selectedDate.toDateString());
  }, [filtered, selectedDate]);

  const gallery = service.images;

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
          {gallery.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveImageUrl(gallery[0])}
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
        <div className="animate-fade-in-up border-t border-teal-50">
          {/* Cover banner — the reference's big service image, not just the small header icon */}
          <div
            className={`relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br ${
              service.type === "CLASS" ? "from-teal-900 to-teal-700" : "from-gold-700 to-teal-900"
            }`}
          >
            {gallery.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(gallery[0])} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : service.type === "CLASS" ? (
              <FlagIcon className="h-12 w-12 text-white/70" />
            ) : (
              <ClockIcon className="h-12 w-12 text-white/70" />
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pt-3">
              {gallery.slice(1).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={img}
                  src={resolveImageUrl(img)}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md border border-teal-100 object-cover"
                />
              ))}
            </div>
          )}

          <div className="px-4 pb-5">
            {(locationName || locationAddress) && (
              <p className="flex items-center gap-1.5 pt-4 text-sm text-teal-700">
                <PinIcon className="h-3.5 w-3.5 shrink-0" />
                {locationName}
                {locationAddress ? ` — ${locationAddress}` : ""}
              </p>
            )}

            {service.description && (
              <div className="mt-3 text-sm text-teal-700">
                <p className="font-medium text-teal-900">Description</p>
                <p className="mt-0.5">
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

            {staffOptions.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 text-sm text-teal-700">
                <UsersIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium text-teal-900">Staff:</span>
                {staffOptions.length === 1 ? (
                  <span>{staffOptions[0][1]}</span>
                ) : (
                  <select
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="rounded-md border border-teal-300 px-2 py-1 text-sm text-teal-900"
                  >
                    <option value="any">Any coach</option>
                    {staffOptions.map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {sessions.length === 0 ? (
              <p className="mt-4 rounded-md bg-teal-50/60 px-3 py-3 text-sm text-teal-700">
                No upcoming availability in the next 30 days.
              </p>
            ) : (
              <>
                <p className="mt-4 mb-1.5 text-sm font-medium text-teal-900">Select date &amp; time</p>
                <MonthCalendar
                  availableDates={availableDates}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />

                {selectedDate && (
                  <div className="mt-4">
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                      {selectedDate.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {selectedDaySessions.length === 0 ? (
                      <p className="rounded-md bg-teal-50/60 px-3 py-2 text-sm text-teal-700">
                        No availability on this date.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {groupByTimeOfDay(selectedDaySessions, (s) => new Date(s.startTime)).map(
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
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
