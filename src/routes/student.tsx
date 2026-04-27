import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bus, Gauge, Route as RouteIcon, MapPin, Clock, Radio } from "lucide-react";
import { getHomeRouteForRole, getSession } from "@/lib/auth";
import { useLiveTracking } from "../hooks/use-live-tracking";
import { useRoleNotifications } from "../hooks/use-role-notifications";
import { useStudentLocation } from "../hooks/use-student-location";
import { clearStudentRoute, saveStudentRoute, type StudentRouteRecord } from "../lib/student-route";
import { getDriverTripStartLocation } from "../lib/live-tracking";
import { haversineKm } from "@/lib/utils";

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
        content: "View your assigned bus details, live stop activity, and notifications.",
      },
    ],
  }),
  component: StudentDashboard,
});

function StudentDashboard() {
  const [studentId, setStudentId] = useState("student");
  const { tracking, loading } = useLiveTracking();
  const { notifications, loading: notificationsLoading } = useRoleNotifications("student");
  const { location: studentLocation, error: studentLocationError } = useStudentLocation({
    watch: false,
  });

  const sLat = studentLocation?.latitude;
  const sLng = studentLocation?.longitude;
  const [routeSummary, setRouteSummary] = useState<StudentRouteRecord | null>(null);
  const [driverStartLocation, setDriverStartLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const lastFetchRef = useRef<{
    timestamp: number;
    driverLat: number;
    driverLng: number;
    studentLat: number;
    studentLng: number;
  } | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    setStudentId(session.email.split("@")[0] || "student");
  }, []);

  const isActive = tracking?.isActive ?? false;

  const routeEtaText = useMemo(() => {
    if (!routeSummary) return null;
    const eta = Math.max(1, Math.round(routeSummary.etaMinutes));
    return `${eta} min`;
  }, [routeSummary]);

  /* format ISO timestamp to relative string */
  const lastUpdated = tracking?.updatedAt ? formatRelativeTime(tracking.updatedAt) : null;

  useEffect(() => {
    const driverUserId = tracking?.driverUserId;

    if (!tracking?.isActive || !driverUserId) {
      setDriverStartLocation(null);
      return;
    }

    const activeDriverUserId = driverUserId;

    const key = `pulseride.driverStart.${activeDriverUserId}.${tracking.startedAt ?? "active"}`;
    const cached = window.localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { lat?: number; lng?: number };
        if (typeof parsed.lat === "number" && typeof parsed.lng === "number") {
          setDriverStartLocation({ lat: parsed.lat, lng: parsed.lng });
        }
      } catch {
        // Ignore invalid cache and continue with remote lookup.
      }
    }

    let isMounted = true;

    const loadStartLocation = async () => {
      const remoteStart = await getDriverTripStartLocation(activeDriverUserId);
      if (!isMounted) return;

      const next = remoteStart
        ? { lat: remoteStart.latitude, lng: remoteStart.longitude }
        : { lat: tracking.latitude, lng: tracking.longitude };

      setDriverStartLocation(next);
      window.localStorage.setItem(key, JSON.stringify(next));
    };

    void loadStartLocation();

    return () => {
      isMounted = false;
    };
  }, [
    tracking?.driverUserId,
    tracking?.isActive,
    tracking?.startedAt,
    tracking?.latitude,
    tracking?.longitude,
  ]);

  useEffect(() => {
    if (!tracking?.isActive || sLat === undefined || sLng === undefined) {
      setRouteSummary(null);
      clearStudentRoute();
      return;
    }

    const previous = lastFetchRef.current;
    const now = Date.now();
    const movedDriverMeters = previous
      ? haversineKm(previous.driverLat, previous.driverLng, tracking.latitude, tracking.longitude) *
        1000
      : Number.POSITIVE_INFINITY;
    const movedStudentMeters = previous
      ? haversineKm(previous.studentLat, previous.studentLng, sLat!, sLng!) * 1000
      : Number.POSITIVE_INFINITY;
    const shouldRefetch =
      !previous ||
      now - previous.timestamp > 5000 ||
      movedDriverMeters > 8 ||
      movedStudentMeters > 8;

    if (!shouldRefetch) return;

    lastFetchRef.current = {
      timestamp: now,
      driverLat: tracking.latitude,
      driverLng: tracking.longitude,
      studentLat: sLat!,
      studentLng: sLng!,
    };

    const controller = new AbortController();
    let isMounted = true;

    const saveFallbackRoute = () => {
      const linearDistanceKm = haversineKm(tracking.latitude, tracking.longitude, sLat!, sLng!);
      const assumedSpeed = Math.max(tracking.speedKmh, 18);
      const durationMin = (linearDistanceKm / assumedSpeed) * 60;

      const fallback: StudentRouteRecord = {
        driverLatitude: tracking.latitude,
        driverLongitude: tracking.longitude,
        studentLatitude: sLat!,
        studentLongitude: sLng!,
        driverStartLatitude: driverStartLocation?.lat ?? null,
        driverStartLongitude: driverStartLocation?.lng ?? null,
        distanceKm: linearDistanceKm,
        durationMin,
        etaMinutes: Math.max(1, durationMin),
        path: [
          [tracking.latitude, tracking.longitude],
          [sLat!, sLng!],
        ],
        updatedAt: new Date().toISOString(),
      };

      if (!isMounted) return;
      setRouteSummary(fallback);
      saveStudentRoute(fallback);
    };

    const fetchRoute = async () => {
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${tracking.longitude},${tracking.latitude};${sLng},${sLat}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          saveFallbackRoute();
          return;
        }

        const data = (await response.json()) as {
          routes?: Array<{
            distance: number;
            duration: number;
            geometry: { coordinates: Array<[number, number]> };
          }>;
        };

        const route = data.routes?.[0];
        if (!route) {
          saveFallbackRoute();
          return;
        }

        const next: StudentRouteRecord = {
          driverLatitude: tracking.latitude,
          driverLongitude: tracking.longitude,
          studentLatitude: sLat!,
          studentLongitude: sLng!,
          driverStartLatitude: driverStartLocation?.lat ?? null,
          driverStartLongitude: driverStartLocation?.lng ?? null,
          distanceKm: route.distance / 1000,
          durationMin: route.duration / 60,
          etaMinutes: Math.max(1, route.duration / 60),
          path: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
          updatedAt: new Date().toISOString(),
        };

        if (!isMounted) return;
        setRouteSummary(next);
        saveStudentRoute(next);
      } catch {
        if (controller.signal.aborted) return;
        saveFallbackRoute();
      }
    };

    void fetchRoute();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [
    tracking?.isActive,
    tracking?.latitude,
    tracking?.longitude,
    tracking?.speedKmh,
    sLat,
    sLng,
    driverStartLocation?.lat,
    driverStartLocation?.lng,
  ]);

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

                  {isActive && studentLocation && routeSummary ? (
                    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <p>
                        Driver start:{" "}
                        {formatLatLng(
                          routeSummary.driverStartLatitude ?? tracking?.latitude ?? 0,
                          routeSummary.driverStartLongitude ?? tracking?.longitude ?? 0,
                        )}
                      </p>
                      <p>
                        Your location:{" "}
                        {formatLatLng(studentLocation.latitude, studentLocation.longitude)}
                      </p>
                      <p>
                        Route to you: {routeSummary.distanceKm.toFixed(2)} km · ETA {routeEtaText}
                      </p>
                    </div>
                  ) : isActive && studentLocationError ? (
                    <p className="mt-2 text-xs text-warning">
                      Enable location access to get precise route ETA.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* ── Live Stats ── */}
          {loading ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex min-h-20 items-center justify-center">
                <p className="text-sm text-muted-foreground animate-pulse">Loading live data…</p>
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
                <p className="mt-2 text-base text-muted-foreground">No bus is currently active.</p>
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
              <p className="mt-3 text-sm text-muted-foreground">0 updates for now.</p>
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
              <p className="mt-3 text-sm text-muted-foreground">0 unread notifications.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function formatLatLng(lat: number, lng: number): string {
  return `${lat.toFixed(5)}°, ${lng.toFixed(5)}°`;
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
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 flex items-baseline gap-0.5">
        <span className="font-display text-lg font-bold tabular-nums">{value}</span>
        <span className="text-xs font-medium text-muted-foreground">{suffix}</span>
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
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">{time}</span>
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
