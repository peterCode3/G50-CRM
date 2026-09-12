"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type {
  DayHours,
  Location,
  OpeningHours,
  Service,
  ServiceTemplate,
  StaffMember,
} from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { ImageGalleryUploader } from "@/components/ImageGalleryUploader";
import { resolveImageUrl } from "@/lib/upload";

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
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

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

  async function reloadLocation() {
    setLocation(await apiFetch<Location>(`/locations/${id}`));
  }

  async function reloadServices() {
    setServices(await apiFetch<Service[]>(`/locations/${id}/services`));
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
            <Button variant="secondary" className="text-xs" onClick={() => setShowEditLocation(true)}>
              Edit
            </Button>
            <Link href="/locations">
              <Button variant="secondary" className="text-xs">
                ← All locations
              </Button>
            </Link>
          </div>
        }
      />

      <EditLocationModal
        open={showEditLocation}
        onClose={() => setShowEditLocation(false)}
        location={location}
        onSaved={reloadLocation}
      />
      <EditServiceModal
        service={editingService}
        onClose={() => setEditingService(null)}
        onSaved={reloadServices}
      />

      <div className="flex flex-col gap-6 p-8">
        {error && (
          <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
        )}

        <Card title="Contact & hours">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-teal-700">Phone</dt>
              <dd className="text-teal-900">{location.phone ?? "—"}</dd>
              <dt className="text-teal-700">Email</dt>
              <dd className="text-teal-900">{location.email ?? "—"}</dd>
              <dt className="text-teal-700">Description</dt>
              <dd className="text-teal-900">{location.description ?? "—"}</dd>
            </dl>
            <div className="text-sm">
              {location.openingHours ? (
                <ul className="flex flex-col divide-y divide-teal-50">
                  {DAYS_OF_WEEK.map(({ key, label }) => {
                    const day = location.openingHours![key];
                    return (
                      <li key={key} className="flex justify-between py-1">
                        <span className="text-teal-700">{label}</span>
                        <span className="text-teal-900">
                          {day.closed ? "Closed" : `${day.open} – ${day.close}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-teal-700">No business hours set yet — click Edit above.</p>
              )}
            </div>
          </div>
        </Card>

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
                    <td className="py-2.5 pr-4 font-medium text-teal-900">
                      <div className="flex items-center gap-2.5">
                        {svc.images.length > 0 ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveImageUrl(svc.images[0])}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 shrink-0 rounded bg-teal-100" />
                        )}
                        {svc.name}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={svc.type === "CLASS" ? "neutral" : "gold"}>{svc.type}</Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-teal-700">{svc.durationMinutes} min</td>
                    <td className="py-2.5 pr-4 text-teal-700">{svc.capacity ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-teal-700">
                      ${svc.price}
                      {svc.memberPrice ? ` / $${svc.memberPrice} member` : ""}
                    </td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs"
                        onClick={() => setEditingService(svc)}
                      >
                        Edit
                      </Button>
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

        {templates === null && (
          <Card title="HQ Service Templates">
            <p className="text-sm text-teal-700">Loading templates...</p>
          </Card>
        )}
        {templates?.length === 0 && (
          <Card title="HQ Service Templates">
            <p className="text-sm text-teal-700">
              No templates available (or you don&apos;t have access).
            </p>
          </Card>
        )}
        {templates && templates.length > 0 && (
          <>
            <TemplateActivationCard
              title="Classes — activate at this location"
              templates={templates.filter((t) => t.type === "CLASS")}
              activeIds={activeServiceTemplateIds}
              onActivate={onActivateTemplate}
            />
            <TemplateActivationCard
              title="Appointments — activate at this location"
              templates={templates.filter((t) => t.type === "APPOINTMENT")}
              activeIds={activeServiceTemplateIds}
              onActivate={onActivateTemplate}
            />
          </>
        )}

        <StaffSection locationId={id} staff={staff} onChanged={loadAll} />
      </div>
    </>
  );
}

function TemplateActivationCard({
  title,
  templates,
  activeIds,
  onActivate,
}: {
  title: string;
  templates: ServiceTemplate[];
  activeIds: Set<string | null>;
  onActivate: (templateId: string) => void;
}) {
  if (templates.length === 0) return null;

  return (
    <Card title={title}>
      <ul className="flex flex-col divide-y divide-teal-50">
        {templates.map((tpl) => {
          const alreadyActive = activeIds.has(tpl.id);
          return (
            <li key={tpl.id} className="flex items-center justify-between py-3">
              <div className="text-sm">
                <span className="font-medium text-teal-900">{tpl.name}</span>
                <span className="ml-2 text-teal-700">
                  {tpl.defaultDurationMinutes}min · ${tpl.defaultPrice}
                </span>
              </div>
              <Button
                variant={alreadyActive ? "secondary" : "primary"}
                disabled={alreadyActive}
                onClick={() => onActivate(tpl.id)}
                className="text-xs"
              >
                {alreadyActive ? "Activated" : "Activate"}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((s) => (
                <div
                  key={`${s.userId}-${s.role}`}
                  className="flex items-center gap-3 rounded-lg border border-teal-50 p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-sm font-semibold text-teal-900">
                    {s.firstName[0]}
                    {s.lastName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-teal-900">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="truncate text-xs text-teal-700">{s.email}</p>
                  </div>
                  <div className="ml-auto shrink-0">
                    <Badge variant={s.role === "LOCATION_ADMIN" ? "gold" : "neutral"}>
                      <span className="whitespace-nowrap">{s.role.replace("_", " ")}</span>
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
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

const DAYS_OF_WEEK: { key: keyof OpeningHours; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

function defaultOpeningHours(): OpeningHours {
  const weekday: DayHours = { closed: false, open: "09:00", close: "17:00" };
  const weekend: DayHours = { closed: true, open: "09:00", close: "17:00" };
  return {
    monday: weekday,
    tuesday: weekday,
    wednesday: weekday,
    thursday: weekday,
    friday: weekday,
    saturday: weekend,
    sunday: weekend,
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-teal-700 uppercase">{children}</h3>
  );
}

function EditLocationModal({
  open,
  onClose,
  location,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  location: Location;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address ?? "");
  const [phone, setPhone] = useState(location.phone ?? "");
  const [email, setEmail] = useState(location.email ?? "");
  const [description, setDescription] = useState(location.description ?? "");
  const [logoUrl, setLogoUrl] = useState(location.logoUrl ?? "");
  const [images, setImages] = useState<string[]>(location.images ?? []);
  const [hours, setHours] = useState<OpeningHours>(location.openingHours ?? defaultOpeningHours());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Re-sync form fields whenever a different (or refreshed) location is opened.
  useEffect(() => {
    if (!open) return;
    setName(location.name);
    setAddress(location.address ?? "");
    setPhone(location.phone ?? "");
    setEmail(location.email ?? "");
    setDescription(location.description ?? "");
    setLogoUrl(location.logoUrl ?? "");
    setImages(location.images ?? []);
    setHours(location.openingHours ?? defaultOpeningHours());
    setError(null);
  }, [open, location]);

  function updateDay(day: keyof OpeningHours, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/locations/${location.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          address: address || undefined,
          phone: phone || undefined,
          email: email || undefined,
          description: description || undefined,
          logoUrl: logoUrl || undefined,
          images,
          openingHours: hours,
        }),
      });
      onClose();
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit location" description={`/${location.slug}`} wide>
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <SectionLabel>General details</SectionLabel>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Name</span>
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Address</span>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-1 flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Logo URL</span>
            <input
              placeholder="https://..."
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className={inputClass}
            />
            <span className="text-xs text-teal-700/70">
              Optional — a hosted URL for a small brand mark, separate from the photo gallery below.
            </span>
          </label>
          <ImageGalleryUploader images={images} onChange={setImages} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Description</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 border-t border-teal-50 pt-5">
          <SectionLabel>Business hours</SectionLabel>
          <div className="flex flex-col divide-y divide-teal-50">
            {DAYS_OF_WEEK.map(({ key, label }) => {
              const day = hours[key];
              return (
                <div key={key} className="flex items-center gap-3 py-2">
                  <label className="flex w-32 shrink-0 items-center gap-2 text-sm text-teal-900">
                    <input
                      type="checkbox"
                      checked={!day.closed}
                      onChange={(e) => updateDay(key, { closed: !e.target.checked })}
                      className="h-4 w-4 rounded border-teal-300"
                    />
                    {label}
                  </label>
                  {day.closed ? (
                    <span className="text-sm text-teal-700/60">Closed all day</span>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="time"
                        value={day.open}
                        onChange={(e) => updateDay(key, { open: e.target.value })}
                        className={`${inputClass} !py-1`}
                      />
                      <span className="text-teal-700/60">to</span>
                      <input
                        type="time"
                        value={day.close}
                        onChange={(e) => updateDay(key, { close: e.target.value })}
                        className={`${inputClass} !py-1`}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-teal-50 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditServiceModal({
  service,
  onClose,
  onSaved,
}: {
  service: Service | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [memberPrice, setMemberPrice] = useState("");
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState("0");
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState("0");
  const [bookingIntervalMinutes, setBookingIntervalMinutes] = useState("");
  const [minNoticeHours, setMinNoticeHours] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!service) return;
    setName(service.name);
    setDurationMinutes(String(service.durationMinutes));
    setCapacity(service.capacity != null ? String(service.capacity) : "");
    setPrice(service.price);
    setMemberPrice(service.memberPrice ?? "");
    setBufferBeforeMinutes(String(service.bufferBeforeMinutes ?? 0));
    setBufferAfterMinutes(String(service.bufferAfterMinutes ?? 0));
    setBookingIntervalMinutes(service.bookingIntervalMinutes != null ? String(service.bookingIntervalMinutes) : "");
    setMinNoticeHours(service.minNoticeHours != null ? String(service.minNoticeHours) : "");
    setImages(service.images ?? []);
    setError(null);
  }, [service]);

  if (!service) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!service) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(`/services/${service.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          durationMinutes: Number(durationMinutes),
          capacity: capacity ? Number(capacity) : undefined,
          price: Number(price),
          memberPrice: memberPrice ? Number(memberPrice) : undefined,
          bufferBeforeMinutes: Number(bufferBeforeMinutes || 0),
          bufferAfterMinutes: Number(bufferAfterMinutes || 0),
          bookingIntervalMinutes: bookingIntervalMinutes ? Number(bookingIntervalMinutes) : null,
          minNoticeHours: minNoticeHours ? Number(minNoticeHours) : null,
          images,
        }),
      });
      onClose();
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={!!service}
      onClose={onClose}
      title="Edit service"
      description={`${service.type === "CLASS" ? "Class" : "Appointment"} at this location`}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Name</span>
          <input
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Duration (min)</span>
            <input
              required
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Capacity</span>
            <input
              type="number"
              placeholder="Unlimited"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className={inputClass}
            />
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
            <span className="font-medium text-teal-900">Member price</span>
            <input
              type="number"
              placeholder="Optional"
              value={memberPrice}
              onChange={(e) => setMemberPrice(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Buffer before (min)</span>
            <input
              type="number"
              min={0}
              value={bufferBeforeMinutes}
              onChange={(e) => setBufferBeforeMinutes(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Buffer after (min)</span>
            <input
              type="number"
              min={0}
              value={bufferAfterMinutes}
              onChange={(e) => setBufferAfterMinutes(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Booking interval (min)</span>
            <input
              type="number"
              min={1}
              placeholder="Any time"
              value={bookingIntervalMinutes}
              onChange={(e) => setBookingIntervalMinutes(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Min. booking notice (hrs)</span>
            <input
              type="number"
              min={0}
              placeholder="None"
              value={minNoticeHours}
              onChange={(e) => setMinNoticeHours(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <ImageGalleryUploader images={images} onChange={setImages} />
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
