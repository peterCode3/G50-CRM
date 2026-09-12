"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { PaymentReceipt } from "@/lib/types";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";

function itemLabel(receipt: PaymentReceipt): string {
  if (receipt.booking) return receipt.booking.session.service.name;
  if (receipt.userMembership) return `${receipt.userMembership.plan.name} membership`;
  if (receipt.creditBalance?.package) return receipt.creditBalance.package.name;
  return "G50.Golf purchase";
}

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PaymentReceipt>(`/payments/${id}`)
      .then(setReceipt)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setError(err instanceof ApiError ? err.message : "Couldn't load this receipt.");
        }
      });
  }, [id, router]);

  if (error) {
    return <main className="flex flex-1 items-center justify-center text-red-600">{error}</main>;
  }

  if (!receipt) {
    return (
      <main className="flex flex-1 items-center justify-center bg-teal-50/40 text-teal-700">
        <Spinner className="h-6 w-6" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center bg-teal-50/40 px-6 py-10 print:bg-white print:py-0">
      <div className="w-full max-w-lg rounded-xl border border-teal-100 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-center justify-between border-b border-teal-100 pb-6">
          <div>
            <p className="font-display text-xl font-semibold text-teal-900">G50.Golf</p>
            <p className="mt-0.5 text-xs text-teal-700">Payment receipt</p>
          </div>
          <div className="text-right text-xs text-teal-700">
            <p>Receipt #{receipt.id.slice(-8).toUpperCase()}</p>
            <p>
              {new Date(receipt.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1 text-sm">
          <p className="text-teal-700">Billed to</p>
          <p className="font-medium text-teal-900">
            {receipt.user.firstName} {receipt.user.lastName}
          </p>
          <p className="text-teal-700">{receipt.user.email}</p>
        </div>

        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-teal-100 text-xs font-semibold tracking-wide text-teal-700 uppercase">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-teal-50">
              <td className="py-3">
                <p className="text-teal-900">{itemLabel(receipt)}</p>
                {receipt.booking && (
                  <p className="mt-0.5 text-xs text-teal-700">
                    {receipt.booking.location.name} ·{" "}
                    {new Date(receipt.booking.session.startTime).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </td>
              <td className="py-3 text-right text-teal-900">
                ${receipt.amount} {receipt.currency}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 font-semibold text-teal-900">Total paid</td>
              <td className="pt-3 text-right font-semibold text-teal-900">
                ${receipt.amount} {receipt.currency}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-6 flex items-center justify-between rounded-md bg-teal-50/60 px-4 py-3 text-xs text-teal-700">
          <span>Payment method</span>
          <span className="font-medium text-teal-900">
            {receipt.provider === "stripe" ? "Card (Stripe)" : receipt.provider}
          </span>
        </div>
        {receipt.providerRef && (
          <p className="mt-2 text-center text-xs text-teal-700/60">Ref: {receipt.providerRef}</p>
        )}
      </div>

      <Button variant="secondary" className="mt-6 print:hidden" onClick={() => window.print()}>
        Print / Save as PDF
      </Button>
    </main>
  );
}
