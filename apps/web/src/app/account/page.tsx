"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/components/Badge";
import { LogoutIcon } from "@/components/icons";

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
        <Spinner className="h-6 w-6" />
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const initial = user.firstName.charAt(0).toUpperCase();

  return (
    <main className="flex flex-1 items-center justify-center bg-teal-50/40 px-6 py-16">
      <div className="animate-scale-in w-full max-w-sm rounded-2xl border border-teal-100 bg-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-700 text-2xl font-semibold text-teal-900 shadow-sm">
            {initial}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-teal-900">
              {user.firstName} {user.lastName}
            </h1>
            <p className="text-sm text-teal-700">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md bg-teal-50/40 px-4 py-3 text-sm">
          <span className="text-teal-700">Account type</span>
          <Badge variant="gold">{user.globalRole.replace("_", " ")}</Badge>
        </div>

        <Button
          variant="secondary"
          onClick={onLogout}
          disabled={loggingOut}
          className="mt-6 flex w-full items-center justify-center gap-2"
        >
          {loggingOut ? <Spinner /> : <LogoutIcon className="h-4 w-4" />}
          {loggingOut ? "Logging out..." : "Log out"}
        </Button>
      </div>
    </main>
  );
}
