"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/membership", label: "Membership" },
  { href: "/bookings", label: "My Bookings" },
  { href: "/account", label: "Account" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 w-full border-b border-teal-50 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="G50.Golf"
            width={818}
            height={616}
            priority
            className="h-12 w-auto"
          />
        </Link>
        <nav className="flex items-center gap-0.5 text-xs font-medium text-teal-700 sm:gap-1 sm:text-sm">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2 py-1.5 whitespace-nowrap transition sm:px-3 ${
                  active ? "bg-teal-50 text-teal-900" : "hover:bg-teal-50/60 hover:text-teal-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
