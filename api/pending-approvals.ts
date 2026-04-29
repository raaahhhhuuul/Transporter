import { getServiceSupabase, json } from "./_supabase";

export default async function handler(req: Request) {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("login_approvals")
    .select("id, requested_at, user_id, login_id, role, registrations!inner(name, phone_number)")
    .eq("status", "pending")
    .order("requested_at", { ascending: false });

  if (error) {
    return json(500, { error: error.message });
  }

  const result =
    (data ?? []).map((item) => {
      const reg = Array.isArray(item.registrations) ? item.registrations[0] : item.registrations;
      return {
        requestId: item.id as string,
        requestedAt: item.requested_at as string,
        userId: item.user_id as string,
        loginId: item.login_id as string,
        role: item.role as "student" | "driver",
        name: String(reg?.name ?? "Unknown"),
        phoneNumber: String(reg?.phone_number ?? "N/A"),
      };
    }) ?? [];

  return json(200, { ok: true, approvals: result });
}

