"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type {
  CreditPackage,
  MembershipPlan,
  UserMembership,
  CreditBalance,
} from "@/lib/types";

export default function MembershipPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [packages, setPackages] = useState<CreditPackage[] | null>(null);
  const [myMemberships, setMyMemberships] = useState<UserMembership[]>([]);
  const [myBalances, setMyBalances] = useState<CreditBalance[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    load().catch(() => setError("Couldn't load memberships & packages — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [plansRes, packagesRes] = await Promise.all([
      apiFetch<MembershipPlan[]>("/membership-plans"),
      apiFetch<CreditPackage[]>("/credit-packages"),
    ]);
    setPlans(plansRes);
    setPackages(packagesRes);

    try {
      const [memberships, balances] = await Promise.all([
        apiFetch<UserMembership[]>("/memberships/my"),
        apiFetch<CreditBalance[]>("/credit-balances/my"),
      ]);
      setMyMemberships(memberships);
      setMyBalances(balances);
      setIsLoggedIn(true);
    } catch {
      setIsLoggedIn(false);
    }
  }

  async function onSubscribe(planId: string) {
    setError(null);
    setNotice(null);
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    try {
      await apiFetch(`/membership-plans/${planId}/subscribe`, { method: "POST" });
      setNotice("Membership activated!");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onPurchase(packageId: string) {
    setError(null);
    setNotice(null);
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    try {
      await apiFetch(`/credit-packages/${packageId}/purchase`, { method: "POST" });
      setNotice("Package purchased — credits added to your account!");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  const activePlanIds = new Set(
    myMemberships.filter((m) => m.status === "ACTIVE").map((m) => m.planId),
  );

  if (!plans || !packages) {
    return (
      <main className="flex flex-1 items-center justify-center bg-teal-50/40 text-teal-700">
        Loading...
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40">
      <section className="border-b border-teal-100 bg-white px-6 py-10 text-center">
        <h1 className="text-2xl font-semibold text-teal-900">Memberships & Packages</h1>
        <p className="mt-1 text-teal-700">Save on every booking with a plan that suits you.</p>
      </section>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {error && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {notice && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{notice}</p>
        )}

        {myBalances.length > 0 && (
          <div className="mb-8 rounded-xl border border-teal-100 bg-white p-5">
            <h2 className="text-sm font-semibold text-teal-900">Your credit balances</h2>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-teal-700">
              {myBalances
                .filter((b) => b.creditsRemaining > 0)
                .map((b) => (
                  <li key={b.id}>
                    {b.creditsRemaining} credit{b.creditsRemaining === 1 ? "" : "s"}
                    {b.package ? ` — ${b.package.name}` : ""}
                    {b.expiresAt &&
                      ` (expires ${new Date(b.expiresAt).toLocaleDateString()})`}
                  </li>
                ))}
              {myBalances.every((b) => b.creditsRemaining === 0) && (
                <li className="text-teal-700/70">No credits remaining.</li>
              )}
            </ul>
          </div>
        )}

        <h2 className="mb-3 text-lg font-semibold text-teal-900">Memberships</h2>
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {plans.map((plan) => {
            const isActive = activePlanIds.has(plan.id);
            return (
              <div
                key={plan.id}
                className="flex flex-col justify-between rounded-xl border border-teal-100 bg-white p-6 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-teal-900">{plan.name}</h3>
                    <span className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-medium text-gold-900">
                      {plan.type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-teal-900">
                    ${plan.price}
                    <span className="text-sm font-normal text-teal-700">
                      {" "}
                      / {plan.billingPeriod === "NONE" ? "one-time" : plan.billingPeriod.toLowerCase()}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-teal-700">
                    {plan.crossLocationAccess
                      ? "Valid at every G50.Golf location"
                      : "Valid at this location"}
                    {plan.includedCredits ? ` · includes ${plan.includedCredits} credits` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onSubscribe(plan.id)}
                  disabled={isActive}
                  className="mt-4 rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-teal-900 transition hover:bg-gold-700 disabled:opacity-50"
                >
                  {isActive ? "Active" : "Subscribe"}
                </button>
              </div>
            );
          })}
          {plans.length === 0 && (
            <p className="text-sm text-teal-700">No membership plans available yet.</p>
          )}
        </div>

        <h2 className="mb-3 text-lg font-semibold text-teal-900">Credit packages</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="flex flex-col justify-between rounded-xl border border-teal-100 bg-white p-6 shadow-sm"
            >
              <div>
                <h3 className="font-semibold text-teal-900">{pkg.name}</h3>
                <p className="mt-2 text-2xl font-semibold text-teal-900">${pkg.price}</p>
                <p className="mt-1 text-sm text-teal-700">
                  {pkg.creditsIncluded} credit{pkg.creditsIncluded === 1 ? "" : "s"}
                  {pkg.eligibleServiceType
                    ? ` · ${pkg.eligibleServiceType === "CLASS" ? "classes" : "appointments"} only`
                    : ""}
                  {pkg.expiryDays ? ` · expires in ${pkg.expiryDays} days` : ""}
                </p>
              </div>
              <button
                onClick={() => onPurchase(pkg.id)}
                className="mt-4 rounded-md bg-gold-500 px-4 py-2 text-sm font-medium text-teal-900 transition hover:bg-gold-700"
              >
                Purchase
              </button>
            </div>
          ))}
          {packages.length === 0 && (
            <p className="text-sm text-teal-700">No credit packages available yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
