"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthLayout } from "@/components/AuthLayout";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { MailIcon, LockIcon, UserIcon } from "@/components/icons";

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      router.push("/account");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      tagline="Join the club."
      subtext="Create your G50.Golf account to book classes, appointments and coaching near you."
    >
      <div className="animate-scale-in w-full max-w-sm rounded-2xl border border-teal-100 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="font-display text-2xl font-semibold text-teal-900">Create your account</h1>
          <p className="mt-1 text-sm text-teal-700">
            Join G50.Golf to book classes and coaching near you.
          </p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <TextField
              label="First name"
              required
              className="w-1/2"
              icon={<UserIcon className="h-4 w-4" />}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <TextField
              label="Last name"
              required
              className="w-1/2"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
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
            minLength={8}
            hint="At least 8 characters."
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
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-teal-700">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-teal-900 underline">
            Log in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
