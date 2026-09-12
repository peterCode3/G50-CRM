"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const NAV_ITEMS: {
  href: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  hqOnly?: boolean;
  coachOnly?: boolean;
  locationAdminOnly?: boolean;
  coachOrLocationAdminOnly?: boolean;
}[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
  { href: "/schedule", label: "My Schedule", icon: ScheduleIcon, coachOnly: true },
  {
    href: "/booking-requests",
    label: "Booking Requests",
    icon: RequestIcon,
    coachOrLocationAdminOnly: true,
  },
  { href: "/locations", label: "Locations", icon: LocationIcon, locationAdminOnly: true },
  { href: "/staff", label: "Staff Members", icon: StaffIcon, locationAdminOnly: true },
  { href: "/classes", label: "Classes", icon: TemplateIcon, hqOnly: true },
  { href: "/appointments", label: "Appointments", icon: AppointmentIcon, hqOnly: true },
  { href: "/memberships", label: "Memberships", icon: MembershipIcon, hqOnly: true },
  { href: "/reports", label: "Reports", icon: ReportIcon, locationAdminOnly: true },
  { href: "/bookings", label: "Bookings", icon: BookingIcon, locationAdminOnly: true },
  { href: "/customers", label: "Customers", icon: CustomerIcon, locationAdminOnly: true },
  { href: "/payments", label: "Payments", icon: PaymentIcon, locationAdminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  const isHqAdmin = user?.globalRole === "HQ_ADMIN";
  const isCoach = isHqAdmin || (user?.locations.some((l) => l.role === "COACH") ?? false);
  const isLocationAdmin =
    isHqAdmin || (user?.locations.some((l) => l.role === "LOCATION_ADMIN") ?? false);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-teal-900 text-teal-50">
      <div className="flex items-center gap-2 border-b border-teal-700/60 px-5 py-5">
        <Image src="/logo.png" alt="G50.Golf" width={818} height={616} priority className="h-9 w-auto" />
        <span className="text-xs font-semibold tracking-widest text-gold-100 uppercase">
          Admin
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.filter(
            (item) =>
              (!item.hqOnly || isHqAdmin) &&
              (!item.coachOnly || isCoach) &&
              (!item.locationAdminOnly || isLocationAdmin) &&
              (!item.coachOrLocationAdminOnly || isCoach || isLocationAdmin),
          ).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-gold-500 text-teal-900"
                      : "text-teal-50/85 hover:bg-teal-700/50 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {user && (
        <div className="border-t border-teal-700/60 px-4 py-4">
          <Link
            href="/profile"
            className={`-mx-2 flex flex-col rounded-md px-2 py-1 transition hover:bg-teal-700/40 ${
              pathname === "/profile" ? "bg-teal-700/40" : ""
            }`}
          >
            <p className="truncate text-sm font-medium text-white">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-teal-50/60">{user.globalRole.replace("_", " ")}</p>
          </Link>
          <button
            onClick={onLogout}
            disabled={loggingOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-teal-50/20 px-3 py-1.5 text-xs font-medium text-teal-50/85 transition hover:bg-teal-700/50 disabled:opacity-60"
          >
            {loggingOut && (
              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            )}
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      )}
    </aside>
  );
}

type IconProps = { className?: string };

function DashboardIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11" y="11" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LocationIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path
        d="M10 18s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function TemplateIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MembershipIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2.5" y="5" width="15" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 8.5h15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 11.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ScheduleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8h14M7 2v4M13 2v4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function AppointmentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6.5V10l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BookingIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M5 3h10v14l-5-3-5 3V3Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function RequestIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M4 4h9l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 10.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StaffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="7" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="14.5" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.5 16.5c.7-2.8 2.6-4.3 4.5-4.3s3.8 1.5 4.5 4.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.7c1.6.1 3.2 1.3 3.8 3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CustomerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <circle cx="10" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 17c1-3.5 4-5 6.5-5s5.5 1.5 6.5 5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function PaymentIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 9h16" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ReportIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className}>
      <path d="M4 16V9M10 16V4M16 16v-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
