import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bus,
  Gauge,
  Route as RouteIcon,
  MapPin,
  Clock,
  Radio,
} from "lucide-react";
import { getHomeRouteForRole, getSession } from "@/lib/auth";
import { useLiveTracking } from "../hooks/use-live-tracking";
import { useRoleNotifications } from "../hooks/use-role-notifications";

export const Route = createFileRoute("/student")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;

    const session = getSession();
    if (!session) {
      throw redirect({ to: "/login" });
    }

    if (session.role !== "student") {
      throw redirect({ to: getHomeRouteForRole(session.role) });
    }
  },
  head: () => ({
    meta: [
      { title: "Student Dashboard - PulseRide" },
      {
        name: "description",
        content:
          "View your assigned bus details, live stop activity, and notifications.",
      },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const [studentId, setStudentId] = useState("student");
  const { tracking, loading } = useLiveTracking();
  const { notifications, loading: notificationsLoading } = useRoleNotifications("student");

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    setStudentId(session.email.split("@")[0] || "student");
  }, []);

  const isActive = tracking?.isActive ?? false;

  /* format ISO timestamp to relative string */
  const lastUpdated = tracking?.updatedAt
    ? formatRelativeTime(tracking.updatedAt)
    : null;

  return (
    <div className="h-full lg:h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-5 sm:py-5">
        {/* ── Header ── */}
        <header className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Student dashboard
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome, {studentId}
          </h1>
        </header>

        <div className="space-y-4">
          {/* ── Bus Status Card ── */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Bus Status
            </p>
            <div className="mt-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                {isActive ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                  </span>
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                )}
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {isActive ? "Bus is Active" : "No Active Trip"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isActive
                      ? "Driver is sharing live location"
                      : "Waiting for driver to start a trip"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Live Stats ── */}
          {loading ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex min-h-20 items-center justify-center">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Loading live data…
                </p>
              </div>
            </section>
          ) : isActive && tracking ? (
            <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Live Tracking
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <InfoTile
                  icon={<Gauge className="h-4 w-4" />}
                  label="Speed"
                  value={`${tracking.speedKmh.toFixed(0)}`}
                  suffix="km/h"
                />
                <InfoTile
                  icon={<RouteIcon className="h-4 w-4" />}
                  label="Distance"
                  value={tracking.distanceKm.toFixed(2)}
                  suffix="km"
                />
                <InfoTile
                  icon={<MapPin className="h-4 w-4" />}
                  label="Latitude"
                  value={tracking.latitude.toFixed(5)}
                  suffix="°"
                />
                <InfoTile
                  icon={<MapPin className="h-4 w-4" />}
                  label="Longitude"
                  value={tracking.longitude.toFixed(5)}
                  suffix="°"
                />
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-border bg-surface text-center">
                <Bus className="h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-base text-muted-foreground">
                  No bus is currently active.
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Live stats will appear here when a trip starts.
                </p>
              </div>
            </section>
          )}

          {/* ── Live Activity ── */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Live Activity
            </p>
            {isActive && tracking ? (
              <div className="mt-3 space-y-2">
                <ActivityRow
                  icon={<Radio className="h-3.5 w-3.5 text-success" />}
                  text={`Bus is moving at ${tracking.speedKmh.toFixed(0)} km/h`}
                  time={lastUpdated}
                />
                <ActivityRow
                  icon={<RouteIcon className="h-3.5 w-3.5 text-primary" />}
                  text={`${tracking.distanceKm.toFixed(2)} km covered so far`}
                  time={lastUpdated}
                />
                {tracking.startedAt && (
                  <ActivityRow
                    icon={<Clock className="h-3.5 w-3.5 text-accent" />}
                    text={`Trip started at ${new Date(tracking.startedAt).toLocaleTimeString()}`}
                    time=""
                  />
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                0 updates for now.
              </p>
            )}
          </section>

          {/* ── Notifications ── */}
          <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Notifications
            </p>
            {notificationsLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading notifications...</p>
            ) : notifications.length > 0 ? (
              <div className="mt-3 space-y-2.5">
                {notifications.map((note) => (
                  <div key={note.id} className="rounded-xl border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">{note.title}</p>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        {note.targetRole}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{note.message}</p>
                  </div>
                ))}
              </div>
            ) : isActive ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5">
                <Radio className="mt-0.5 h-3.5 w-3.5 text-success shrink-0" />
                <p className="text-xs font-medium text-success">
                  Driver is actively sharing their live location.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                0 unread notifications.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Info tile for live stats                                          */
/* ------------------------------------------------------------------ */
function InfoTile({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="font-display text-lg font-bold tabular-nums">
          {value}
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          {suffix}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity row                                                      */
/* ------------------------------------------------------------------ */
function ActivityRow({
  icon,
  text,
  time,
}: {
  icon: React.ReactNode;
  text: string;
  time: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2">
      {icon}
      <span className="flex-1 text-xs font-medium text-foreground">{text}</span>
      {time && (
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">
          {time}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Relative time helper                                              */
/* ------------------------------------------------------------------ */
function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
