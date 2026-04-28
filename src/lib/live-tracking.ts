import { supabase } from "@/lib/supabase";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";

const LOCAL_TRACKING_KEY = "transporter.liveTracking.v1";
const TRACKING_EVENT = "transporter-live-tracking-updated";
const LIVE_TRACKING_TABLE_FLAG = "transporter.supabase.driverLiveTracking.available";
const OPERATION_EVENTS_TABLE_FLAG = "transporter.supabase.operationEvents.available";

export interface LiveTrackingRecord {
  latitude: number;
  longitude: number;
  speedKmh: number;
  distanceKm: number;
  isActive: boolean;
  startedAt: string | null;
  updatedAt: string;
  driverUserId: string | null;
}

export interface SaveDriverTrackingInput {
  latitude: number;
  longitude: number;
  speedKmh: number;
  distanceKm: number;
  isActive: boolean;
  startedAt?: string | null;
}

interface RemoteTrackingRow {
  user_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
  distance_km: number;
  is_active: boolean;
  started_at: string | null;
  updated_at: string;
}

interface DriverProfileRow {
  name: string;
}

interface AssignedBusRow {
  id: string;
  bus_number: string;
}

interface TripStartRow {
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface TripStartLocation {
  latitude: number;
  longitude: number;
  createdAt: string;
}

let liveTrackingTableAvailable = true;
let operationEventsTableAvailable = true;

function readAvailabilityFlag(key: string): boolean {
  if (typeof window === "undefined") return true;

  const stored = window.localStorage.getItem(key);
  if (stored === null) return true;

  return stored !== "false";
}

function writeAvailabilityFlag(key: string, available: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, available ? "true" : "false");
}

liveTrackingTableAvailable = readAvailabilityFlag(LIVE_TRACKING_TABLE_FLAG);
operationEventsTableAvailable = readAvailabilityFlag(OPERATION_EVENTS_TABLE_FLAG);

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseRecord(value: unknown): LiveTrackingRecord | null {
  if (!value || typeof value !== "object") return null;

  const maybe = value as Partial<LiveTrackingRecord>;
  if (
    !isValidNumber(maybe.latitude) ||
    !isValidNumber(maybe.longitude) ||
    !isValidNumber(maybe.speedKmh) ||
    !isValidNumber(maybe.distanceKm) ||
    typeof maybe.isActive !== "boolean" ||
    typeof maybe.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    latitude: maybe.latitude,
    longitude: maybe.longitude,
    speedKmh: maybe.speedKmh,
    distanceKm: maybe.distanceKm,
    isActive: maybe.isActive,
    startedAt: typeof maybe.startedAt === "string" ? maybe.startedAt : null,
    updatedAt: maybe.updatedAt,
    driverUserId: typeof maybe.driverUserId === "string" ? maybe.driverUserId : null,
  };
}

function toRecordFromRemote(row: RemoteTrackingRow): LiveTrackingRecord {
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    speedKmh: row.speed_kmh,
    distanceKm: row.distance_km,
    isActive: row.is_active,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    driverUserId: row.user_id,
  };
}

function emitTrackingUpdate(record: LiveTrackingRecord | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<LiveTrackingRecord | null>(TRACKING_EVENT, { detail: record }),
  );
}

function cacheTracking(record: LiveTrackingRecord | null) {
  if (typeof window === "undefined") return;

  if (!record) {
    window.localStorage.removeItem(LOCAL_TRACKING_KEY);
    emitTrackingUpdate(null);
    return;
  }

  window.localStorage.setItem(LOCAL_TRACKING_KEY, JSON.stringify(record));
  emitTrackingUpdate(record);
}

async function getSessionUserId(): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  } catch {
    return null;
  }
}

