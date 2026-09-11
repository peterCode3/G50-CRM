"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { MailIcon, LockIcon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="animate-scale-in w-full max-w-sm rounded-2xl border border-teal-100 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-teal-900">Welcome back</h1>
          <p className="mt-1 text-sm text-teal-700">Log in to book your next session.</p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <TextField
            label="Email"
            type="email"
            required
            icon={<MailIcon className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            required
            icon={<LockIcon className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p className="animate-fade-in rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="mt-1 flex items-center justify-center gap-2 !py-2.5">
            {loading && <Spinner />}
            {loading ? "Logging in..." : "Log in"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-teal-700">
          New to G50.Golf?{" "}
          <Link href="/register" className="font-medium text-teal-900 underline">
            Create an account
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
