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
import { StripePaymentPanel } from "@/components/StripePaymentPanel";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Spinner } from "@/components/Spinner";
import { CheckCircleIcon, CreditCardIcon } from "@/components/icons";

export default function MembershipPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [packages, setPackages] = useState<CreditPackage[] | null>(null);
  const [myMemberships, setMyMemberships] = useState<UserMembership[]>([]);
  const [myBalances, setMyBalances] = useState<CreditBalance[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payingMembershipId, setPayingMembershipId] = useState<string | null>(null);
  const [payingBalanceId, setPayingBalanceId] = useState<string | null>(null);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

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
    setSubscribingId(planId);
    try {
      const membership = await apiFetch<UserMembership>(`/membership-plans/${planId}/subscribe`, {
        method: "POST",
      });
      setNotice("Membership activated!");
      const plan = plans?.find((p) => p.id === planId);
      if (plan && Number(plan.price) > 0) {
        setPayingMembershipId(membership.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubscribingId(null);
    }
  }

  async function onPurchase(packageId: string) {
    setError(null);
    setNotice(null);
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setPurchasingId(packageId);
    try {
      const balance = await apiFetch<CreditBalance>(`/credit-packages/${packageId}/purchase`, {
        method: "POST",
      });
      setNotice("Package purchased — credits added to your account!");
      const pkg = packages?.find((p) => p.id === packageId);
      if (pkg && Number(pkg.price) > 0) {
        setPayingBalanceId(balance.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setPurchasingId(null);
    }
  }

  const activePlanIds = new Set(
    myMemberships.filter((m) => m.status === "ACTIVE").map((m) => m.planId),
  );
  const activeBalances = myBalances.filter((b) => b.creditsRemaining > 0);

  if (!plans || !packages) {
    return (
      <main className="flex flex-1 items-center justify-center bg-teal-50/40 text-teal-700">
        <Spinner className="h-6 w-6" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40">
      <section className="border-b border-teal-100 bg-gradient-to-br from-teal-900 to-teal-700 px-6 py-12 text-center">
        <h1 className="font-display animate-fade-in-up text-3xl font-semibold text-white">
          Memberships &amp; Packages
        </h1>
        <p className="animate-fade-in-up mt-2 text-teal-100">
          Save on every booking with a plan that suits you.
        </p>
      </section>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {error && (
          <p className="animate-fade-in mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}
        {notice && (
          <p className="animate-fade-in mb-4 flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircleIcon className="h-4 w-4 shrink-0" />
            {notice}
          </p>
        )}

        {payingMembershipId && (
          <div className="animate-fade-in-up mb-8 rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-teal-900">Complete payment</h2>
            <StripePaymentPanel
              intentPath={`/payments/memberships/${payingMembershipId}/intent`}
              amountLabel="membership"
              onSuccess={() => {
                setPayingMembershipId(null);
                setNotice("Payment successful — membership active!");
              }}
            />
          </div>
        )}

        {payingBalanceId && (
          <div className="animate-fade-in-up mb-8 rounded-xl border border-teal-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-teal-900">Complete payment</h2>
            <StripePaymentPanel
              intentPath={`/payments/credit-balances/${payingBalanceId}/intent`}
              amountLabel="package"
              onSuccess={() => {
                setPayingBalanceId(null);
                setNotice("Payment successful — credits added!");
              }}
            />
          </div>
        )}

        {isLoggedIn && (myMemberships.length > 0 || activeBalances.length > 0) && (
          <div className="animate-fade-in-up mb-10 rounded-xl border border-teal-100 bg-white p-6 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-teal-900">Your account</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {myMemberships
                .filter((m) => m.status === "ACTIVE")
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg bg-teal-50/60 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-teal-900">{m.plan.name}</p>
                      <p className="text-xs text-teal-700">
                        {m.plan.crossLocationAccess ? "All locations" : "Single location"}
                      </p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                ))}
              {activeBalances.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between rounded-lg bg-teal-50/60 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-teal-900">{b.package?.name ?? "Credits"}</p>
                    {b.expiresAt && (
                      <p className="text-xs text-teal-700">
                        Expires {new Date(b.expiresAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Badge variant="gold">{b.creditsRemaining} left</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <h2 className="font-display mb-3 text-lg font-semibold text-teal-900">Memberships</h2>
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          {plans.map((plan, i) => {
            const isActive = activePlanIds.has(plan.id);
            return (
              <div
                key={plan.id}
                style={{ animationDelay: `${i * 40}ms` }}
                className={`animate-fade-in-up flex flex-col justify-between rounded-xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  isActive ? "border-gold-500 ring-1 ring-gold-500/30" : "border-teal-100"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold text-teal-900">{plan.name}</h3>
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
                <Button
                  onClick={() => onSubscribe(plan.id)}
                  disabled={isActive || subscribingId === plan.id}
                  className="mt-4 flex items-center justify-center gap-2"
                >
                  {subscribingId === plan.id && <Spinner />}
                  {isActive ? "Active" : subscribingId === plan.id ? "Subscribing..." : "Subscribe"}
                </Button>
              </div>
            );
          })}
          {plans.length === 0 && (
            <p className="text-sm text-teal-700">No membership plans available yet.</p>
          )}
        </div>

        <h2 className="font-display mb-3 text-lg font-semibold text-teal-900">Credit packages</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg, i) => (
            <div
              key={pkg.id}
              style={{ animationDelay: `${i * 40}ms` }}
              className="animate-fade-in-up flex flex-col justify-between rounded-xl border border-teal-100 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div>
                <div className="flex items-center gap-2">
                  <CreditCardIcon className="h-4 w-4 text-teal-500" />
                  <h3 className="font-display font-semibold text-teal-900">{pkg.name}</h3>
                </div>
                <p className="mt-2 text-2xl font-semibold text-teal-900">${pkg.price}</p>
                <p className="mt-1 text-sm text-teal-700">
                  {pkg.creditsIncluded} credit{pkg.creditsIncluded === 1 ? "" : "s"}
                  {pkg.eligibleServiceType
                    ? ` · ${pkg.eligibleServiceType === "CLASS" ? "classes" : "appointments"} only`
                    : ""}
                  {pkg.expiryDays ? ` · expires in ${pkg.expiryDays} days` : ""}
                </p>
              </div>
              <Button
                onClick={() => onPurchase(pkg.id)}
                disabled={purchasingId === pkg.id}
                className="mt-4 flex items-center justify-center gap-2"
              >
                {purchasingId === pkg.id && <Spinner />}
                {purchasingId === pkg.id ? "Purchasing..." : "Purchase"}
              </Button>
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