async function logOperationEvent(
  eventType: "trip_started" | "trip_ended",
  record: LiveTrackingRecord,
  userId: string,
): Promise<void> {
  if (!operationEventsTableAvailable) return;

  let driverName = "Driver";
  let busId: string | null = null;
  let busNumber: string | null = null;

  const [{ data: driverData }, { data: assignedBuses }] = await Promise.all([
    supabase.from("drivers").select("name").eq("user_id", userId).maybeSingle<DriverProfileRow>(),
    supabase
      .from("buses")
      .select("id, bus_number")
      .eq("assigned_driver_user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1),
  ]);

  if (driverData?.name) {
    driverName = driverData.name;
  }

  const assignedBus = ((assignedBuses ?? []) as AssignedBusRow[])[0];
  if (assignedBus) {
    busId = assignedBus.id;
    busNumber = assignedBus.bus_number;
  }

  const eventPayload = {
    event_type: eventType,
    driver_user_id: userId,
    driver_name: driverName,
    bus_id: busId,
    bus_number: busNumber,
    distance_km: record.distanceKm,
    speed_kmh: record.speedKmh,
    latitude: record.latitude,
    longitude: record.longitude,
  };

  const { error } = await supabase.from("operation_events").insert(eventPayload);

  if (!error) {
    return;
  }

  if (isMissingSupabaseTableError(error)) {
    operationEventsTableAvailable = false;
    writeAvailabilityFlag(OPERATION_EVENTS_TABLE_FLAG, false);
    return;
  }

  // Backward-compatible insert path when latitude/longitude columns are not present yet.
  const { error: fallbackError } = await supabase.from("operation_events").insert({
    event_type: eventType,
    driver_user_id: userId,
    driver_name: driverName,
    bus_id: busId,
    bus_number: busNumber,
    distance_km: record.distanceKm,
    speed_kmh: record.speedKmh,
  });

  if (fallbackError) {
    if (isMissingSupabaseTableError(fallbackError)) {
      operationEventsTableAvailable = false;
      writeAvailabilityFlag(OPERATION_EVENTS_TABLE_FLAG, false);
      return;
    }
    console.warn("Failed to log operation event:", fallbackError.message);
  }
}

function isNewerThan(a: string, b: string): boolean {
  return new Date(a).getTime() > new Date(b).getTime();
}

export function getCachedDriverTracking(): LiveTrackingRecord | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(LOCAL_TRACKING_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parseRecord(parsed);
  } catch {
    return null;
  }
}

export async function getLatestDriverTracking(): Promise<LiveTrackingRecord | null> {
  const cached = getCachedDriverTracking();
  if (!cached) return null;

  return cached;
}

export async function getDriverTripStartLocation(
  driverUserId: string,
): Promise<TripStartLocation | null> {
  if (!operationEventsTableAvailable) return null;

  try {
    const { data, error } = await supabase
      .from("operation_events")
      .select("latitude, longitude, created_at")
      .eq("event_type", "trip_started")
      .eq("driver_user_id", driverUserId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<TripStartRow>();

    if (error || !data) {
      if (isMissingSupabaseTableError(error)) {
        operationEventsTableAvailable = false;
      }
      return null;
    }
    if (!isValidNumber(data.latitude) || !isValidNumber(data.longitude)) return null;

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

export async function saveDriverTracking(input: SaveDriverTrackingInput): Promise<void> {
  const cached = getCachedDriverTracking();
  const userId = await getSessionUserId();
  const nowIso = new Date().toISOString();
  const becameActive = input.isActive && cached?.isActive !== true;
  const becameInactive = !input.isActive && cached?.isActive === true;

  const nextRecord: LiveTrackingRecord = {
    latitude: input.latitude,
    longitude: input.longitude,
    speedKmh: input.speedKmh,
    distanceKm: input.distanceKm,
    isActive: input.isActive,
    startedAt: input.startedAt ?? cached?.startedAt ?? null,
    updatedAt: nowIso,
    driverUserId: userId ?? cached?.driverUserId ?? null,
  };

  cacheTracking(nextRecord);

  if (!userId) return;

  const { error } = await supabase.from("driver_live_tracking").upsert(
    {
      user_id: userId,
      latitude: nextRecord.latitude,
      longitude: nextRecord.longitude,
      speed_kmh: nextRecord.speedKmh,
      distance_km: nextRecord.distanceKm,
      is_active: nextRecord.isActive,
      started_at: nextRecord.startedAt,
      updated_at: nextRecord.updatedAt,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    if (isMissingSupabaseTableError(error)) {
      liveTrackingTableAvailable = false;
      writeAvailabilityFlag(LIVE_TRACKING_TABLE_FLAG, false);
      return;
    }
    console.warn("Failed to sync driver tracking to Supabase:", error.message);
  }

  if (becameActive) {
    await logOperationEvent("trip_started", nextRecord, userId);
  }

  if (becameInactive) {
    await logOperationEvent("trip_ended", nextRecord, userId);
  }
}

export async function stopDriverTracking(distanceKm: number, speedKmh: number): Promise<void> {
  const cached = getCachedDriverTracking();
  if (!cached) return;

  await saveDriverTracking({
    latitude: cached.latitude,
    longitude: cached.longitude,
    speedKmh,
    distanceKm,
    isActive: false,
    startedAt: cached.startedAt,
  });
}

export function subscribeToDriverTracking(
  onChange: (record: LiveTrackingRecord | null) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const onCustom = (event: Event) => {
    const custom = event as CustomEvent<LiveTrackingRecord | null>;
    onChange(custom.detail ?? null);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== LOCAL_TRACKING_KEY) return;

    if (!event.newValue) {
      onChange(null);
      return;
    }

    try {
      const parsed = JSON.parse(event.newValue) as unknown;
      onChange(parseRecord(parsed));
    } catch {
      onChange(null);
    }
  };

  window.addEventListener(TRACKING_EVENT, onCustom as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(TRACKING_EVENT, onCustom as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
