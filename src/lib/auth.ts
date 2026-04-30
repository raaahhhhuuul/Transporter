import { supabase } from "@/lib/supabase";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import {
  isMissingSupabaseTableError,
  isSupabaseWriteAccessError,
  isSupabaseAuthRateLimitError,
} from "@/lib/supabase-errors";

export type UserRole = "student" | "driver" | "admin";
export type RegistrableRole = "student" | "driver";

export interface AuthSession {
  role: UserRole;
  email: string;
  userId?: string;
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
  email?: string;
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

interface LocalApprovedAccount {
  userId: string;
  role: RegistrableRole;
  loginId: string;
  displayName: string;
}

interface LocalCredential {
  userId: string;
  loginId: string;
  password: string;
  role: RegistrableRole;
  displayName: string;
}

const SESSION_KEY = "pulseride.session.v1";
const LOCAL_REGISTRATIONS_KEY = "pulseride.registrations.local.v1";
const LOCAL_LOGIN_APPROVALS_KEY = "pulseride.loginApprovals.local.v1";
const LOCAL_APPROVED_ACCOUNTS_KEY = "pulseride.approvedAccounts.local.v1";
const LOCAL_CREDENTIALS_KEY = "pulseride.credentials.local.v1";
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

function readLocalJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocalJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeLoginId(value: string) {
  return value.trim().toLowerCase();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
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
    if (parsed.userId != null && typeof parsed.userId !== "string") return null;
    if (parsed.loginId != null && typeof parsed.loginId !== "string") return null;
    if (parsed.displayName != null && typeof parsed.displayName !== "string") return null;
    if (parsed.token != null && typeof parsed.token !== "string") return null;

    return {
      role: parsed.role,
      email: parsed.email,
      userId: parsed.userId,
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
  options?: { userId?: string; loginId?: string; displayName?: string },
): AuthSession {
  const session: AuthSession = {
    role,
    email: email.trim().toLowerCase(),
    userId: options?.userId?.trim(),
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

function getLocalRegistrations() {
  return readLocalJson<RegistrationRow[]>(LOCAL_REGISTRATIONS_KEY, []);
}

function saveLocalRegistrations(registrations: RegistrationRow[]) {
  writeLocalJson(LOCAL_REGISTRATIONS_KEY, registrations);
}

function getLocalLoginApprovals() {
  return readLocalJson<LoginApprovalRow[]>(LOCAL_LOGIN_APPROVALS_KEY, []);
}

function saveLocalLoginApprovals(approvals: LoginApprovalRow[]) {
  writeLocalJson(LOCAL_LOGIN_APPROVALS_KEY, approvals);
}

function getLocalApprovedAccounts() {
  return readLocalJson<LocalApprovedAccount[]>(LOCAL_APPROVED_ACCOUNTS_KEY, []);
}

function saveLocalApprovedAccounts(accounts: LocalApprovedAccount[]) {
  writeLocalJson(LOCAL_APPROVED_ACCOUNTS_KEY, accounts);
}

function getLocalCredentials() {
  return readLocalJson<LocalCredential[]>(LOCAL_CREDENTIALS_KEY, []);
}

function saveLocalCredentials(credentials: LocalCredential[]) {
  writeLocalJson(LOCAL_CREDENTIALS_KEY, credentials);
}

function upsertLocalRegistration(registration: RegistrationRow) {
  saveLocalRegistrations([
    registration,
    ...getLocalRegistrations().filter((item) => item.user_id !== registration.user_id),
  ]);
}

function upsertLocalCredential(credential: LocalCredential) {
  saveLocalCredentials([
    credential,
    ...getLocalCredentials().filter((item) => item.loginId !== credential.loginId),
  ]);
}

export function getLocalApprovedDriverAccounts(): RegisteredUser[] {
  const registrations = getLocalRegistrations();
  return getLocalApprovedAccounts()
    .filter((item) => item.role === "driver")
    .map((item) => {
      const registration = registrations.find((entry) => entry.user_id === item.userId);
      return {
        id: item.userId,
        name: item.displayName,
        loginId: item.loginId,
        phoneNumber: registration?.phone_number ?? "N/A",
        role: "driver" as const,
        createdAt: registration?.created_at ?? new Date().toISOString(),
      } satisfies RegisteredUser;
    });
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
  const nowIso = new Date().toISOString();
  const localUserId = `local-user-${crypto.randomUUID()}`;

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
    if (isSupabaseAuthRateLimitError(authError)) {
      const localRegistration: RegistrationRow = {
        id: `local-registration-${localUserId}`,
        user_id: localUserId,
        login_id: loginId,
        name,
        phone_number: phoneNumber,
        role: input.role,
        status: "pending",
        created_at: nowIso,
        approved_at: null,
      };

      upsertLocalRegistration(localRegistration);
      upsertLocalCredential({
        userId: localUserId,
        loginId,
        password,
        role: input.role,
        displayName: name,
      });

      return {
        id: localUserId,
        name,
        loginId,
        phoneNumber,
        role: input.role,
        createdAt: nowIso,
      } satisfies RegisteredUser;
    }
    throw new Error(authError.message);
  }

  const userId = authData.user?.id;
  if (!userId) {
    throw new Error("Unable to create account. Please try again.");
  }

  const registrationRecord: RegistrationRow = {
    id: `local-registration-${userId}`,
    user_id: userId,
    login_id: loginId,
    name,
    phone_number: phoneNumber,
    role: input.role,
    status: "pending",
    created_at: nowIso,
    approved_at: null,
  };

  upsertLocalRegistration(registrationRecord);
  upsertLocalCredential({
    userId,
    loginId,
    password,
    role: input.role,
    displayName: name,
  });
  // If Supabase didn't create a session (for example: email confirmation required),
  // avoid attempting remote writes that will be rejected by RLS/unauthenticated rules.
  const sessionExists = Boolean(authData.session);
  if (!sessionExists) {
    console.log("No auth session after signUp (email confirmation required). Skipping remote registrations upsert.");
    return {
      id: userId,
      name,
      loginId,
      phoneNumber,
      role: input.role,
      createdAt: nowIso,
    } satisfies RegisteredUser;
  }

  const { data: registrationData, error: registrationError } = await supabase
    .from("registrations")
    .upsert(
      {
        user_id: userId,
        login_id: loginId,
        name,
        phone_number: phoneNumber,
        role: input.role,
        status: "pending",
      },
      { onConflict: "user_id" },
    )
    .select("id, user_id, login_id, name, phone_number, role, status, created_at, approved_at")
    .maybeSingle<RegistrationRow>();

  if (
    registrationError &&
    !isMissingSupabaseTableError(registrationError) &&
    !isSupabaseWriteAccessError(registrationError)
  ) {
    throw new Error(registrationError.message);
  }

  if (registrationData) {
    saveLocalRegistrations([
      registrationData,
      ...getLocalRegistrations().filter((item) => item.user_id !== userId),
    ]);
  }

  return {
    id: userId,
    name,
    loginId,
    phoneNumber,
    role: input.role,
    createdAt: nowIso,
  } satisfies RegisteredUser;
}

async function getRegistrationByUserId(userId: string) {
  const { data, error } = await supabase
    .from("registrations")
    .select("id, user_id, login_id, name, phone_number, role, status, created_at, approved_at")
    .eq("user_id", userId)
    .maybeSingle<RegistrationRow>();

  if (error) {
    if (isMissingSupabaseTableError(error) || isSupabaseWriteAccessError(error)) {
      return getLocalRegistrations().find((item) => item.user_id === userId) ?? null;
    }
    throw new Error(error.message);
  }

  return data ?? getLocalRegistrations().find((item) => item.user_id === userId) ?? null;
}

async function getApprovedRoleAccount(userId: string) {
  const localApproved = getLocalApprovedAccounts().find((item) => item.userId === userId) ?? null;
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

  if (
    studentError &&
    !isMissingSupabaseTableError(studentError) &&
    !isSupabaseWriteAccessError(studentError)
  ) {
    throw new Error(studentError.message);
  }

  if (
    driverError &&
    !isMissingSupabaseTableError(driverError) &&
    !isSupabaseWriteAccessError(driverError)
  ) {
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

  if (localApproved) {
    return {
      role: localApproved.role,
      loginId: localApproved.loginId,
      displayName: localApproved.displayName,
    };
  }

  return null;
}

async function ensureRegistrationForUser(
  user: { id: string; user_metadata?: Record<string, unknown> },
  fallbackLoginId: string,
): Promise<RegistrationRow | null> {
  const existing = await getRegistrationByUserId(user.id);
  if (existing) return existing;

  const meta = user.user_metadata ?? {};
  const roleRaw = meta.role;
  const role: RegistrableRole =
    roleRaw === "student" || roleRaw === "driver"
      ? roleRaw
      : fallbackLoginId.endsWith("@srmist.edu.in")
        ? "student"
        : "driver";
  const loginId = typeof meta.login_id === "string" ? meta.login_id : fallbackLoginId;
  const name = typeof meta.name === "string" ? meta.name : loginId.split("@")[0] || "User";
  const phoneNumber = typeof meta.phone_number === "string" ? meta.phone_number : "0000000000";

  const { data, error } = await supabase
    .from("registrations")
    .insert({
      user_id: user.id,
      login_id: loginId,
      name,
      phone_number: phoneNumber,
      role,
      status: "pending",
    })
    .select("id, user_id, login_id, name, phone_number, role, status, created_at, approved_at")
    .maybeSingle<RegistrationRow>();

  if (error) {
    if (isMissingSupabaseTableError(error) || isSupabaseWriteAccessError(error)) {
      return null;
    }
    throw new Error(error.message);
  }

  return data ?? null;
}

async function createPendingLoginApproval(registration: RegistrationRow) {
  const localApprovals = getLocalLoginApprovals();
  if (localApprovals.some((item) => item.user_id === registration.user_id && item.status === "pending")) {
    return;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  console.log("SESSION:", sessionData.session);
  if (sessionError) {
    console.log("getSession error:", sessionError);
  }

  const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser();
  console.log("CURRENT USER:", currentUserData);
  if (currentUserError) {
    console.log("getUser error:", currentUserError);
  }

  const authUser = currentUserData.user ?? sessionData.session?.user ?? null;
  if (!authUser) {
    console.log("Missing auth session. Remote insert will not run; saved local approval only.");
    return;
  }

  const approvalUserId = authUser.id;
  const approvalEmail = authUser.email ?? registration.login_id;
  const approvalRole = registration.role;

  console.log("INSERT CALLED", {
    userId: approvalUserId,
    email: approvalEmail,
    role: approvalRole,
    status: "pending",
  });

  saveLocalLoginApprovals([
    {
      id: `local-approval-${registration.user_id}`,
      registration_id: registration.id,
      user_id: approvalUserId,
      email: approvalEmail,
      login_id: registration.login_id,
      role: approvalRole,
      status: "pending",
      requested_at: new Date().toISOString(),
      approved_at: null,
      registrations: {
        name: registration.name,
        phone_number: registration.phone_number,
      },
    },
    ...localApprovals,
  ]);

  let registrationId = registration.id;
  if (!isUuid(registrationId)) {
    const { data: lookup, error: lookupError } = await supabase
      .from("registrations")
      .select("id")
      .eq("user_id", registration.user_id)
      .maybeSingle<{ id: string }>();

    if (lookupError) {
      if (isMissingSupabaseTableError(lookupError) || isSupabaseWriteAccessError(lookupError)) return;
      throw new Error(lookupError.message);
    }

    if (!lookup?.id || !isUuid(lookup.id)) {
      return;
    }

    registrationId = lookup.id;
  }

  const { data: existing, error: existingError } = await supabase
    .from("login_approvals")
    .select("id")
    .eq("user_id", approvalUserId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.log("existing approval lookup error:", existingError);
    if (isMissingSupabaseTableError(existingError) || isSupabaseWriteAccessError(existingError)) return;
    throw new Error(existingError.message);
  }

  if (existing) return;

  const { data: insertedRow, error: insertError } = await supabase
    .from("login_approvals")
    .insert({
      registration_id: registrationId,
      user_id: approvalUserId,
      email: approvalEmail,
      login_id: registration.login_id,
      role: approvalRole,
      status: "pending",
    })
    .select("id, user_id, email, login_id, role, status, requested_at")
    .maybeSingle<LoginApprovalRow>();

  console.log("INSERT RESULT:", insertedRow);

  if (insertError) {
    console.log("INSERT ERROR:", insertError);
    if (isMissingSupabaseTableError(insertError) || isSupabaseWriteAccessError(insertError)) return;
    throw new Error(insertError.message);
  }
}

export async function signUpUser(input: SignUpInput) {
  return registerUser(input);
}

export async function signIn(loginId: string, password: string): Promise<AuthResult> {
  const normalizedLoginId = normalizeLoginId(loginId);
  const normalizedPassword = password.trim();

  console.log("LOGIN START", { loginId: normalizedLoginId });

  if (!normalizedLoginId || !normalizedPassword) {
    throw new Error("Login ID and password are required");
  }

  if (ADMIN_LOGIN_ALIASES.has(normalizedLoginId)) {
    const adminEmail = ADMIN_LOGIN_ID;
    const { data: adminAuth, error: adminError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: normalizedPassword,
    });

    if (adminError || !adminAuth.user) {
      throw new Error(
        "Admin sign-in failed. Create a Supabase user with email transporter@admin.com and the admin password.",
      );
    }

    const token = createMockJwt({
      sub: adminEmail,
      role: "admin",
      iss: "PulseRide",
      aud: "admin-portal",
      iat: Math.floor(Date.now() / 1000),
    });

    const session = setSession("admin", adminEmail, token, {
      userId: adminAuth.user.id,
      loginId: adminEmail,
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

  console.log("LOGIN RESPONSE:", data, error);
  console.log("AUTH RESPONSE", { authData: data, authError: error });

  if (error || !data.user) {
    if (error && /email not confirmed/i.test(String(error.message ?? ""))) {
      console.log("Sign-in failed: email not confirmed");
      throw new Error("Email not confirmed. Please check your inbox and confirm your email before signing in.");
    }
    const localCredential =
      getLocalCredentials().find(
        (item) => item.loginId === normalizedLoginId && item.password === normalizedPassword,
      ) ?? null;

    if (!localCredential) {
      throw new Error(error?.message ?? "Invalid login credentials");
    }

    const localApproved =
      getLocalApprovedAccounts().find((item) => item.userId === localCredential.userId) ?? null;
    if (localApproved) {
      const session = setSession(localApproved.role, localApproved.loginId, undefined, {
        userId: localApproved.userId,
        loginId: localApproved.loginId,
        displayName: localApproved.displayName,
      });
      return {
        session,
        homeRoute: getHomeRouteForRole(localApproved.role),
      };
    }

    const localRegistration =
      getLocalRegistrations().find((item) => item.user_id === localCredential.userId) ?? null;
    if (!localRegistration) {
      throw new Error("Profile not found. Please contact admin.");
    }

    await createPendingLoginApproval(localRegistration);
    throw new Error("Login approval requested. Please wait for admin approval.");
  }

  let authSession: SupabaseSession | null = data.session;
  if (!authSession) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sessionResponse = await supabase.auth.getSession();
      const currentSession = sessionResponse.data.session;
      console.log("SESSION:", currentSession);
      if (currentSession) {
        authSession = currentSession;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (!authSession) {
    throw new Error("Auth session missing after login. Please try again.");
  }

  const { data: currentUserData, error: currentUserError } = await supabase.auth.getUser();
  console.log("CURRENT USER:", currentUserData);
  if (currentUserError) {
    console.log("getUser error:", currentUserError);
  }

  const sessionUser = currentUserData.user ?? authSession.user;
  if (!sessionUser) {
    throw new Error("Auth session missing user. Please try again.");
  }

  console.log("AUTH USER", {
    id: sessionUser.id,
    email: sessionUser.email,
  });

  const registration = await ensureRegistrationForUser(sessionUser, normalizedLoginId);
  if (!registration) {
    throw new Error("Unable to create registration for authenticated user.");
  }

  const approvedAccount = await getApprovedRoleAccount(sessionUser.id);
  if (approvedAccount) {
    const appSession = setSession(
      approvedAccount.role,
      approvedAccount.loginId,
      authSession.access_token,
      {
        userId: sessionUser.id,
        loginId: approvedAccount.loginId,
        displayName: approvedAccount.displayName,
      },
    );
    return {
      session: appSession,
      homeRoute: getHomeRouteForRole(approvedAccount.role),
    };
  }

  console.log("BEFORE INSERT", {
    user_id: sessionUser.id,
    email: sessionUser.email,
    login_id: registration.login_id,
    role: registration.role,
    status: "pending",
  });

  await createPendingLoginApproval(registration);

  await supabase.auth.signOut();
  throw new Error("Login approval requested. Please wait for admin approval.");
}

export async function getPendingApprovals(): Promise<PendingLoginApproval[]> {
  const { data, error } = await supabase
    .from("login_approvals")
    .select("id, requested_at, user_id, email, login_id, role, registrations(name, phone_number)")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) {
    console.log("admin fetch approvals error:", error);
    if (isMissingSupabaseTableError(error) || isSupabaseWriteAccessError(error)) {
      return getLocalLoginApprovals()
        .filter((item) => item.status === "pending")
        .map((item) => {
          const registration = Array.isArray(item.registrations) ? item.registrations[0] : item.registrations;
          return {
            requestId: item.id,
            requestedAt: item.requested_at,
            userId: item.user_id,
            loginId: item.login_id,
            role: item.role,
            name: String(registration?.name ?? "Unknown"),
            phoneNumber: String(registration?.phone_number ?? "N/A"),
          } satisfies PendingLoginApproval;
        });
    }
    throw new Error(error.message);
  }

  const remoteApprovals = (data ?? []).map((item) => {
    const registration = Array.isArray(item.registrations)
      ? item.registrations[0]
      : item.registrations;

    return {
      requestId: item.id as string,
      requestedAt: item.requested_at as string,
      userId: item.user_id as string,
      loginId: item.login_id as string,
      role: item.role as RegistrableRole,
      name: String(registration?.name ?? item.email ?? item.login_id ?? "Unknown"),
      phoneNumber: String(registration?.phone_number ?? "N/A"),
    } satisfies PendingLoginApproval;
  });

  const localApprovals = getLocalLoginApprovals()
    .filter((item) => item.status === "pending")
    .map((item) => {
      const registration = Array.isArray(item.registrations) ? item.registrations[0] : item.registrations;
      return {
        requestId: item.id,
        requestedAt: item.requested_at,
        userId: item.user_id,
        loginId: item.login_id,
        role: item.role,
        name: String(registration?.name ?? "Unknown"),
        phoneNumber: String(registration?.phone_number ?? "N/A"),
      } satisfies PendingLoginApproval;
    });

  const merged = [...remoteApprovals];
  for (const local of localApprovals) {
    if (!merged.some((item) => item.requestId === local.requestId)) {
      merged.push(local);
    }
  }

  return merged;
}

export async function approveUser(requestId: string) {
  const localApproval = getLocalLoginApprovals().find((item) => item.id === requestId) ?? null;
  const { data: request, error: requestError } = await supabase
    .from("login_approvals")
    .select("id, registration_id, user_id, login_id, role, status")
    .eq("id", requestId)
    .maybeSingle<LoginApprovalRow>();

  if (requestError) {
    if (isMissingSupabaseTableError(requestError) || isSupabaseWriteAccessError(requestError)) {
      if (!localApproval) return null;

      const localRegistration =
        getLocalRegistrations().find((item) => item.id === localApproval.registration_id) ?? null;
      if (!localRegistration) {
        throw new Error("Registration record not found.");
      }

      const now = new Date().toISOString();
      saveLocalLoginApprovals(
        getLocalLoginApprovals().map((item) =>
          item.id === requestId ? { ...item, status: "approved", approved_at: now } : item,
        ),
      );
      saveLocalRegistrations(
        getLocalRegistrations().map((item) =>
          item.id === localRegistration.id ? { ...item, status: "approved", approved_at: now } : item,
        ),
      );
      saveLocalApprovedAccounts([
        {
          userId: localRegistration.user_id,
          role: localRegistration.role,
          loginId: localRegistration.login_id,
          displayName: localRegistration.name,
        },
        ...getLocalApprovedAccounts().filter((item) => item.userId !== localRegistration.user_id),
      ]);

      return localApproval;
    }
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
    if (isMissingSupabaseTableError(registrationError) || isSupabaseWriteAccessError(registrationError)) {
      return null;
    }
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
    if (isMissingSupabaseTableError(approvalError) || isSupabaseWriteAccessError(approvalError)) {
      return null;
    }
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
    if (isMissingSupabaseTableError(registrationUpdateError) || isSupabaseWriteAccessError(registrationUpdateError)) {
      return null;
    }
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
    if (isMissingSupabaseTableError(approvedInsertError) || isSupabaseWriteAccessError(approvedInsertError)) {
      return null;
    }
    throw new Error(approvedInsertError.message);
  }

  saveLocalApprovedAccounts([
    {
      userId: registration.user_id,
      role: registration.role,
      loginId: registration.login_id,
      displayName: registration.name,
    },
    ...getLocalApprovedAccounts().filter((item) => item.userId !== registration.user_id),
  ]);

  return request;
}
