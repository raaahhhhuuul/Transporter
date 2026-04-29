import { getServiceSupabase, json } from "./_supabase";

type Input = {
  userId: string;
  loginId: string;
  name: string;
  phoneNumber: string;
  role: "student" | "driver";
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

  if (!input.userId || !input.loginId || !input.name || !input.phoneNumber || !input.role) {
    return json(400, { error: "Missing required fields" });
  }

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("registrations")
    .upsert(
      {
        user_id: input.userId,
        login_id: input.loginId,
        name: input.name,
        phone_number: input.phoneNumber,
        role: input.role,
        status: "pending",
      },
      { onConflict: "user_id" },
    )
    .select("id, user_id, login_id, name, phone_number, role, status, created_at, approved_at")
    .maybeSingle();

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, { ok: true, registration: data });
}

