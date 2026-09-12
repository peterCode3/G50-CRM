"use client";

import { useMemo, useState } from "react";
import { apiFetch, ApiError, resolveImageUrl } from "@/lib/api";
import type { Service, SessionWithAvailability } from "@/lib/types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { StripePaymentPanel } from "./StripePaymentPanel";
import { CheckCircleIcon, ChevronDownIcon, ClockIcon, FlagIcon, UsersIcon } from "./icons";

type PaymentMethod = "FULL_PRICE" | "MEMBERSHIP" | "CREDIT";

interface BookingResult {
  id: string;
  status: string;
  priceCharged: string | null;
}

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
  onGate,
  onRefresh,
}: {
  service: Service;
  sessions: SessionWithAvailability[];
  hasEligibleMembership: boolean;
  hasEligibleCredit: boolean;
  defaultOpen?: boolean;
  /** Runs `action` immediately, or after login/profile-completion, whichever the golfer still needs. */
  onGate: (action: () => void) => void;
  /** Re-fetches this service's sessions (spot counts, etc.) after a booking/waitlist change. */
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [staffId, setStaffId] = useState("any");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("FULL_PRICE");
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [rowMessages, setRowMessages] = useState<Record<string, { text: string; isError: boolean }>>({});
  const [fullSessionIds, setFullSessionIds] = useState<Set<string>>(new Set());

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

  function resetCheckout() {
    setActiveSessionId(null);
    setPaymentMethod("FULL_PRICE");
    setSubmitting(false);
    setConfirmError(null);
    setResult(null);
  }

  function openCheckout(sessionId: string) {
    onGate(() => {
      resetCheckout();
      setActiveSessionId(sessionId);
    });
  }

  async function onConfirm(session: SessionWithAvailability) {
    setSubmitting(true);
    setConfirmError(null);
    try {
      const booked = await apiFetch<BookingResult>(`/sessions/${session.id}/bookings`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod }),
      });
      setResult(booked);
      onRefresh();
    } catch (err) {
      const isCapacityConflict =
        err instanceof ApiError && err.status === 409 && /full|filled up/i.test(err.message);
      if (isCapacityConflict) {
        setFullSessionIds((prev) => new Set(prev).add(session.id));
        setActiveSessionId(null);
        return;
      }
      setConfirmError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onJoinWaitlist(session: SessionWithAvailability) {
    onGate(async () => {
      try {
        await apiFetch(`/sessions/${session.id}/waitlist`, { method: "POST" });
        setRowMessages((prev) => ({
          ...prev,
          [session.id]: { text: "Added to the waitlist.", isError: false },
        }));
      } catch (err) {
        setRowMessages((prev) => ({
          ...prev,
          [session.id]: {
            text: err instanceof ApiError ? err.message : "Something went wrong",
            isError: true,
          },
        }));
      }
    });
  }

  const memberPrice = service.memberPrice;
  const options: { method: PaymentMethod; label: string; priceLabel: string }[] = [
    { method: "FULL_PRICE", label: "Pay full price", priceLabel: `$${service.price}` },
    ...(hasEligibleMembership
      ? [{ method: "MEMBERSHIP" as const, label: "Use membership", priceLabel: memberPrice ? `$${memberPrice}` : "Included" }]
      : []),
    ...(hasEligibleCredit ? [{ method: "CREDIT" as const, label: "Use 1 credit", priceLabel: "$0.00" }] : []),
  ];

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;
  const needsPayment =
    result && paymentMethod === "FULL_PRICE" && result.priceCharged && Number(result.priceCharged) > 0;

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
            <p className="pt-4 text-sm text-teal-700">{service.description}</p>
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
                  <div className="flex flex-col divide-y divide-teal-50 overflow-hidden rounded-lg border border-teal-100">
                    {daySessions.map((session) => {
                      const isFull =
                        fullSessionIds.has(session.id) ||
                        (session.spotsLeft != null && session.spotsLeft <= 0);
                      const message = rowMessages[session.id];
                      const isActive = activeSessionId === session.id;
                      const timeLabel = new Date(session.startTime).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      });

                      return (
                        <div key={session.id} className="bg-white">
                          <div className="flex items-center justify-between gap-3 p-3">
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 text-sm font-medium text-teal-900">
                                <ClockIcon className="h-3.5 w-3.5 shrink-0 text-teal-500" />
                                {timeLabel}
                              </p>
                              {session.coach && (
                                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-teal-700">
                                  <UsersIcon className="h-3 w-3 shrink-0" />
                                  {session.coach.firstName} {session.coach.lastName}
                                </p>
                              )}
                              {message && (
                                <p className={`mt-1 text-xs ${message.isError ? "text-red-600" : "text-green-700"}`}>
                                  {message.text}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {!isFull && session.spotsLeft != null && session.spotsLeft <= 2 && (
                                <Badge variant="warning">{session.spotsLeft} left</Badge>
                              )}
                              {isFull ? (
                                <Button
                                  variant="secondary"
                                  className="!px-3 !py-1.5 text-xs"
                                  onClick={() => onJoinWaitlist(session)}
                                >
                                  Join Waitlist
                                </Button>
                              ) : (
                                <Button
                                  variant={isActive ? "secondary" : "primary"}
                                  className="!px-3 !py-1.5 text-xs"
                                  onClick={() => (isActive ? resetCheckout() : openCheckout(session.id))}
                                >
                                  {isActive ? "Cancel" : "Book"}
                                </Button>
                              )}
                            </div>
                          </div>

                          {isActive && activeSession && (
                            <div className="animate-fade-in-up border-t border-teal-50 bg-teal-50/40 p-4">
                              {result ? (
                                <div className="flex flex-col gap-3">
                                  {result.status === "PENDING" ? (
                                    <p className="animate-fade-in flex items-start gap-2 rounded-md bg-gold-50 px-3 py-2.5 text-sm text-gold-900">
                                      <span>
                                        Request sent! The coach needs to confirm this appointment — you&apos;ll
                                        get an email once they respond.
                                      </span>
                                    </p>
                                  ) : (
                                    <p className="animate-fade-in flex items-center gap-2 rounded-md bg-green-50 px-3 py-2.5 text-sm text-green-700">
                                      <CheckCircleIcon className="h-4 w-4 shrink-0" />
                                      Booked! See it in My Bookings.
                                    </p>
                                  )}
                                  {needsPayment && (
                                    <StripePaymentPanel
                                      intentPath={`/payments/bookings/${result.id}/intent`}
                                      amountLabel={`$${result.priceCharged}`}
                                      onSuccess={resetCheckout}
                                    />
                                  )}
                                  <Button variant="secondary" className="!py-1.5 text-xs" onClick={resetCheckout}>
                                    {needsPayment ? "Pay later" : "Done"}
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-3">
                                  <p className="text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                                    Choose how to pay
                                  </p>
                                  <div className="flex flex-col gap-1.5">
                                    {options.map((o) => (
                                      <button
                                        key={o.method}
                                        type="button"
                                        onClick={() => setPaymentMethod(o.method)}
                                        className={`flex items-center justify-between rounded-md border-2 px-3 py-2 text-left text-sm transition ${
                                          paymentMethod === o.method
                                            ? "border-gold-500 bg-gold-50/60"
                                            : "border-teal-100 bg-white hover:border-teal-300"
                                        }`}
                                      >
                                        <span className="font-medium text-teal-900">{o.label}</span>
                                        <span className="text-teal-700">{o.priceLabel}</span>
                                      </button>
                                    ))}
                                  </div>
                                  {confirmError && (
                                    <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
                                      {confirmError}
                                    </p>
                                  )}
                                  <Button
                                    onClick={() => onConfirm(activeSession)}
                                    disabled={submitting}
                                    className="flex items-center justify-center gap-2 !py-2 text-sm"
                                  >
                                    {submitting && <Spinner />}
                                    {submitting ? "Booking..." : "Confirm booking"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
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
