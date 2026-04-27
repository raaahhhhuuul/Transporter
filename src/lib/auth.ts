import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { getServerSupabaseConfig } from "@/lib/server-env";

export type UserRole = "student" | "driver" | "admin";
export type RegistrableRole = "student" | "driver";

export interface AuthSession {
  role: UserRole;
  email: string;
  loggedInAt: string;
  token?: string;
}

export interface RegisteredUser {
  id: string;
  name: string;
  loginId: string;
  phoneNumber: string;
  role: RegistrableRole;
  createdAt: string;
}

export interface PendingLoginApproval {
  requestId: string;
  requestedAt: string;
  userId: string;
  name: string;
  loginId: string;
  phoneNumber: string;
  role: RegistrableRole;
}

interface SignUpInput {
  name: string;
  loginId: string;
  phoneNumber: string;
  role: RegistrableRole;
  password: string;
}

interface AuthResult {
  session: AuthSession;
  homeRoute: "/student" | "/driver" | "/admin";
}

interface RegistrationRow {
  id: string;
  user_id: string;
  login_id: string;
  name: string;
  phone_number: string;
  role: RegistrableRole;
  status: "pending" | "approved";
  created_at: string;
  approved_at: string | null;
}

interface ApprovedStudentRow {
  user_id: string;
  registration_id: string;
  login_id: string;
  name: string;
  phone_number: string;
  created_at: string;
}

interface ApprovedDriverRow {
  user_id: string;
  registration_id: string;
  login_id: string;
  name: string;
  phone_number: string;
  created_at: string;
}

interface LoginApprovalRow {
  id: string;
  registration_id: string;
  user_id: string;
  login_id: string;
  role: RegistrableRole;
  status: "pending" | "approved";
  requested_at: string;
  approved_at: string | null;
  registrations?: {
    name: string;
    phone_number: string;
  } | Array<{
    name: string;
    phone_number: string;
  }>;
}

const SESSION_KEY = "pulseride.session.v1";
const ADMIN_LOGIN_ID = "transporter@admin.com";
const roleHomePath: Record<UserRole, "/student" | "/driver" | "/admin"> = {
  student: "/student",
  driver: "/driver",
  admin: "/admin",
};

function isRole(value: unknown): value is UserRole {
  return value === "student" || value === "driver" || value === "admin";
}

function isRegistrableRole(value: unknown): value is RegistrableRole {
  return value === "student" || value === "driver";
}

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

function toDriverAuthEmail(loginId: string) {
  if (loginId.includes("@")) return loginId;

  const sanitized = loginId.replace(/[^a-z0-9._-]/g, "");
  const fallback = sanitized.length > 0 ? sanitized : `driver${Date.now()}`;
  return `${fallback}@driver.local`;
}

function toBase64Url(text: string) {
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function createMockJwt(payload: Record<string, unknown>) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = toBase64Url("pulseride-demo-signature");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function getAdminSupabaseClient() {
  const { supabaseUrl, serviceRoleKey } = getServerSupabaseConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing server Supabase env. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const registerUserServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: SignUpInput) => data)
  .handler(async ({ data }) => {
    const name = data.name.trim();
    const loginId = normalizeLoginId(data.loginId);
    const phoneNumber = data.phoneNumber.trim();
    const password = data.password.trim();

    if (!name || !loginId || !phoneNumber || !password) {
      throw new Error("All fields are required");
    }

    if (data.role === "student" && !loginId.endsWith("@srmist.edu.in")) {
      throw new Error("Student signup requires @srmist.edu.in email");
    }

    if (!/^\+?[0-9]{10,15}$/.test(phoneNumber)) {
      throw new Error("Phone number must be between 10 and 15 digits");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    const authEmail = data.role === "driver" ? toDriverAuthEmail(loginId) : loginId;
    const adminSupabase = getAdminSupabaseClient();

    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        role: data.role,
        login_id: loginId,
        name,
        phone_number: phoneNumber,
      },
    });

    if (authError) {
      throw new Error(authError.message);
    }

    const userId = authData.user?.id;

    if (!userId) {
      throw new Error("Unable to create account. Please try again.");
    }

    const { error: registrationError } = await adminSupabase.from("registrations").upsert(
      {
        user_id: userId,
        login_id: loginId,
        name,
        phone_number: phoneNumber,
        role: data.role,
        status: "pending",
      },
      { onConflict: "user_id" },
    );

    if (registrationError) {
      throw new Error(registrationError.message);
    }

    return {
      id: userId,
      name,
      loginId,
      phoneNumber,
      role: data.role,
      createdAt: new Date().toISOString(),
    } satisfies RegisteredUser;
  });

const getPendingApprovalsServerFn = createServerFn({ method: "GET" }).handler(async () => {
  const adminSupabase = getAdminSupabaseClient();

  const { data, error } = await adminSupabase
    .from("login_approvals")
    .select("id, requested_at, user_id, login_id, role, registrations!inner(name, phone_number)")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => {
    const registration = Array.isArray(item.registrations) ? item.registrations[0] : item.registrations;

    return {
      requestId: item.id as string,
      requestedAt: item.requested_at as string,
      userId: item.user_id as string,
      loginId: item.login_id as string,
      role: item.role as RegistrableRole,
      name: String(registration?.name ?? "Unknown"),
      phoneNumber: String(registration?.phone_number ?? "N/A"),
    } satisfies PendingLoginApproval;
  });
});

const approveUserServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { requestId: string }) => data)
  .handler(async ({ data }) => {
    const adminSupabase = getAdminSupabaseClient();

    const { data: request, error: requestError } = await adminSupabase
      .from("login_approvals")
      .select("id, registration_id, user_id, login_id, role, status")
      .eq("id", data.requestId)
      .maybeSingle();

    if (requestError) {
      throw new Error(requestError.message);
    }

    if (!request) {
      return null;
    }

    const { data: registration, error: registrationError } = await adminSupabase
      .from("registrations")
      .select("id, user_id, login_id, name, phone_number, role, status, created_at, approved_at")
      .eq("id", request.registration_id)
      .maybeSingle<RegistrationRow>();

    if (registrationError) {
      throw new Error(registrationError.message);
    }

    if (!registration) {
      throw new Error("Registration record not found.");
    }

    const now = new Date().toISOString();

    const { error: approvalError } = await adminSupabase
      .from("login_approvals")
      .update({
        status: "approved",
        approved_at: now,
      })
      .eq("id", data.requestId);

    if (approvalError) {
      throw new Error(approvalError.message);
    }

    const { error: registrationUpdateError } = await adminSupabase
      .from("registrations")
      .update({
        status: "approved",
        approved_at: now,
      })
      .eq("id", registration.id);

    if (registrationUpdateError) {
      throw new Error(registrationUpdateError.message);
    }

    const tableName = registration.role === "student" ? "students" : "drivers";
    const approvedRecord = {
      user_id: registration.user_id,
      registration_id: registration.id,
      login_id: registration.login_id,
      name: registration.name,
      phone_number: registration.phone_number,
    };

    const { error: approvedInsertError } = await adminSupabase.from(tableName).upsert(approvedRecord, {
      onConflict: "user_id",
    });

    if (approvedInsertError) {
      throw new Error(approvedInsertError.message);
    }

    return request;
  });

export function getHomeRouteForRole(role: UserRole): "/student" | "/driver" | "/admin" {
  return roleHomePath[role];
}

export function getSession(): AuthSession | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (!isRole(parsed.role)) return null;
    if (typeof parsed.email !== "string" || parsed.email.trim().length === 0) return null;
    if (typeof parsed.loggedInAt !== "string") return null;
    if (parsed.token != null && typeof parsed.token !== "string") return null;

    return {
      role: parsed.role,
      email: parsed.email,
      loggedInAt: parsed.loggedInAt,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

function setSession(role: UserRole, email: string, token?: string): AuthSession {
  const session: AuthSession = {
    role,
    email: email.trim().toLowerCase(),
    loggedInAt: new Date().toISOString(),
    token,
  };

  if (isBrowser()) {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session;
}

export async function clearSession() {
  if (isBrowser()) {
    window.localStorage.removeItem(SESSION_KEY);
  }
  await supabase.auth.signOut();
}

async function getRegistrationByUserId(userId: string) {
  const { data, error } = await supabase
    .from("registrations")
    .select("id, user_id, login_id, name, phone_number, role, status, created_at, approved_at")
    .eq("user_id", userId)
    .maybeSingle<RegistrationRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getApprovedRoleAccount(userId: string) {
  const [{ data: student }, { data: driver }] = await Promise.all([
    supabase.from("students").select("user_id, registration_id, login_id, name, phone_number, created_at").eq("user_id", userId).maybeSingle<ApprovedStudentRow>(),
    supabase.from("drivers").select("user_id, registration_id, login_id, name, phone_number, created_at").eq("user_id", userId).maybeSingle<ApprovedDriverRow>(),
  ]);

  if (student) {
    return {
      role: "student" as const,
      loginId: student.login_id,
    };
  }

  if (driver) {
    return {
      role: "driver" as const,
      loginId: driver.login_id,
    };
  }

  return null;
}

export async function signUpUser(input: SignUpInput) {
  return registerUserServerFn({ data: input });
}

async function createPendingLoginApproval(registration: RegistrationRow) {
  const { data: existing, error: existingError } = await supabase
    .from("login_approvals")
    .select("id")
    .eq("user_id", registration.user_id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) return;

  const { error: insertError } = await supabase.from("login_approvals").insert({
    registration_id: registration.id,
    user_id: registration.user_id,
    login_id: registration.login_id,
    role: registration.role,
    status: "pending",
  });

  if (insertError) {
    throw new Error(insertError.message);
  }
}

export async function signIn(loginId: string, password: string): Promise<AuthResult> {
  const normalizedLoginId = normalizeLoginId(loginId);
  const normalizedPassword = password.trim();

  if (!normalizedLoginId || !normalizedPassword) {
    throw new Error("Login ID and password are required");
  }

  if (normalizedLoginId === ADMIN_LOGIN_ID && normalizedPassword === "admin123") {
    const token = createMockJwt({
      sub: normalizedLoginId,
      role: "admin",
      iss: "PulseRide",
      aud: "admin-portal",
      iat: Math.floor(Date.now() / 1000),
    });

    const session = setSession("admin", normalizedLoginId, token);
    return {
      session,
      homeRoute: getHomeRouteForRole("admin"),
    };
  }

  const authEmail = toDriverAuthEmail(normalizedLoginId);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password: normalizedPassword,
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Invalid login credentials");
  }

  const approvedAccount = await getApprovedRoleAccount(data.user.id);
  if (approvedAccount) {
    const session = setSession(approvedAccount.role, approvedAccount.loginId, data.session?.access_token);
    return {
      session,
      homeRoute: getHomeRouteForRole(approvedAccount.role),
    };
  }

  const registration = await getRegistrationByUserId(data.user.id);
  if (!registration) {
    await supabase.auth.signOut();
    throw new Error("Profile not found. Please contact admin.");
  }

  await createPendingLoginApproval(registration);
  await supabase.auth.signOut();
  throw new Error("Login approval requested. Please wait for admin approval.");
}

export async function getPendingApprovals(): Promise<PendingLoginApproval[]> {
  return getPendingApprovalsServerFn();
}

export async function approveUser(requestId: string) {
  return approveUserServerFn({ data: { requestId } });
}
