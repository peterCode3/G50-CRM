"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { MySession } from "@/lib/types";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { AttendanceModal } from "@/components/AttendanceModal";

function formatDateHeading(date: Date) {
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) return "Today";
  if (isTomorrow) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function SchedulePage() {
  const { user, loading: userLoading } = useCurrentUser();
  const [sessions, setSessions] = useState<MySession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rosterSession, setRosterSession] = useState<MySession | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<MySession[]>("/sessions/my")
      .then(setSessions)
      .catch(() => setLoadError("Couldn't load your schedule — please refresh."));
  }, [user]);

  if (loadError) {
    return <div className="flex h-screen items-center justify-center text-red-600">{loadError}</div>;
  }

  if (userLoading || sessions === null) {
    return (
      <div className="flex h-screen items-center justify-center text-teal-700">Loading...</div>
    );
  }

  const groups = new Map<string, MySession[]>();
  for (const s of sessions) {
    const key = new Date(s.startTime).toDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  return (
    <>
      <PageHeader
        title="My Schedule"
        description={
          user?.locations.some((l) => l.role === "COACH")
            ? "Your upcoming sessions across every location you coach at."
            : "Sessions where you're the assigned coach."
        }
      />

      <div className="flex flex-col gap-6 p-8">
        {sessions.length === 0 && (
          <Card>
            <p className="text-sm text-teal-700">No upcoming sessions.</p>
          </Card>
        )}

        {[...groups.entries()].map(([dateKey, daySessions]) => (
          <Card key={dateKey} title={formatDateHeading(new Date(dateKey))}>
            <ul className="flex flex-col divide-y divide-teal-50">
              {daySessions.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-teal-900">{s.service.name}</p>
                    <p className="text-xs text-teal-700">
                      {new Date(s.startTime).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" – "}
                      {new Date(s.endTime).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {s.location.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-teal-700">
                    {s.capacity != null && <span>Capacity {s.capacity}</span>}
                    <Badge variant={s.service.type === "CLASS" ? "neutral" : "gold"}>
                      {s.service.type}
                    </Badge>
                    <Button
                      variant="secondary"
                      className="!px-2 !py-1 text-xs"
                      onClick={() => setRosterSession(s)}
                    >
                      Roster
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <AttendanceModal
        sessionId={rosterSession?.id ?? null}
        title={
          rosterSession
            ? `${rosterSession.service.name} · ${new Date(rosterSession.startTime).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
            : undefined
        }
        onClose={() => setRosterSession(null)}
      />
    </>
  );
}
