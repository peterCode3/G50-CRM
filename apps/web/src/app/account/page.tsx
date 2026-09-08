"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    apiFetch<AuthenticatedUser>("/auth/me")
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        } else {
          setLoadError("Couldn't load your account — please refresh.");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onLogout() {
    setLoggingOut(true);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  if (loadError) {
    return (
      <main className="flex flex-1 items-center justify-center bg-teal-50/40 px-6 py-16 text-red-600">
        {loadError}
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center bg-teal-50/40 px-6 py-16 text-teal-700">
        Loading...
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const initial = user.firstName.charAt(0).toUpperCase();

  return (
    <main className="flex flex-1 items-center justify-center bg-teal-50/40 px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-teal-100 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-100 text-xl font-semibold text-teal-900">
            {initial}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-teal-900">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-sm text-teal-700">{user.email}</p>
          </div>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-md bg-teal-50/40 px-4 py-3 text-sm">
          <dt className="text-teal-700">Account type</dt>
          <dd className="font-medium text-teal-900">{user.globalRole.replace("_", " ")}</dd>
        </dl>

        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-teal-300 px-4 py-2.5 text-sm font-medium text-teal-700 transition hover:bg-teal-50 disabled:opacity-60"
        >
          {loggingOut && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {loggingOut ? "Logging out..." : "Log out"}
        </button>
      </div>
    </main>
  );
}
