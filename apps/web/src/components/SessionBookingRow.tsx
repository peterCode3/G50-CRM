"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Service, SessionWithAvailability } from "@/lib/types";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { StripePaymentPanel } from "./StripePaymentPanel";
import { CheckCircleIcon, ClockIcon, UsersIcon } from "./icons";

type PaymentMethod = "FULL_PRICE" | "MEMBERSHIP" | "CREDIT";

interface BookingResult {
  id: string;
  status: string;
  priceCharged: string | null;
}

/**
 * One bookable time slot — the row + inline (no-modal) payment/confirm step.
 * Self-contained so it can be reused both inside a per-service accordion
 * (ServiceBookingCard) and inside a combined, day-sorted "Full schedule"
 * list spanning every service on the location page.
 */
export function SessionBookingRow({
  session,
  service,
  hasEligibleMembership,
  hasEligibleCredit,
  showServiceName = false,
  onGate,
  onRefresh,
}: {
  session: SessionWithAvailability;
  service: Service;
  hasEligibleMembership: boolean;
  hasEligibleCredit: boolean;
  /** Shows the service name inline — used in the combined schedule view where rows mix services. */
  showServiceName?: boolean;
  onGate: (action: () => void) => void;
  onRefresh: () => void;
}) {
  const [isActive, setIsActive] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("FULL_PRICE");
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [isFull, setIsFull] = useState(session.spotsLeft != null && session.spotsLeft <= 0);
  const [waitlistMessage, setWaitlistMessage] = useState<{ text: string; isError: boolean } | null>(null);

  function resetCheckout() {
    setIsActive(false);
    setPaymentMethod("FULL_PRICE");
    setSubmitting(false);
    setConfirmError(null);
    setResult(null);
  }

  function openCheckout() {
    onGate(() => {
      resetCheckout();
      setIsActive(true);
    });
  }

  async function onConfirm() {
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
        setIsFull(true);
        setIsActive(false);
        return;
      }
      setConfirmError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onJoinWaitlist() {
    onGate(async () => {
      try {
        await apiFetch(`/sessions/${session.id}/waitlist`, { method: "POST" });
        setWaitlistMessage({ text: "Added to the waitlist.", isError: false });
      } catch (err) {
        setWaitlistMessage({
          text: err instanceof ApiError ? err.message : "Something went wrong",
          isError: true,
        });
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

  const needsPayment =
    result && paymentMethod === "FULL_PRICE" && result.priceCharged && Number(result.priceCharged) > 0;
  const timeLabel = new Date(session.startTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-teal-900">
            <ClockIcon className="h-3.5 w-3.5 shrink-0 text-teal-500" />
            {timeLabel}
            {showServiceName && <span className="font-normal text-teal-700">· {service.name}</span>}
          </p>
          {session.coach && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-teal-700">
              <UsersIcon className="h-3 w-3 shrink-0" />
              {session.coach.firstName} {session.coach.lastName}
            </p>
          )}
          {waitlistMessage && (
            <p className={`mt-1 text-xs ${waitlistMessage.isError ? "text-red-600" : "text-green-700"}`}>
              {waitlistMessage.text}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isFull && session.spotsLeft != null && session.spotsLeft <= 2 && (
            <Badge variant="warning">{session.spotsLeft} left</Badge>
          )}
          {isFull ? (
            <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={onJoinWaitlist}>
              Join Waitlist
            </Button>
          ) : (
            <Button
              variant={isActive ? "secondary" : "primary"}
              className="!px-3 !py-1.5 text-xs"
              onClick={() => (isActive ? resetCheckout() : openCheckout())}
            >
              {isActive ? "Cancel" : "Book"}
            </Button>
          )}
        </div>
      </div>

      {isActive && (
        <div className="animate-fade-in-up border-t border-teal-50 bg-teal-50/40 p-4">
          {result ? (
            <div className="flex flex-col gap-3">
              {result.status === "PENDING" ? (
                <p className="animate-fade-in flex items-start gap-2 rounded-md bg-gold-50 px-3 py-2.5 text-sm text-gold-900">
                  <span>
                    Request sent! The coach needs to confirm this appointment — you&apos;ll get an
                    email once they respond.
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
                <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{confirmError}</p>
              )}
              <Button
                onClick={onConfirm}
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
}
