"use client";

import { useEffect, useState, type FormEvent } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { apiFetch, ApiError } from "@/lib/api";

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<Stripe | null> | null = null;
function getStripePromise(): Promise<Stripe | null> | null {
  if (!PUBLISHABLE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}

/**
 * Fetches a Stripe PaymentIntent client secret from `intentPath` and mounts
 * Stripe Elements to collect a real card payment. Used after a booking is
 * confirmed (Phase 4/5) or a membership/package is granted (Phase 5) — those
 * flows stay unchanged; this is an additional step layered on top for any
 * item with a price > 0 (Phase 6).
 */
export function StripePaymentPanel({
  intentPath,
  amountLabel,
  onSuccess,
}: {
  intentPath: string;
  amountLabel: string;
  onSuccess: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stripePromise = getStripePromise();

  useEffect(() => {
    if (!stripePromise) return;
    apiFetch<{ clientSecret: string }>(intentPath, { method: "POST" })
      .then((res) => setClientSecret(res.clientSecret))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't start payment"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentPath]);

  if (!stripePromise) {
    return (
      <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Card payments aren&apos;t configured in this environment yet — this booking is confirmed
        without an online charge for now.
      </p>
    );
  }

  if (error) {
    return <p className="mt-2 text-xs text-red-600">{error}</p>;
  }

  if (!clientSecret) {
    return <p className="mt-2 text-xs text-teal-700">Preparing payment...</p>;
  }

  return (
    <div className="mt-3 rounded-md border border-teal-100 bg-teal-50/40 p-3">
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <CheckoutForm amountLabel={amountLabel} onSuccess={onSuccess} />
      </Elements>
    </div>
  );
}

function CheckoutForm({ amountLabel, onSuccess }: { amountLabel: string; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed — please try again.");
      setSubmitting(false);
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <PaymentElement />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-teal-900 transition hover:bg-gold-700 disabled:opacity-50"
      >
        {submitting ? "Processing..." : `Pay ${amountLabel}`}
      </button>
    </form>
  );
}
