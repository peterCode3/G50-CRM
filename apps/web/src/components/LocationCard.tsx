import Link from "next/link";
import type { Location } from "@/lib/types";
import { resolveImageUrl } from "@/lib/api";
import { PinIcon, ArrowRightIcon, FlagIcon } from "./icons";

const COVERS = [
  "from-teal-900 to-teal-700",
  "from-teal-700 to-gold-700",
  "from-gold-700 to-teal-900",
];

function isOpenNow(location: Location): boolean | null {
  if (!location.openingHours) return null;
  const now = new Date();
  const key = (
    ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const
  )[now.getDay()];
  const today = location.openingHours[key];
  if (today.closed) return false;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = today.open.split(":").map(Number);
  const [ch, cm] = today.close.split(":").map(Number);
  return minutesNow >= oh * 60 + om && minutesNow < ch * 60 + cm;
}

export function LocationCard({ location, index = 0 }: { location: Location; index?: number }) {
  const openNow = isOpenNow(location);
  const serviceCount = location._count?.services;

  return (
    <Link
      href={`/locations/${location.id}`}
      style={{ animationDelay: `${index * 60}ms` }}
      className="group animate-fade-in-up flex flex-col overflow-hidden rounded-xl border border-teal-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
    >
      <div
        className={`relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br ${COVERS[index % COVERS.length]}`}
      >
        {location.images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(location.images[0])}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <FlagIcon className="pointer-events-none h-14 w-14 select-none text-white/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        {openNow != null && (
          <span
            className={`absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-sm ${
              openNow ? "bg-green-500/90 text-white" : "bg-black/40 text-white/90"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${openNow ? "bg-white" : "bg-white/60"}`} />
            {openNow ? "Open now" : "Closed"}
          </span>
        )}
        <h2 className="font-display absolute bottom-3 left-4 text-xl font-semibold text-white drop-shadow-sm">
          {location.name}
        </h2>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-teal-700">
          {location.address && (
            <span className="flex items-center gap-1.5">
              <PinIcon className="h-3.5 w-3.5 shrink-0" />
              {location.address}
            </span>
          )}
          {serviceCount != null && serviceCount > 0 && (
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800">
              {serviceCount} {serviceCount === 1 ? "service" : "services"}
            </span>
          )}
        </div>
        {location.description && (
          <p className="mt-2 line-clamp-2 text-sm text-teal-700/80">{location.description}</p>
        )}
        <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-gold-900 transition-transform duration-200 group-hover:translate-x-0.5">
          View classes &amp; appointments
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}
