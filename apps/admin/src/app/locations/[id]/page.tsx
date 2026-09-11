"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Location, Service, ServiceTemplate, StaffMember } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

const inputClass =
  "rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: userLoading } = useCurrentUser();

  const [location, setLocation] = useState<Location | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [templates, setTemplates] = useState<ServiceTemplate[] | null>(null);
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadAll().catch(() => setLoadError("Couldn't load this location — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  async function loadAll() {
    const [loc, svc] = await Promise.all([
      apiFetch<Location>(`/locations/${id}`),
      apiFetch<Service[]>(`/locations/${id}/services`),
    ]);
    setLocation(loc);
    setServices(svc);

    try {
      const [tpl, stf] = await Promise.all([
        apiFetch<ServiceTemplate[]>("/service-templates"),
        apiFetch<StaffMember[]>(`/locations/${id}/staff`),
      ]);
      setTemplates(tpl);
      setStaff(stf);
    } catch {
      setTemplates([]);
      setStaff([]);
    }
  }

  async function onActivateTemplate(templateId: string) {
    setError(null);
    try {
      await apiFetch(`/locations/${id}/services`, {
        method: "POST",
        body: JSON.stringify({ templateId }),
      });
      const svc = await apiFetch<Service[]>(`/locations/${id}/services`);
      setServices(svc);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (loadError) {
    return <div className="flex h-screen items-center justify-center text-red-600">{loadError}</div>;
  }

  if (userLoading || !location || !services) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">Loading...</div>
    );
  }

  const activeServiceTemplateIds = new Set(services.map((s) => s.templateId));

  return (
    <>
      <PageHeader
        title={location.name}
        description={location.address ?? location.slug}
        action={
          <div className="flex items-center gap-3">
            <Badge variant={location.isActive ? "success" : "danger"}>
              {location.isActive ? "Active" : "Inactive"}
            </Badge>
            <Link href="/locations">
              <Button variant="secondary" className="text-xs">
                ← All locations
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-8">
        {error && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        <Card title={`Activated services (${services.length})`}>
          {services.length === 0 ? (
            <p className="text-sm text-teal-700">No services activated yet — activate one below.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Duration</th>
                  <th className="py-2 pr-4">Capacity</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {services.map((svc) => (
                  <tr key={svc.id}>
                    <td className="py-2.5 pr-4 font-medium text-teal-900">{svc.name}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={svc.type === "CLASS" ? "neutral" : "gold"}>{svc.type}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-teal-700">{svc.durationMinutes} min</td>
                    <td className="py-2.5 pr-4 text-teal-700">{svc.capacity ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-teal-700">
                      ${svc.price}
                      {svc.memberPrice ? ` / $${svc.memberPrice} member` : ""}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Link href={`/locations/${id}/services/${svc.id}/schedule`}>
                        <Button variant="ghost" className="!px-2 !py-1 text-xs">
                          Schedule →
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="HQ Service Templates — activate at this location">
          {templates === null && <p className="text-sm text-teal-700">Loading templates...</p>}
          {templates?.length === 0 && (
            <p className="text-sm text-teal-700">
              No templates available (or you don&apos;t have access).
            </p>
          )}
          <ul className="flex flex-col divide-y divide-teal-50">
            {templates?.map((tpl) => {
              const alreadyActive = activeServiceTemplateIds.has(tpl.id);
              return (
                <li key={tpl.id} className="flex items-center justify-between py-3">
                  <div className="text-sm">
                    <span className="font-medium text-teal-900">{tpl.name}</span>
                    <span className="ml-2 text-teal-700">
                      {tpl.type} · {tpl.defaultDurationMinutes}min · ${tpl.defaultPrice}
                    </span>
                  </div>
                  <Button
                    variant={alreadyActive ? "secondary" : "primary"}
                    disabled={alreadyActive}
                    onClick={() => onActivateTemplate(tpl.id)}
                    className="text-xs"
                  >
                    {alreadyActive ? "Activated" : "Activate"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </Card>

        <StaffSection locationId={id} staff={staff} onChanged={loadAll} />
      </div>
    </>
  );
}

function StaffSection({
  locationId,
  staff,
  onChanged,
}: {
  locationId: string;
  staff: StaffMember[] | null;
  onChanged: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"LOCATION_ADMIN" | "COACH">("COACH");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/staff", {
        method: "POST",
        body: JSON.stringify({
          email,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          password: password || undefined,
          locationId,
          role,
        }),
      });
      setEmail("");
      setFirstName("");
      setLastName("");
      setPassword("");
      setShowForm(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card
        title={`Staff (${staff?.length ?? 0})`}
        action={
          <Button onClick={() => setShowForm(true)} className="!px-3 !py-1 text-xs">
            + Add staff
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {staff === null && <p className="text-sm text-teal-700">Loading staff...</p>}
          {staff && staff.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {staff.map((s) => (
                  <tr key={`${s.userId}-${s.role}`}>
                    <td className="py-2.5 pr-4 font-medium text-teal-900">
                      {s.firstName} {s.lastName}
                    </td>
                    <td className="py-2.5 pr-4 text-teal-700">{s.email}</td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={s.role === "LOCATION_ADMIN" ? "gold" : "neutral"}>{s.role}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {staff?.length === 0 && <p className="text-sm text-teal-700">No staff yet.</p>}
        </div>
      </Card>

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Add staff"
        description="Assign a coach or location admin to this location."
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <p className="rounded-md bg-teal-50/60 px-3 py-2 text-xs text-teal-700">
            If the email already belongs to an existing G50 account (e.g. a coach at another
            location), leave name/password blank — they&apos;ll just be added here with the same
            account.
          </p>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Email</span>
              <input
                required
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Role</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "LOCATION_ADMIN" | "COACH")}
                className={inputClass}
              >
                <option value="COACH">Coach</option>
                <option value="LOCATION_ADMIN">Location Admin</option>
              </select>
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">First name</span>
              <input
                placeholder="New accounts only"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Last name</span>
              <input
                placeholder="New accounts only"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Initial password</span>
            <input
              placeholder="New accounts only, min 8 chars"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding..." : "Add staff"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
