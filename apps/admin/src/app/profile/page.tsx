"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";
import type { Location } from "@/lib/types";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Spinner } from "@/components/Spinner";

const ROLE_LABEL: Record<string, string> = {
  HQ_ADMIN: "HQ Admin",
  LOCATION_ADMIN: "Location Admin",
  COACH: "Coach",
  CUSTOMER: "Customer",
};

/** Cursor-driven 3D tilt — the profile hero's "something animated" flourish. */
function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  function onMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 14;
    const rotateX = (0.5 - py) * 14;
    setStyle({
      transform: `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02,1.02,1.02)`,
      "--sheen-x": `${px * 100}%`,
      "--sheen-y": `${py * 100}%`,
    } as React.CSSProperties);
  }

  function onMouseLeave() {
    setStyle({ transform: "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)" });
  }

  return { ref, style, onMouseMove, onMouseLeave };
}

export default function ProfilePage() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const tilt = useTilt<HTMLDivElement>();

  useEffect(() => {
    Promise.all([apiFetch<AuthenticatedUser>("/auth/me"), apiFetch<Location[]>("/locations")])
      .then(([me, locs]) => {
        setUser(me);
        setLocations(locs);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Couldn't load your profile."))
      .finally(() => setLoading(false));
  }, []);

  if (loadError) {
    return <div className="flex h-screen items-center justify-center text-red-600">{loadError}</div>;
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">
        <Spinner />
      </div>
    );
  }

  const initial = user.firstName.charAt(0).toUpperCase();
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-6 p-8">
      <div style={{ perspective: "900px" }}>
        <div
          ref={tilt.ref}
          onMouseMove={tilt.onMouseMove}
          onMouseLeave={tilt.onMouseLeave}
          style={{ ...tilt.style, transformStyle: "preserve-3d" }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-950 p-8 shadow-2xl shadow-teal-950/40 transition-transform duration-150 ease-out will-change-transform"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60 transition-opacity"
            style={{
              background:
                "radial-gradient(circle at var(--sheen-x, 50%) var(--sheen-y, 50%), rgba(216,190,120,0.35), transparent 55%)",
            }}
          />
          <div className="relative flex items-center gap-5" style={{ transform: "translateZ(40px)" }}>
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-3xl font-semibold text-teal-900 shadow-lg shadow-gold-900/30">
              {initial}
            </div>
            <div className="min-w-0">
              <h1 className="font-display truncate text-2xl font-semibold text-white">
                {user.firstName} {user.lastName}
              </h1>
              <p className="mt-1 truncate text-sm text-teal-100">{user.email}</p>
              <div className="mt-2">
                <Badge variant="gold">{ROLE_LABEL[user.globalRole] ?? user.globalRole}</Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="animate-fade-in-up rounded-xl border border-teal-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-teal-900">Profile details</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="rounded-md px-2.5 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
              >
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <ProfileEditForm
              user={user}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setUser(updated);
                setEditing(false);
              }}
            />
          ) : (
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between border-b border-teal-50 pb-2.5">
                <dt className="text-teal-700">First name</dt>
                <dd className="text-teal-900">{user.firstName}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-teal-50 pb-2.5">
                <dt className="text-teal-700">Last name</dt>
                <dd className="text-teal-900">{user.lastName}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-teal-50 pb-2.5">
                <dt className="text-teal-700">Email</dt>
                <dd className="text-teal-900">{user.email}</dd>
              </div>
              <div className="flex items-center justify-between pb-1">
                <dt className="text-teal-700">Phone</dt>
                <dd className="text-teal-900">{user.phone ?? "—"}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="animate-fade-in-up rounded-xl border border-teal-100 bg-white p-6 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-teal-900">Locations &amp; roles</h2>
          {user.locations.length === 0 ? (
            <p className="mt-3 text-sm text-teal-700">
              {user.globalRole === "HQ_ADMIN" ? "Network-wide access." : "No locations assigned yet."}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-teal-50">
              {user.locations.map((l) => (
                <li key={`${l.locationId}-${l.role}`} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-teal-900">{locationName(l.locationId)}</span>
                  <Badge variant={l.role === "LOCATION_ADMIN" ? "gold" : "neutral"}>
                    {ROLE_LABEL[l.role] ?? l.role}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileEditForm({
  user,
  onCancel,
  onSaved,
}: {
  user: AuthenticatedUser;
  onCancel: () => void;
  onSaved: (updated: AuthenticatedUser) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await apiFetch<AuthenticatedUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName, phone: phone || undefined }),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20";

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">First name</span>
          <input required autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium text-teal-900">Last name</span>
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-teal-900">Phone</span>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </label>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
