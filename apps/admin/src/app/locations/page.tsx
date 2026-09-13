"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Location } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { resolveImageUrl } from "@/lib/upload";

// Alternating cover treatments so a grid of cards doesn't read as one flat block —
// still entirely within the brand palette (teal <-> gold), no per-location images required.
const COVERS = [
  "from-teal-900 to-teal-700",
  "from-teal-700 to-gold-700",
  "from-gold-700 to-teal-900",
];

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default function LocationsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);

  const isHqAdmin = user?.globalRole === "HQ_ADMIN";

  useEffect(() => {
    if (!user) return;
    loadLocations().catch(() => setLoadError("Couldn't load locations — please refresh."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadLocations() {
    if (isHqAdmin) {
      setLocations(await apiFetch<Location[]>("/locations/admin/all"));
      return;
    }
    const myLocationIds = user!.locations
      .filter((l) => l.role === "LOCATION_ADMIN")
      .map((l) => l.locationId);
    const results = await Promise.all(
      myLocationIds.map((id) => apiFetch<Location>(`/locations/${id}`)),
    );
    setLocations(results);
  }

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await apiFetch("/locations", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setName("");
      setSlug("");
      setShowForm(false);
      await loadLocations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function onToggleActive(loc: Location) {
    await apiFetch(`/locations/${loc.id}/${loc.isActive ? "deactivate" : "activate"}`, {
      method: "POST",
    });
    await loadLocations();
  }

  const filtered = useMemo(() => {
    if (!locations) return [];
    const q = search.trim().toLowerCase();
    if (!q) return locations;
    return locations.filter(
      (l) => l.name.toLowerCase().includes(q) || l.slug.toLowerCase().includes(q),
    );
  }, [locations, search]);

  if (loadError) {
    return <div className="flex h-screen items-center justify-center text-red-600">{loadError}</div>;
  }

  if (userLoading || locations === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">Loading...</div>
    );
  }

  return (
    <>
      <PageHeader
        title={isHqAdmin ? "All Locations" : "My Locations"}
        description={`${locations.length} location${locations.length === 1 ? "" : "s"}`}
        action={
          isHqAdmin && <Button onClick={() => setShowForm(true)}>+ New Location</Button>
        }
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create a location"
        description="Add a new G50.Golf location to the network."
      >
        <form onSubmit={onCreate} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Name</span>
            <input
              required
              autoFocus
              placeholder="e.g. Twin Waters"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(slugify(e.target.value));
              }}
              className="rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-teal-900">Slug</span>
            <input
              required
              placeholder="e.g. twin-waters"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="rounded-md border border-teal-300 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
            <span className="text-xs text-teal-700/70">Used in the location's public booking URL.</span>
          </label>
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Creating..." : "Create location"}
            </Button>
          </div>
        </form>
      </Modal>

      <div className="flex flex-col gap-6 p-8">
        <div className="flex items-center justify-between">
          <div className="relative w-full max-w-xs">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-teal-700/50"
            >
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              placeholder="Search locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-teal-300 py-2 pr-3 pl-9 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-teal-700">
            {locations.length === 0 ? "No locations yet." : "No locations match your search."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((loc, i) => (
              <div
                key={loc.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm transition hover:shadow-md"
              >
                <Link href={`/locations/${loc.id}`} className="block">
                  <div
                    className={`relative flex h-24 items-start justify-between overflow-hidden bg-gradient-to-br p-3 ${COVERS[i % COVERS.length]}`}
                  >
                    {loc.images.length > 0 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(loc.images[0])}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    )}
                    <div className="relative z-10">
                      <Badge variant={loc.isActive ? "success" : "danger"}>
                        {loc.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {loc.images.length === 0 && (
                      <span className="pointer-events-none select-none text-5xl font-bold text-white/10">
                        {initialsFor(loc.name)}
                      </span>
                    )}
                  </div>
                </Link>
                <div className="relative px-4 pt-8 pb-4">
                  <div className="absolute -top-6 left-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gold-100 text-sm font-semibold text-teal-900 shadow-sm">
                    {loc.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveImageUrl(loc.logoUrl)} alt="" className="h-full w-full object-contain p-0.5" />
                    ) : (
                      initialsFor(loc.name)
                    )}
                  </div>
                  <Link href={`/locations/${loc.id}`}>
                    <h3 className="font-semibold text-teal-900 group-hover:underline">{loc.name}</h3>
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-teal-700">
                    {loc.address ?? `/${loc.slug}`}
                  </p>
                  {isHqAdmin && (
                    <div className="mt-3 flex justify-end border-t border-teal-50 pt-3">
                      <Button
                        variant="ghost"
                        className="!px-2 !py-1 text-xs"
                        onClick={() => onToggleActive(loc)}
                      >
                        {loc.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
