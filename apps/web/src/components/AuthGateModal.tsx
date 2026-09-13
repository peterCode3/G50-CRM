"use client";

import { useState } from "react";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { MailIcon, LockIcon, UserIcon } from "./icons";

/**
 * "Sign in to continue" / "Create account" — shown inline, in place, when an
 * anonymous golfer tries to book. Previously this redirected to a separate
 * /login page and lost whatever session they were about to book; now it
 * authenticates without ever leaving the booking flow, and the pending
 * action (booking/waitlist) resumes immediately after.
 */
export function AuthGateModal({
  onClose,
  onAuthenticated,
}: {
  onClose: () => void;
  onAuthenticated: (user: AuthenticatedUser) => void;
}) {
  const [mode, setMode] = useState<"SIGN_IN" | "SIGN_UP">("SIGN_IN");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user =
        mode === "SIGN_IN"
          ? await apiFetch<AuthenticatedUser>("/auth/login", {
              method: "POST",
              body: JSON.stringify({ email, password }),
            })
          : await apiFetch<AuthenticatedUser>("/auth/register", {
              method: "POST",
              body: JSON.stringify({ firstName, lastName, email, password }),
            });
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-teal-950/50 px-4 py-10">
      <div className="animate-scale-in w-full max-w-sm rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-teal-50 px-6 py-4">
          <h2 className="font-display text-base font-semibold text-teal-900">
            {mode === "SIGN_IN" ? "Sign in to continue" : "Create your account"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-teal-400 transition hover:bg-teal-50 hover:text-teal-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 px-6 py-6">
          <p className="text-sm text-teal-700">
            {mode === "SIGN_IN"
              ? "Log in to finish booking this session."
              : "Just a few details and you're ready to book."}
          </p>

          {mode === "SIGN_UP" && (
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
          )}

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
            minLength={mode === "SIGN_UP" ? 8 : undefined}
            hint={mode === "SIGN_UP" ? "At least 8 characters." : undefined}
            icon={<LockIcon className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="animate-fade-in rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="mt-1 flex items-center justify-center gap-2 !py-2.5"
          >
            {submitting && <Spinner />}
            {submitting
              ? mode === "SIGN_IN"
                ? "Signing in..."
                : "Creating account..."
              : mode === "SIGN_IN"
                ? "Sign in"
                : "Create account"}
          </Button>

          <p className="text-center text-sm text-teal-700">
            {mode === "SIGN_IN" ? (
              <>
                New to G50.Golf?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("SIGN_UP");
                    setError(null);
                  }}
                  className="font-medium text-teal-900 underline"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("SIGN_IN");
                    setError(null);
                  }}
                  className="font-medium text-teal-900 underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
