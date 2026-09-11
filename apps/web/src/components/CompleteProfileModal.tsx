"use client";

import { useEffect, useState } from "react";
import { apiFetch, ApiError, type AuthenticatedUser } from "@/lib/api";
import type { Location } from "@/lib/types";
import { TextField } from "./TextField";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

export function CompleteProfileModal({
  user,
  onClose,
  onComplete,
}: {
  user: AuthenticatedUser;
  onClose: () => void;
  onComplete: (updated: AuthenticatedUser) => void;
}) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth?.slice(0, 10) ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [city, setCity] = useState(user.city ?? "");
  const [postalCode, setPostalCode] = useState(user.postalCode ?? "");
  const [homeLocationId, setHomeLocationId] = useState(user.homeLocationId ?? "");
  const [homePhone, setHomePhone] = useState(user.homePhone ?? "");
  const [workPhone, setWorkPhone] = useState(user.workPhone ?? "");
  const [gender, setGender] = useState(user.gender ?? "");
  const [referredBy, setReferredBy] = useState(user.referredBy ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<Location[]>("/locations").then(setLocations).catch(() => {});
  }, []);

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
          homeLocationId,
          homePhone: homePhone || undefined,
          workPhone: workPhone || undefined,
          gender: gender || undefined,
          referredBy: referredBy || undefined,
        }),
      });
      onComplete(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-teal-950/50 px-4 py-10">
      <div className="animate-scale-in w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-teal-50 px-6 py-4">
          <h2 className="text-sm font-semibold text-teal-900">Complete profile information</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-teal-400 transition hover:bg-teal-50 hover:text-teal-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-6">
          <div className="mb-6 text-center">
            <p className="text-lg font-semibold text-teal-900">👋 Welcome back!</p>
            <p className="mt-1 text-sm text-teal-700">
              We just need a bit more information. Please fill out the required fields below.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <TextField
                label="First name *"
                required
                className="w-1/2"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <TextField
                label="Last name *"
                required
                className="w-1/2"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>

            <TextField label="Email *" value={user.email} disabled className="opacity-70" />

            <TextField
              label="Cell phone *"
              required
              type="tel"
              placeholder="e.g. +61 400 000 000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <TextField
              label="Date of birth *"
              required
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />

            <TextField
              label="Address *"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />

            <div className="flex gap-3">
              <TextField
                label="City *"
                required
                className="w-1/2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <TextField
                label="Postal code *"
                required
                className="w-1/2"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Home location *</span>
              <select
                required
                value={homeLocationId}
                onChange={(e) => setHomeLocationId(e.target.value)}
                className="rounded-md border border-teal-300 px-3 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="" disabled>
                  Please select
                </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>

            <hr className="my-2 border-teal-50" />
            <p className="text-sm font-semibold text-teal-900">Additional information</p>

            <TextField
              label="Home phone"
              type="tel"
              value={homePhone}
              onChange={(e) => setHomePhone(e.target.value)}
            />
            <TextField
              label="Work phone"
              type="tel"
              value={workPhone}
              onChange={(e) => setWorkPhone(e.target.value)}
            />

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-teal-900">Gender</span>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="rounded-md border border-teal-300 px-3 py-2.5 text-sm text-teal-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </label>

            <TextField
              label="Referred by"
              placeholder="Email or member ID"
              value={referredBy}
              onChange={(e) => setReferredBy(e.target.value)}
            />

            {error && (
              <p className="animate-fade-in rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="mt-2 flex items-center justify-center gap-2 !py-2.5"
            >
              {submitting && <Spinner />}
              {submitting ? "Updating..." : "Update account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
