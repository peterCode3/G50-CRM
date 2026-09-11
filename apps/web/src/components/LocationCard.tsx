import Link from "next/link";
import type { Location } from "@/lib/types";
import { PinIcon, ArrowRightIcon } from "./icons";

const COVERS = [
  "from-teal-900 to-teal-700",
  "from-teal-700 to-gold-700",
  "from-gold-700 to-teal-900",
];

function initialsFor(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function LocationCard({ location, index = 0 }: { location: Location; index?: number }) {
  return (
    <Link
      href={`/locations/${location.id}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className="group animate-fade-in-up overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div
        className={`relative flex h-20 items-center justify-center bg-gradient-to-br ${COVERS[index % COVERS.length]}`}
      >
        <span className="pointer-events-none select-none text-4xl font-bold text-white/15">
          {initialsFor(location.name)}
        </span>
      </div>
      <div className="p-5">
        <h2 className="text-lg font-semibold text-teal-900">{location.name}</h2>
        {location.address && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-teal-700">
            <PinIcon className="h-3.5 w-3.5 shrink-0" />
            {location.address}
          </p>
        )}
        {location.description && (
          <p className="mt-2 line-clamp-2 text-sm text-teal-700/80">{location.description}</p>
        )}
        <span className="mt-4 flex items-center gap-1 text-sm font-medium text-gold-900 transition-transform duration-200 group-hover:translate-x-0.5">
          View classes & appointments
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
