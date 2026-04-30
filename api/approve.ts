import { getServiceSupabase, json } from "./_supabase";

type Input = { requestId: string };

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

  if (!input.requestId) {
    return json(400, { error: "Missing requestId" });
  }
  try {
    const supabase = getServiceSupabase();

    const { data: request, error: requestError } = await supabase
      .from("login_approvals")
      .select("id, registration_id, user_id, login_id, role, status")
      .eq("id", input.requestId)
      .maybeSingle();

    if (requestError) {
      console.error("approve request lookup error:", requestError);
      const code = (requestError as any)?.code ?? (requestError as any)?.status;
      if (code === "PGRST116" || code === 404) return json(500, { error: "Missing required table(s)" });
      return json(500, { error: requestError.message });
    }
    if (!request) return json(404, { error: "Request not found" });

    const { data: registration, error: regError } = await supabase
      .from("registrations")
      .select("id, user_id, login_id, name, phone_number, role, status")
      .eq("id", request.registration_id)
      .maybeSingle();

    if (regError) {
      console.error("approve registration lookup error:", regError);
      const code = (regError as any)?.code ?? (regError as any)?.status;
      if (code === "PGRST116" || code === 404) return json(500, { error: "Missing required table(s)" });
      return json(500, { error: regError.message });
    }
    if (!registration) return json(404, { error: "Registration not found" });

    const now = new Date().toISOString();

    const { error: approvalError } = await supabase
      .from("login_approvals")
      .update({ status: "approved", approved_at: now })
      .eq("id", input.requestId);
    if (approvalError) return json(500, { error: approvalError.message });

    const { error: regUpdateError } = await supabase
      .from("registrations")
      .update({ status: "approved", approved_at: now })
      .eq("id", registration.id);
    if (regUpdateError) return json(500, { error: regUpdateError.message });

    const tableName = registration.role === "student" ? "students" : "drivers";
    const { error: insertError } = await supabase.from(tableName).upsert(
      {
        user_id: registration.user_id,
        registration_id: registration.id,
        login_id: registration.login_id,
        name: registration.name,
        phone_number: registration.phone_number,
      },
      { onConflict: "user_id" },
    );
    if (insertError) return json(500, { error: insertError.message });

    return json(200, { ok: true });
  } catch (err) {
    console.error("approve handler failed:", err);
    return json(500, { error: (err instanceof Error && err.message) || String(err) });
  }
}

