import { getServiceSupabase, json } from "./_supabase";

type Input = { userId: string };

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

  const [{ data: student }, { data: driver }] = await Promise.all([
    supabase
      .from("students")
      .select("login_id, name")
      .eq("user_id", input.userId)
      .maybeSingle(),
    supabase
      .from("drivers")
      .select("login_id, name")
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);

  if (student) {
    return json(200, {
      ok: true,
      status: "approved",
      role: "student",
      loginId: student.login_id,
      displayName: student.name,
    });
  }

  if (driver) {
    return json(200, {
      ok: true,
      status: "approved",
      role: "driver",
      loginId: driver.login_id,
      displayName: driver.name,
    });
  }

  return json(200, { ok: true, status: "pending" });
}

