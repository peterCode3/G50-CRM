"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Location, StaffDirectoryEntry } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";

const inputClass =
  "rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

const ROLE_LABEL: Record<"LOCATION_ADMIN" | "COACH", string> = {
  LOCATION_ADMIN: "Location Admin",
  COACH: "Coach",
};

export default function StaffPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [staff, setStaff] = useState<StaffDirectoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const [search, setSearch] = useState("");
  const [locationId, setLocationId] = useState("");

  const isHqAdmin = user?.globalRole === "HQ_ADMIN";

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (isHqAdmin) {
        setLocations(await apiFetch<Location[]>("/locations/admin/all"));
      } else {
        const myLocationIds = user.locations
          .filter((l) => l.role === "LOCATION_ADMIN")
          .map((l) => l.locationId);
        setLocations(await Promise.all(myLocationIds.map((id) => apiFetch<Location>(`/locations/${id}`))));
      }
    })().catch(() => setError("Couldn't load your locations — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (locationId) params.set("locationId", locationId);
    return params.toString();
  }, [search, locationId]);

  async function loadStaff() {
    setLoadingStaff(true);
    try {
      setStaff(await apiFetch<StaffDirectoryEntry[]>(`/staff/admin/all?${queryString}`));
    } catch {
      setError("Couldn't load staff — please refresh.");
    } finally {
      setLoadingStaff(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, queryString]);

  async function onRemoveRole(entry: StaffDirectoryEntry, role: { locationId: string; locationName: string; role: "LOCATION_ADMIN" | "COACH" }) {
    if (!confirm(`Remove ${entry.firstName} ${entry.lastName} as ${ROLE_LABEL[role.role]} at ${role.locationName}?`)) return;
    setActionError(null);
    try {
      await apiFetch(`/staff/${entry.id}/locations/${role.locationId}/roles/${role.role}`, { method: "DELETE" });
      await loadStaff();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (error) {
    return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;
  }

  if (userLoading || locations === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Staff Members"
        description="Coaches and location admins across the network, and where they work."
        action={<Button onClick={() => setShowAdd(true)}>Add staff</Button>}
      />

      <div className="flex flex-col gap-6 p-8">
        <Card>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
              Search
              <input
                placeholder="Name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56 rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
              />
            </label>
            {locations.length > 1 && (
              <label className="flex flex-col gap-1 text-xs font-medium text-teal-700">
                Location
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="rounded-md border border-teal-200 px-3 py-1.5 text-sm text-teal-900"
                >
                  <option value="">{isHqAdmin ? "All locations" : "All my locations"}</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {loadingStaff && <Spinner />}
          </div>
        </Card>

        {actionError && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-600">{actionError}</p>}

        {staff === null ? (
          <p className="text-sm text-teal-700">Loading...</p>
        ) : staff.length === 0 ? (
          <Card>
            <p className="text-sm text-teal-700">No staff match these filters.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-700 text-lg font-semibold text-teal-900">
                    {s.firstName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/staff/${s.id}`} className="truncate font-medium text-teal-900 hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                    <p className="truncate text-xs text-teal-700">{s.email}</p>
                    {s.phone && <p className="truncate text-xs text-teal-700">{s.phone}</p>}
                  </div>
                  <Badge variant={s.isActive ? "success" : "danger"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                </div>

                <ul className="mt-4 flex flex-col gap-2 border-t border-teal-50 pt-3">
                  {s.roles.map((r) => (
                    <li key={`${r.locationId}-${r.role}`} className="flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <p className="truncate text-teal-900">{r.locationName}</p>
                        <Badge variant={r.role === "LOCATION_ADMIN" ? "gold" : "neutral"}>{ROLE_LABEL[r.role]}</Badge>
                      </div>
                      <button
                        onClick={() => onRemoveRole(s, r)}
                        className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddStaffModal open={showAdd} locations={locations} onClose={() => setShowAdd(false)} onSaved={loadStaff} />
    </>
  );
}

function AddStaffModal({
  open,
  locations,
  onClose,
  onSaved,
}: {
  open: boolean;
  locations: Location[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [locationId, setLocationId] = useState("");
  const [role, setRole] = useState<"COACH" | "LOCATION_ADMIN">("COACH");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setLocationId(locations[0]?.id ?? "");
    setRole("COACH");
    setError(null);
  }, [open, locations]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/staff", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone: phone || undefined,
          password: password || undefined,
          locationId,
          role,
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
    <Modal open={open} onClose={onClose} title="Add staff" description="Give someone a Coach or Location Admin role.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">First name</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Last name</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Temporary password</span>
          <input type="text" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          <span className="text-xs text-teal-700">Only needed if this email doesn't already have an account.</span>
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Location</span>
            <select required value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass}>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "COACH" | "LOCATION_ADMIN")} className={inputClass}>
              <option value="COACH">Coach</option>
              <option value="LOCATION_ADMIN">Location Admin</option>
            </select>
          </label>
        </div>
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add staff"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
