"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { Location } from "@/lib/types";

export default function HomePage() {
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Location[]>("/locations")
      .then(setLocations)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Couldn't load locations — please refresh.");
      });
  }, []);

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40">
      <section className="border-b border-teal-100 bg-white px-6 py-16 text-center">
        <h1 className="text-3xl font-semibold text-teal-900">Find your G50.Golf location</h1>
        <p className="mx-auto mt-3 max-w-xl text-teal-700">
          Book classes, appointments and coaching at your nearest location.
        </p>
      </section>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
        {error && <p className="text-center text-sm text-red-600">{error}</p>}

        {!error && locations === null && (
          <p className="text-center text-sm text-teal-700">Loading locations...</p>
        )}

        {locations?.length === 0 && (
          <p className="text-center text-sm text-teal-700">No locations available yet.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {locations?.map((loc) => (
            <Link
              key={loc.id}
              href={`/locations/${loc.id}`}
              className="rounded-xl border border-teal-100 bg-white p-6 shadow-sm transition hover:border-gold-500 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-teal-900">{loc.name}</h2>
              {loc.address && <p className="mt-1 text-sm text-teal-700">{loc.address}</p>}
              {loc.description && (
                <p className="mt-2 text-sm text-teal-700/80">{loc.description}</p>
              )}
              <span className="mt-4 inline-block text-sm font-medium text-gold-900">
                View classes & appointments →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
