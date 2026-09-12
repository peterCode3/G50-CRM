"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import type { StaffDetail } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Spinner } from "@/components/Spinner";

const ROLE_LABEL: Record<"LOCATION_ADMIN" | "COACH", string> = {
  LOCATION_ADMIN: "Location Admin",
  COACH: "Coach",
};

export default function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [staff, setStaff] = useState<StaffDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<StaffDetail>(`/staff/${id}`)
      .then(setStaff)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load this staff member."));
  }, [id]);

  if (error) {
    return <div className="flex h-screen items-center justify-center text-red-600">{error}</div>;
  }

  if (!staff) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">
        <Spinner />
      </div>
    );
  }

  const initial = staff.firstName.charAt(0).toUpperCase();

  return (
    <>
      <PageHeader
        title={`${staff.firstName} ${staff.lastName}`}
        description={staff.email}
        action={
          <Link href="/staff" className="text-sm text-teal-700 hover:underline">
            ← All staff
          </Link>
        }
      />

      <div className="flex flex-col gap-6 p-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <Card>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-300 to-gold-700 text-2xl font-semibold text-teal-900">
                {initial}
              </div>
              <div>
                <p className="font-semibold text-teal-900">
                  {staff.firstName} {staff.lastName}
                </p>
                <p className="text-sm text-teal-700">{staff.email}</p>
                {staff.phone && <p className="text-sm text-teal-700">{staff.phone}</p>}
              </div>
              <Badge variant={staff.isActive ? "success" : "danger"}>
                {staff.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="mt-5 flex flex-col gap-2 border-t border-teal-50 pt-4">
              <p className="text-xs font-semibold tracking-wide text-teal-700/70 uppercase">
                Locations &amp; roles
              </p>
              {staff.roles.map((r) => (
                <div key={`${r.locationId}-${r.role}`} className="flex items-center justify-between text-sm">
                  <span className="text-teal-900">{r.locationName}</span>
                  <Badge variant={r.role === "LOCATION_ADMIN" ? "gold" : "neutral"}>{ROLE_LABEL[r.role]}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <Card title={`Services delivered (${staff.services.length})`}>
              {staff.services.length === 0 ? (
                <p className="text-sm text-teal-700">Not assigned to any service yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-teal-50">
                  {staff.services.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-teal-900">{s.name}</p>
                        <p className="text-xs text-teal-700">{s.locationName}</p>
                      </div>
                      <Badge variant={s.type === "CLASS" ? "neutral" : "gold"}>
                        {s.type === "CLASS" ? "Class" : "Appointment"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={`Upcoming schedule (${staff.upcomingSessions.length})`}>
              {staff.upcomingSessions.length === 0 ? (
                <p className="text-sm text-teal-700">No upcoming sessions.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-teal-50 text-xs font-semibold tracking-wide text-teal-700 uppercase">
                      <th className="py-2 pr-4">Service</th>
                      <th className="py-2 pr-4">Location</th>
                      <th className="py-2 pr-4">When</th>
                      <th className="py-2 pr-4">Booked</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-50">
                    {staff.upcomingSessions.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5 pr-4 text-teal-900">{s.serviceName}</td>
                        <td className="py-2.5 pr-4 text-teal-700">{s.locationName}</td>
                        <td className="py-2.5 pr-4 text-teal-700">
                          {new Date(s.startTime).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 pr-4 text-teal-700">
                          {s.bookedCount}
                          {s.capacity != null ? ` / ${s.capacity}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            <Card title={`Assigned clients (${staff.clients.length})`}>
              {staff.clients.length === 0 ? (
                <p className="text-sm text-teal-700">No clients yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-teal-50">
                  {staff.clients.map((c) => (
                    <li key={c.id} className="py-2.5 text-sm">
                      <Link href={`/customers/${c.id}`} className="font-medium text-teal-900 hover:underline">
                        {c.firstName} {c.lastName}
                      </Link>
                      <p className="text-xs text-teal-700">{c.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
