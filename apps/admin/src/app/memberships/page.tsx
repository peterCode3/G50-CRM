"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { CreditPackage, MembershipPlan } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

const inputClass =
  "rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export default function MembershipsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null);
  const [packages, setPackages] = useState<CreditPackage[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    load().catch(() => setLoadError("Couldn't load memberships & packages — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    const [p, c] = await Promise.all([
      apiFetch<MembershipPlan[]>("/membership-plans/admin/all"),
      apiFetch<CreditPackage[]>("/credit-packages/admin/all"),
    ]);
    setPlans(p);
    setPackages(c);
  }

  if (loadError) {
    return <div className="flex h-screen items-center justify-center text-red-600">{loadError}</div>;
  }

  if (userLoading || plans === null || packages === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">Loading...</div>
    );
  }

  if (user?.globalRole !== "HQ_ADMIN") {
    return (
      <>
        <PageHeader title="Memberships & Packages" />
        <div className="p-8 text-sm text-teal-700">
          Membership plans and credit packages are managed by HQ Admin only.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Memberships & Packages"
        description="The membership and credit-package architecture golfers can subscribe to or purchase."
      />
      <div className="flex flex-col gap-6 p-8">
        <MembershipPlansSection plans={plans} onChanged={load} />
        <CreditPackagesSection packages={packages} onChanged={load} />
      </div>
    </>
  );
}

