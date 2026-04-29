import { getServiceSupabase, json } from "./_supabase";

type Input = {
  userId: string;
};

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let input: Input;
  try {
    input = (await req.json()) as Input;
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  if (!input.userId) {
    return json(400, { error: "Missing userId" });
  }

  const supabase = getServiceSupabase();

  const { data: registration, error: regError } = await supabase
    .from("registrations")
    .select("id, user_id, login_id, role, status")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (regError) {
    return json(500, { error: regError.message });
  }
  if (!registration) {
    return json(404, { error: "Registration not found" });
  }

  const { data: existing, error: existingError } = await supabase
    .from("login_approvals")
    .select("id")
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return json(500, { error: existingError.message });
  }

  if (existing) {
    return json(200, { ok: true, alreadyPending: true });
  }

  const { error: insertError } = await supabase.from("login_approvals").insert({
    registration_id: registration.id,
    user_id: input.userId,
    login_id: registration.login_id,
    role: registration.role,
    status: "pending",
  });

  if (insertError) {
    return json(500, { error: insertError.message });
  }

  return json(200, { ok: true });
}

