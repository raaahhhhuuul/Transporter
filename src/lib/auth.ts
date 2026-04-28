import { supabase } from "@/lib/supabase";
import { isMissingSupabaseTableError } from "@/lib/supabase-errors";

export type UserRole = "student" | "driver" | "admin";
export type RegistrableRole = "student" | "driver";

export interface AuthSession {
  role: UserRole;
  email: string;
  loginId?: string;
  displayName?: string;
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
  registrations?:
    | {
        name: string;
        phone_number: string;
      }
    | Array<{
        name: string;
        phone_number: string;
      }>;
}

const SESSION_KEY = "pulseride.session.v1";
const ADMIN_LOGIN_ID = "transporter@admin.com";
const ADMIN_LOGIN_ALIASES = new Set([ADMIN_LOGIN_ID, "admin"]);
const roleHomePath: Record<UserRole, "/student" | "/driver" | "/admin"> = {
  student: "/student",
  driver: "/driver",
  admin: "/admin",
};

function isRole(value: unknown): value is UserRole {
  return value === "student" || value === "driver" || value === "admin";
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
    if (parsed.loginId != null && typeof parsed.loginId !== "string") return null;
    if (parsed.displayName != null && typeof parsed.displayName !== "string") return null;
    if (parsed.token != null && typeof parsed.token !== "string") return null;

    return {
      role: parsed.role,
      email: parsed.email,
      loginId: parsed.loginId,
      displayName: parsed.displayName,
      loggedInAt: parsed.loggedInAt,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

function setSession(
  role: UserRole,
  email: string,
  token?: string,
  options?: { loginId?: string; displayName?: string },
): AuthSession {
  const session: AuthSession = {
    role,
    email: email.trim().toLowerCase(),
    loginId: options?.loginId?.trim(),
    displayName: options?.displayName?.trim(),
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

async function registerUser(input: SignUpInput): Promise<RegisteredUser> {
  const name = input.name.trim();
  const loginId = normalizeLoginId(input.loginId);
  const phoneNumber = input.phoneNumber.trim();
  const password = input.password.trim();

  if (!name || !loginId || !phoneNumber || !password) {
    throw new Error("All fields are required");
  }

  if (input.role === "student" && !loginId.endsWith("@srmist.edu.in")) {
    throw new Error("Student signup requires @srmist.edu.in email");
  }

  if (!/^\+?[0-9]{10,15}$/.test(phoneNumber)) {
    throw new Error("Phone number must be between 10 and 15 digits");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const authEmail = input.role === "driver" ? toDriverAuthEmail(loginId) : loginId;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: authEmail,
    password,
    options: {
      data: {
        role: input.role,
        login_id: loginId,
        name,
        phone_number: phoneNumber,
      },
    },
  });

  if (authError) {
    throw new Error(authError.message);
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("Unable to create account. Please try again.");
  }

  const { error: registrationError } = await supabase.from("registrations").upsert(
    {
      user_id: userId,
      login_id: loginId,
      name,
      phone_number: phoneNumber,
      role: input.role,
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
    role: input.role,
    createdAt: new Date().toISOString(),
  } satisfies RegisteredUser;
}

async function getRegistrationByUserId(userId: string) {
  const { data, error } = await supabase
    .from("registrations")
    .select("id, user_id, login_id, name, phone_number, role, status, created_at, approved_at")
    .eq("user_id", userId)
    .maybeSingle<RegistrationRow>();

  if (error) {
    if (isMissingSupabaseTableError(error)) return null;
    throw new Error(error.message);
  }

  return data;
}

async function getApprovedRoleAccount(userId: string) {
  const [{ data: student, error: studentError }, { data: driver, error: driverError }] =
    await Promise.all([
      supabase
        .from("students")
        .select("user_id, registration_id, login_id, name, phone_number, created_at")
        .eq("user_id", userId)
        .maybeSingle<ApprovedStudentRow>(),
      supabase
        .from("drivers")
        .select("user_id, registration_id, login_id, name, phone_number, created_at")
        .eq("user_id", userId)
        .maybeSingle<ApprovedDriverRow>(),
    ]);

  if (studentError && !isMissingSupabaseTableError(studentError)) {
    throw new Error(studentError.message);
  }

  if (driverError && !isMissingSupabaseTableError(driverError)) {
    throw new Error(driverError.message);
  }

  if (student) {
    return {
      role: "student" as const,
      loginId: student.login_id,
      displayName: student.name,
    };
  }

  if (driver) {
    return {
      role: "driver" as const,
      loginId: driver.login_id,
      displayName: driver.name,
    };
  }

  return null;
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
    if (isMissingSupabaseTableError(existingError)) return;
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
    if (isMissingSupabaseTableError(insertError)) return;
    throw new Error(insertError.message);
  }
}

export async function signUpUser(input: SignUpInput) {
  return registerUser(input);
}

export async function signIn(loginId: string, password: string): Promise<AuthResult> {
  const normalizedLoginId = normalizeLoginId(loginId);
  const normalizedPassword = password.trim();

  if (!normalizedLoginId || !normalizedPassword) {
    throw new Error("Login ID and password are required");
  }

  if (ADMIN_LOGIN_ALIASES.has(normalizedLoginId)) {
    if (normalizedPassword !== "admin123") {
      throw new Error("Invalid admin password. Use admin123.");
    }

    const token = createMockJwt({
      sub: normalizedLoginId,
      role: "admin",
      iss: "PulseRide",
      aud: "admin-portal",
      iat: Math.floor(Date.now() / 1000),
    });

    const session = setSession("admin", normalizedLoginId, token, {
      loginId: normalizedLoginId,
      displayName: "Admin",
    });
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
    const session = setSession(
      approvedAccount.role,
      approvedAccount.loginId,
      data.session?.access_token,
      {
        loginId: approvedAccount.loginId,
        displayName: approvedAccount.displayName,
      },
    );
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
  const { data, error } = await supabase
    .from("login_approvals")
    .select("id, requested_at, user_id, login_id, role, registrations!inner(name, phone_number)")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) {
    if (isMissingSupabaseTableError(error)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((item) => {
    const registration = Array.isArray(item.registrations)
      ? item.registrations[0]
      : item.registrations;

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
}

export async function approveUser(requestId: string) {
  const { data: request, error: requestError } = await supabase
    .from("login_approvals")
    .select("id, registration_id, user_id, login_id, role, status")
    .eq("id", requestId)
    .maybeSingle<LoginApprovalRow>();

  if (requestError) {
    if (isMissingSupabaseTableError(requestError)) return null;
    throw new Error(requestError.message);
  }

  if (!request) {
    return null;
  }

  const { data: registration, error: registrationError } = await supabase
    .from("registrations")
    .select("id, user_id, login_id, name, phone_number, role, status, created_at, approved_at")
    .eq("id", request.registration_id)
    .maybeSingle<RegistrationRow>();

  if (registrationError) {
    if (isMissingSupabaseTableError(registrationError)) return null;
    throw new Error(registrationError.message);
  }

  if (!registration) {
    throw new Error("Registration record not found.");
  }

  const now = new Date().toISOString();

  const { error: approvalError } = await supabase
    .from("login_approvals")
    .update({
      status: "approved",
      approved_at: now,
    })
    .eq("id", requestId);

  if (approvalError) {
    if (isMissingSupabaseTableError(approvalError)) return null;
    throw new Error(approvalError.message);
  }

  const { error: registrationUpdateError } = await supabase
    .from("registrations")
    .update({
      status: "approved",
      approved_at: now,
    })
    .eq("id", registration.id);

  if (registrationUpdateError) {
    if (isMissingSupabaseTableError(registrationUpdateError)) return null;
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

  const { error: approvedInsertError } = await supabase.from(tableName).upsert(approvedRecord, {
    onConflict: "user_id",
  });

  if (approvedInsertError) {
    if (isMissingSupabaseTableError(approvedInsertError)) return null;
    throw new Error(approvedInsertError.message);
  }

  return request;
}
