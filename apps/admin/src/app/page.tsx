"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import type { AuthenticatedUser } from "@/lib/api";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    apiFetch<AuthenticatedUser>("/auth/me")
      .then(() => router.replace("/dashboard"))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
        }
      });
  }, [router]);

  return <div className="flex h-screen items-center justify-center text-teal-700">Loading...</div>;
}
