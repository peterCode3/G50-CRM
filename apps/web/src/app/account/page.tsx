"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";
import type { Booking, CreditBalance, Location, UserMembership } from "@/lib/types";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { Spinner } from "@/components/Spinner";
import { Badge } from "@/components/Badge";
import {
  CalendarIcon,
  CreditCardIcon,
  EditIcon,
  LogoutIcon,
  MailIcon,
  PinIcon,
  UserIcon,
} from "@/components/icons";

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [activeMembership, setActiveMembership] = useState<UserMembership | null>(null);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<AuthenticatedUser>("/auth/me"),
      apiFetch<Location[]>("/locations"),
      apiFetch<Booking[]>("/bookings/my"),
      apiFetch<UserMembership[]>("/memberships/my"),
      apiFetch<CreditBalance[]>("/credit-balances/my"),
    ])
      .then(([me, locs, bookings, memberships, balances]) => {
        setUser(me);
        setLocations(locs);
        const now = new Date();
        setUpcomingCount(
          bookings.filter((b) => b.status === "CONFIRMED" && new Date(b.session.startTime) >= now).length,
        );
        setActiveMembership(memberships.find((m) => m.status === "ACTIVE") ?? null);
        setTotalCredits(balances.reduce((sum, b) => sum + b.creditsRemaining, 0));
      })
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

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center bg-teal-50/40 px-6 py-16 text-teal-700">
        <Spinner className="h-6 w-6" />
      </main>
    );
  }

  const initial = user.firstName.charAt(0).toUpperCase();
  const homeLocation = locations.find((l) => l.id === user.homeLocationId);

  return (
    <main className="flex flex-1 flex-col bg-teal-50/40">
      <section className="border-b border-teal-100 bg-gradient-to-br from-teal-900 to-teal-700 px-6 py-12">
        <div className="animate-fade-in-up mx-auto flex max-w-4xl items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 text-2xl font-semibold text-teal-900 shadow-lg">
            {initial}
          </div>
          <div className="min-w-0">
            <h1 className="font-display truncate text-2xl font-semibold text-white">
              {user.firstName} {user.lastName}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-teal-100">
              <MailIcon className="h-3.5 w-3.5 shrink-0" />
              {user.email}
            </p>
          </div>
          <Badge variant="gold">{user.globalRole.replace("_", " ")}</Badge>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        {/* Quick stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/bookings"
            className="animate-fade-in-up rounded-xl border border-teal-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
              <CalendarIcon className="h-3.5 w-3.5" />
              Upcoming
            </p>
            <p className="mt-2 text-2xl font-semibold text-teal-900">{upcomingCount}</p>
            <p className="mt-0.5 text-xs text-teal-700">booking{upcomingCount === 1 ? "" : "s"}</p>
          </Link>

          <Link
            href="/membership"
            className="animate-fade-in-up rounded-xl border border-teal-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: "40ms" }}
          >
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
              <CreditCardIcon className="h-3.5 w-3.5" />
              Membership
            </p>
            <p className="mt-2 truncate text-2xl font-semibold text-teal-900">
              {activeMembership ? activeMembership.plan.name : "None"}
            </p>
            <p className="mt-0.5 text-xs text-teal-700">
              {activeMembership ? "Active" : "Browse plans"}
            </p>
          </Link>

          <Link
            href="/membership"
            className="animate-fade-in-up rounded-xl border border-teal-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: "80ms" }}
          >
            <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
              <CreditCardIcon className="h-3.5 w-3.5" />
              Credits
            </p>
            <p className="mt-2 text-2xl font-semibold text-teal-900">{totalCredits}</p>
            <p className="mt-0.5 text-xs text-teal-700">remaining</p>
          </Link>
        </div>

        {/* Profile details */}
        <div className="animate-fade-in-up mt-6 rounded-xl border border-teal-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-teal-900">Profile details</h2>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
              >
                <EditIcon className="h-3.5 w-3.5" />
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <ProfileEditForm
              user={user}
              locations={locations}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setUser(updated);
                setEditing(false);
              }}
            />
          ) : (
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between border-b border-teal-50 pb-2 sm:border-0 sm:pb-0">
                <dt className="flex items-center gap-1.5 text-teal-700">
                  <UserIcon className="h-3.5 w-3.5" />
                  Phone
                </dt>
                <dd className="text-teal-900">{user.phone ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between border-b border-teal-50 pb-2 sm:border-0 sm:pb-0">
                <dt className="flex items-center gap-1.5 text-teal-700">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Date of birth
                </dt>
                <dd className="text-teal-900">
                  {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-teal-50 pb-2 sm:border-0 sm:pb-0">
                <dt className="flex items-center gap-1.5 text-teal-700">
                  <PinIcon className="h-3.5 w-3.5" />
                  Address
                </dt>
                <dd className="truncate text-teal-900">
                  {user.address ? `${user.address}, ${user.city ?? ""}` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between pb-2">
                <dt className="flex items-center gap-1.5 text-teal-700">
                  <PinIcon className="h-3.5 w-3.5" />
                  Home location
                </dt>
                <dd className="truncate text-teal-900">{homeLocation?.name ?? "—"}</dd>
              </div>
            </dl>
          )}
        </div>

        <Button
          variant="secondary"
          onClick={onLogout}
          disabled={loggingOut}
          className="mt-6 flex items-center justify-center gap-2"
        >
          {loggingOut ? <Spinner /> : <LogoutIcon className="h-4 w-4" />}
          {loggingOut ? "Logging out..." : "Log out"}
        </Button>
      </section>
    </main>
  );
}

function ProfileEditForm({
  user,
  locations,
  onCancel,
  onSaved,
}: {
  user: AuthenticatedUser;
  locations: Location[];
  onCancel: () => void;
  onSaved: (updated: AuthenticatedUser) => void;
}) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth?.slice(0, 10) ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [postalCode, setPostalCode] = useState(user.postalCode ?? "");
  const [homeLocationId, setHomeLocationId] = useState(user.homeLocationId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const updated = await apiFetch<AuthenticatedUser>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          dateOfBirth,
          address,
          city,
          postalCode,
          homeLocationId: homeLocationId || undefined,
        }),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="animate-fade-in-up mt-4 flex flex-col gap-4">
      <div className="flex gap-3">
        <TextField label="First name" className="w-1/2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <TextField label="Last name" className="w-1/2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <TextField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <TextField label="Date of birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
      <TextField label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <div className="flex gap-3">
        <TextField label="City" className="w-1/2" value={city} onChange={(e) => setCity(e.target.value)} />
        <TextField label="Postal code" className="w-1/2" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-teal-900">Home location</span>
        <select
          value={homeLocationId}
          onChange={(e) => setHomeLocationId(e.target.value)}
          className="rounded-md border-2 border-teal-200 px-3 py-2.5 text-sm text-teal-900 outline-none transition focus:border-gold-500 focus:ring-4 focus:ring-gold-500/15"
        >
          <option value="">Not set</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="flex flex-1 items-center justify-center gap-2">
          {submitting && <Spinner />}
          {submitting ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