function MembershipPlansSection({
  plans,
  onChanged,
}: {
  plans: MembershipPlan[];
  onChanged: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<MembershipPlan["type"]>("LOCATION");
  const [price, setPrice] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<MembershipPlan["billingPeriod"]>("MONTHLY");
  const [crossLocationAccess, setCrossLocationAccess] = useState(false);
  const [includedCredits, setIncludedCredits] = useState("");

  function resetForm() {
    setName("");
    setPrice("");
    setIncludedCredits("");
    setCrossLocationAccess(false);
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/membership-plans", {
        method: "POST",
        body: JSON.stringify({
          name,
          type,
          price: Number(price),
          billingPeriod,
          crossLocationAccess,
          includedCredits: includedCredits ? Number(includedCredits) : undefined,
        }),
      });
      resetForm();
      setShowForm(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleActive(plan: MembershipPlan) {
    await apiFetch(`/membership-plans/${plan.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !plan.isActive }),
    });
    await onChanged();
  }

  return (
    <Card
      title={`Membership plans (${plans.length})`}
      action={<Button onClick={() => setShowForm(true)}>+ New Plan</Button>}
    >
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create a membership plan"
        description="Golfers can subscribe to this from the booking site."
      >
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Name</span>
            <input
              required
              autoFocus
              placeholder="e.g. G50 Global Membership"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MembershipPlan["type"])}
                className={inputClass}
              >
                <option value="FREE_PAYG">Free / PAYG</option>
                <option value="LOCATION">Location</option>
                <option value="GLOBAL">Global</option>
                <option value="JUNIOR">Junior / Performance</option>
                <option value="CORPORATE">Corporate</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Billing period</span>
              <select
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value as MembershipPlan["billingPeriod"])}
                className={inputClass}
              >
                <option value="NONE">One-time</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUAL">Annual</option>
              </select>
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Price</span>
              <input
                required
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Included credits</span>
              <input
                type="number"
                placeholder="Optional"
                value={includedCredits}
                onChange={(e) => setIncludedCredits(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-teal-900">
            <input
              type="checkbox"
              checked={crossLocationAccess}
              onChange={(e) => setCrossLocationAccess(e.target.checked)}
              className="h-4 w-4 rounded border-teal-300"
            />
            Valid at every G50.Golf location (not just one)
          </label>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create plan"}
            </Button>
          </div>
        </form>
      </Modal>

      {plans.length === 0 ? (
        <p className="text-sm text-teal-700">No membership plans yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Price</th>
              <th className="py-2 pr-4">Access</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-50">
            {plans.map((plan) => (
              <tr key={plan.id}>
                <td className="py-2.5 pr-4 font-medium text-teal-900">{plan.name}</td>
                <td className="py-2.5 pr-4">
                  <Badge variant="gold">{plan.type.replace("_", " ")}</Badge>
                </td>
                <td className="py-2.5 pr-4 text-teal-700">
                  ${plan.price}
                  {plan.billingPeriod !== "NONE" ? ` / ${plan.billingPeriod.toLowerCase()}` : ""}
                </td>
                <td className="py-2.5 pr-4 text-teal-700">
                  {plan.crossLocationAccess ? "All locations" : "This location only"}
                </td>
                <td className="py-2.5 pr-4">
                  <Badge variant={plan.isActive ? "success" : "danger"}>
                    {plan.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => onToggleActive(plan)}>
                    {plan.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function CreditPackagesSection({
  packages,
  onChanged,
}: {
  packages: CreditPackage[];
  onChanged: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [creditsIncluded, setCreditsIncluded] = useState("");
  const [price, setPrice] = useState("");
  const [eligibleServiceType, setEligibleServiceType] = useState<"" | "CLASS" | "APPOINTMENT">("");
  const [expiryDays, setExpiryDays] = useState("");

  function resetForm() {
    setName("");
    setCreditsIncluded("");
    setPrice("");
    setEligibleServiceType("");
    setExpiryDays("");
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/credit-packages", {
        method: "POST",
        body: JSON.stringify({
          name,
          creditsIncluded: Number(creditsIncluded),
          price: Number(price),
          eligibleServiceType: eligibleServiceType || undefined,
          expiryDays: expiryDays ? Number(expiryDays) : undefined,
        }),
      });
      resetForm();
      setShowForm(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function onToggleActive(pkg: CreditPackage) {
    await apiFetch(`/credit-packages/${pkg.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: !pkg.isActive }),
    });
    await onChanged();
  }

  return (
    <Card
      title={`Credit packages (${packages.length})`}
      action={<Button onClick={() => setShowForm(true)}>+ New Package</Button>}
    >
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create a credit package"
        description="A bundle of prepaid credits golfers can purchase and redeem on bookings."
      >
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Name</span>
            <input
              required
              autoFocus
              placeholder="e.g. 5-Pack Classes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Credits included</span>
              <input
                required
                type="number"
                value={creditsIncluded}
                onChange={(e) => setCreditsIncluded(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Price</span>
              <input
                required
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Eligible for</span>
              <select
                value={eligibleServiceType}
                onChange={(e) => setEligibleServiceType(e.target.value as "" | "CLASS" | "APPOINTMENT")}
                className={inputClass}
              >
                <option value="">Classes & appointments</option>
                <option value="CLASS">Classes only</option>
                <option value="APPOINTMENT">Appointments only</option>
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Expires after (days)</span>
              <input
                type="number"
                placeholder="Optional"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create package"}
            </Button>
          </div>
        </form>
      </Modal>

      {packages.length === 0 ? (
        <p className="text-sm text-teal-700">No credit packages yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Credits</th>
              <th className="py-2 pr-4">Price</th>
              <th className="py-2 pr-4">Eligible for</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-teal-50">
            {packages.map((pkg) => (
              <tr key={pkg.id}>
                <td className="py-2.5 pr-4 font-medium text-teal-900">{pkg.name}</td>
                <td className="py-2.5 pr-4 text-teal-700">{pkg.creditsIncluded}</td>
                <td className="py-2.5 pr-4 text-teal-700">${pkg.price}</td>
                <td className="py-2.5 pr-4">
                  <Badge variant={pkg.eligibleServiceType === "APPOINTMENT" ? "gold" : "neutral"}>
                    {pkg.eligibleServiceType === "CLASS"
                      ? "CLASSES"
                      : pkg.eligibleServiceType === "APPOINTMENT"
                        ? "APPOINTMENTS"
                        : "ANY"}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4">
                  <Badge variant={pkg.isActive ? "success" : "danger"}>
                    {pkg.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => onToggleActive(pkg)}>
                    {pkg.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
