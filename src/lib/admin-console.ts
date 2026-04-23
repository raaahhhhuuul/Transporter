import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type BusStatus = "active" | "inactive" | "maintenance";
export type OperationEventType = "trip_started" | "trip_ended";
export type NotificationTargetRole = "all" | "student" | "driver";

export interface AdminBus {
  id: string;
  busNumber: string;
  routeName: string;
  plate: string;
  status: BusStatus;
  assignedDriverUserId: string | null;
  assignedDriverName: string | null;
  assignedDriverLoginId: string | null;
  updatedAt: string;
}

export interface ApprovedDriver {
  userId: string;
  name: string;
  loginId: string;
  phoneNumber: string;
  createdAt: string;
}

export interface OperationQueueItem {
  id: string;
  eventType: OperationEventType;
  driverUserId: string;
  driverName: string;
  busId: string | null;
  busNumber: string | null;
  distanceKm: number;
  speedKmh: number;
  createdAt: string;
}

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  targetRole: NotificationTargetRole;
  createdAt: string;
}

interface BusRow {
  id: string;
  bus_number: string;
  route_name: string;
  plate: string;
  status: BusStatus;
  assigned_driver_user_id: string | null;
  updated_at: string;
}

interface DriverRow {
  user_id: string;
  name: string;
  login_id: string;
  phone_number: string;
  created_at: string;
}

interface OperationEventRow {
  id: string;
  event_type: OperationEventType;
  driver_user_id: string;
  driver_name: string;
  bus_id: string | null;
  bus_number: string | null;
  distance_km: number;
  speed_kmh: number;
  created_at: string;
}

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  target_role: NotificationTargetRole;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function getAdminSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !serviceRoleKey) {
    throw new Error("Supabase admin environment is not configured.");
  }

  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const getBusesServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const adminSupabase = getAdminSupabaseClient();

  const { data: buses, error: busError } = await adminSupabase
    .from("buses")
    .select("id, bus_number, route_name, plate, status, assigned_driver_user_id, updated_at")
    .order("bus_number", { ascending: true });

  if (busError) throw new Error(busError.message);

  const busRows = (buses ?? []) as BusRow[];
  const assignedDriverIds = Array.from(
    new Set(
      busRows
        .map((bus) => bus.assigned_driver_user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  let driverMap = new Map<string, Pick<DriverRow, "name" | "login_id">>();

  if (assignedDriverIds.length > 0) {
    const { data: drivers, error: driversError } = await adminSupabase
      .from("drivers")
      .select("user_id, name, login_id")
      .in("user_id", assignedDriverIds);

    if (driversError) throw new Error(driversError.message);

    driverMap = new Map(
      ((drivers ?? []) as Array<Pick<DriverRow, "user_id" | "name" | "login_id">>).map((driver) => [
        driver.user_id,
        { name: driver.name, login_id: driver.login_id },
      ]),
    );
  }

  return busRows.map((bus) => {
    const assignedDriver = bus.assigned_driver_user_id
      ? driverMap.get(bus.assigned_driver_user_id)
      : null;

    return {
      id: bus.id,
      busNumber: bus.bus_number,
      routeName: bus.route_name,
      plate: bus.plate,
      status: bus.status,
      assignedDriverUserId: bus.assigned_driver_user_id,
      assignedDriverName: assignedDriver?.name ?? null,
      assignedDriverLoginId: assignedDriver?.login_id ?? null,
      updatedAt: bus.updated_at,
    } satisfies AdminBus;
  });
});

const getApprovedDriversServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const adminSupabase = getAdminSupabaseClient();

  const { data, error } = await adminSupabase
    .from("drivers")
    .select("user_id, name, login_id, phone_number, created_at")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return ((data ?? []) as DriverRow[]).map((driver) => ({
    userId: driver.user_id,
    name: driver.name,
    loginId: driver.login_id,
    phoneNumber: driver.phone_number,
    createdAt: driver.created_at,
  } satisfies ApprovedDriver));
});

const assignDriverToBusServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { busId: string; driverUserId: string | null }) => data)
  .handler(async ({ data }) => {
    const adminSupabase = getAdminSupabaseClient();

    if (!data.busId) throw new Error("Bus ID is required.");

    const nowIso = new Date().toISOString();

    if (data.driverUserId) {
      const { error: clearExistingError } = await adminSupabase
        .from("buses")
        .update({ assigned_driver_user_id: null, updated_at: nowIso })
        .eq("assigned_driver_user_id", data.driverUserId)
        .neq("id", data.busId);

      if (clearExistingError) throw new Error(clearExistingError.message);
    }

    const { error } = await adminSupabase
      .from("buses")
      .update({
        assigned_driver_user_id: data.driverUserId,
        updated_at: nowIso,
      })
      .eq("id", data.busId);

    if (error) throw new Error(error.message);

    return { ok: true };
  });

const getOperationQueueServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const adminSupabase = getAdminSupabaseClient();

  const { data, error } = await adminSupabase
    .from("operation_events")
    .select("id, event_type, driver_user_id, driver_name, bus_id, bus_number, distance_km, speed_kmh, created_at")
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  return ((data ?? []) as OperationEventRow[]).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    driverUserId: row.driver_user_id,
    driverName: row.driver_name,
    busId: row.bus_id,
    busNumber: row.bus_number,
    distanceKm: row.distance_km,
    speedKmh: row.speed_kmh,
    createdAt: row.created_at,
  } satisfies OperationQueueItem));
});

const getAdminNotificationsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const adminSupabase = getAdminSupabaseClient();

  const { data, error } = await adminSupabase
    .from("admin_notifications")
    .select("id, title, message, target_role, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);

  return ((data ?? []) as NotificationRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    targetRole: row.target_role,
    createdAt: row.created_at,
  } satisfies AdminNotification));
});

const sendAdminNotificationServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { title: string; message: string; targetRole: NotificationTargetRole }) => data)
  .handler(async ({ data }) => {
    const adminSupabase = getAdminSupabaseClient();

    const title = data.title.trim();
    const message = data.message.trim();

    if (!title || !message) {
      throw new Error("Title and message are required.");
    }

    const { error } = await adminSupabase.from("admin_notifications").insert({
      title,
      message,
      target_role: data.targetRole,
    });

    if (error) throw new Error(error.message);

    return { ok: true };
  });

export async function getBuses() {
  return getBusesServerFn();
}

export async function getApprovedDrivers() {
  return getApprovedDriversServerFn();
}

export async function assignDriverToBus(busId: string, driverUserId: string | null) {
  return assignDriverToBusServerFn({ data: { busId, driverUserId } });
}

export async function getOperationQueue() {
  return getOperationQueueServerFn();
}

export async function getAdminNotifications() {
  return getAdminNotificationsServerFn();
}

export async function sendAdminNotification(input: {
  title: string;
  message: string;
  targetRole: NotificationTargetRole;
}) {
  return sendAdminNotificationServerFn({ data: input });
}
