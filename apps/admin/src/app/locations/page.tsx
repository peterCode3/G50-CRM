"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Location } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

export default function LocationsPage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [locations, setLocations] = useState<Location[] | null>(null);
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
        <Card className="overflow-hidden !p-0">
          {locations.length === 0 ? (
            <p className="p-5 text-sm text-teal-700">No locations yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Slug</th>
                  <th className="px-5 py-3">Status</th>
                  {isHqAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-50">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-teal-50/40">
                    <td className="px-5 py-3">
                      <Link href={`/locations/${loc.id}`} className="font-medium text-teal-900 hover:underline">
                        {loc.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-teal-700">{loc.slug}</td>
                    <td className="px-5 py-3">
                      <Badge variant={loc.isActive ? "success" : "danger"}>
                        {loc.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {isHqAdmin && (
                      <td className="px-5 py-3 text-right">
                        <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => onToggleActive(loc)}>
                          {loc.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
