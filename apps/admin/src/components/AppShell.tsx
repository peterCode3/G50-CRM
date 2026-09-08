"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthScreen = pathname === "/login";

  if (isAuthScreen) {
    return <main className="min-h-screen bg-teal-50/40">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-teal-50/40">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
