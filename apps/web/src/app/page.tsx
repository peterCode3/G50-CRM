"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import type { Location } from "@/lib/types";
import { LocationCard } from "@/components/LocationCard";

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
      <section className="relative overflow-hidden border-b border-teal-100 bg-gradient-to-br from-teal-900 via-teal-800 to-teal-900 px-6 py-20 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <p className="animate-fade-in relative text-xs font-semibold tracking-widest text-gold-300 uppercase">
          Book online in minutes
        </p>
        <h1 className="animate-fade-in-up font-display relative mt-3 text-4xl font-semibold text-white sm:text-5xl">
          Find your G50.Golf location
        </h1>
        <p
          style={{ animationDelay: "80ms" }}
          className="animate-fade-in-up relative mx-auto mt-4 max-w-xl text-teal-100"
        >
          Book classes, appointments and coaching at your nearest location — browse first, no
          account needed.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-14">
        {error && (
          <p className="rounded-md bg-red-50 px-4 py-3 text-center text-sm text-red-600">{error}</p>
        )}

        {!error && locations === null && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-[268px] animate-pulse rounded-xl border border-teal-100 bg-white"
              />
            ))}
          </div>
        )}

        {locations?.length === 0 && (
          <p className="text-center text-sm text-teal-700">No locations available yet.</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {locations?.map((loc, i) => (
            <LocationCard key={loc.id} location={loc} index={i} />
          ))}
        </div>
      </section>
    </main>
  );
}
