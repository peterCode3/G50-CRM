"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { BookingPaymentMethod } from "@/lib/types";
import { StripePaymentPanel } from "./StripePaymentPanel";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { CalendarIcon, PinIcon } from "./icons";

interface PurchaseOption {
  method: BookingPaymentMethod;
  label: string;
  priceLabel: string;
}

export function CheckoutModal({
  serviceName,
  locationName,
  startTime,
  price,
  memberPrice,
  hasEligibleMembership,
  hasEligibleCredit,
  sessionId,
  onClose,
  onBooked,
  onCapacityConflict,
}: {
  serviceName: string;
  locationName: string;
  startTime: string;
  price: string;
  memberPrice: string | null;
  hasEligibleMembership: boolean;
  hasEligibleCredit: boolean;
  sessionId: string;
  onClose: () => void;
  onBooked: () => void;
  onCapacityConflict: () => void;
}) {
  const options: PurchaseOption[] = [
    { method: "FULL_PRICE", label: "Drop in", priceLabel: `$${price}` },
    ...(hasEligibleMembership
      ? [{ method: "MEMBERSHIP" as const, label: "Use membership", priceLabel: memberPrice ? `$${memberPrice}` : "Included" }]
      : []),
    ...(hasEligibleCredit ? [{ method: "CREDIT" as const, label: "Use 1 credit", priceLabel: "$0.00" }] : []),
  ];

  const [selected, setSelected] = useState<BookingPaymentMethod>(options[0].method);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ id: string; priceCharged: string | null } | null>(null);

  const subtotal = selected === "FULL_PRICE" ? price : selected === "MEMBERSHIP" ? memberPrice ?? price : "0.00";

  const start = new Date(startTime);
  const dateLabel = start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  async function onConfirm() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch<{ id: string; priceCharged: string | null }>(
        `/sessions/${sessionId}/bookings`,
        { method: "POST", body: JSON.stringify({ paymentMethod: selected }) },
      );
      setBooking(result);
      onBooked();
    } catch (err) {
      // A 409 covers two distinct cases from the API: "session is full" (offer
      // the waitlist) and "you already have a booking here" (a duplicate).
      // Only the former should send the golfer to the waitlist flow.
      const isCapacityConflict =
        err instanceof ApiError && err.status === 409 && /full|filled up/i.test(err.message);
      if (isCapacityConflict) {
        onCapacityConflict();
        return;
      }
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const needsPayment = booking && selected === "FULL_PRICE" && booking.priceCharged && Number(booking.priceCharged) > 0;

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-teal-950/50 px-4 py-10">
      <div className="animate-scale-in w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-teal-50 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-teal-900">Checkout</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-teal-400 transition hover:bg-teal-50 hover:text-teal-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="rounded-lg bg-teal-50/60 p-4">
            <p className="font-medium text-teal-900">{serviceName}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-teal-700">
              <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
              {dateLabel}, {timeLabel}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-teal-700">
              <PinIcon className="h-3.5 w-3.5 shrink-0" />
              {locationName}
            </p>
          </div>

          {booking ? (
            <div className="mt-6 flex flex-col gap-3">
              <p className="animate-fade-in rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
                Booking confirmed! See it in My Bookings.
              </p>
              {needsPayment && (
                <>
                  <StripePaymentPanel
                    intentPath={`/payments/bookings/${booking.id}/intent`}
                    amountLabel={`$${booking.priceCharged}`}
                    onSuccess={onClose}
                  />
                  <Button variant="secondary" onClick={onClose} className="mt-1">
                    Pay later
                  </Button>
                </>
              )}
              {!needsPayment && (
                <Button onClick={onClose} className="mt-1">
                  Done
                </Button>
              )}
            </div>
          ) : (
            <>
              <h3 className="mt-6 text-sm font-semibold text-teal-900">Review your purchase option</h3>
              <div className="mt-2 flex flex-col gap-2">
                {options.map((o) => (
                  <button
                    key={o.method}
                    type="button"
                    onClick={() => setSelected(o.method)}
                    className={`flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left text-sm transition ${
                      selected === o.method
                        ? "border-gold-500 bg-gold-50/60"
                        : "border-teal-100 hover:border-teal-300"
                    }`}
                  >
                    <span className="font-medium text-teal-900">{o.label}</span>
                    <span className="text-teal-700">{o.priceLabel}</span>
                  </button>
                ))}
              </div>

              <h3 className="mt-6 text-sm font-semibold text-teal-900">Summary</h3>
              <div className="mt-2 flex flex-col gap-1.5 rounded-lg border border-teal-100 px-4 py-3 text-sm">
                <div className="flex items-center justify-between text-teal-700">
                  <span>Subtotal</span>
                  <span>${subtotal}</span>
                </div>
                <div className="flex items-center justify-between border-t border-teal-50 pt-1.5 font-semibold text-teal-900">
                  <span>Total to pay</span>
                  <span>${subtotal}</span>
                </div>
              </div>

              {error && (
                <p className="animate-fade-in mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </p>
              )}

              <Button
                onClick={onConfirm}
                disabled={submitting}
                className="mt-6 flex w-full items-center justify-center gap-2 !py-2.5"
              >
                {submitting && <Spinner />}
                {submitting ? "Booking..." : "Complete booking"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
