import { getServiceSupabase, json } from "./_supabase";

export default async function handler(req: Request) {
  if (req.method !== "GET") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabase = getServiceSupabase();

    const { data, error } = await supabase
      .from("login_approvals")
      .select(`
        id,
        registration_id,
        requested_at,
        user_id,
        role,
        status,
        registrations(name, email)
      `)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });

    if (error) {
      // Missing table or schema errors from PostgREST use codes like PGRST116 or SQL 42P01
      const code = (error as any)?.code ?? (error as any)?.status;
      console.error("pending-approvals error:", error);
      if (code === "PGRST116" || code === 404 || String((error as any)?.message ?? "").toLowerCase().includes("does not exist")) {
        return json(200, { ok: true, approvals: [] });
      }
      return json(500, { error: error.message });
    }

    const result =
      (data ?? []).map((item: any) => {
        const reg = Array.isArray(item.registrations) ? item.registrations[0] : item.registrations;
        return {
          requestId: item.id as string,
          requestedAt: item.requested_at as string,
          userId: item.user_id as string,
          role: item.role as "student" | "driver",
          name: String(reg?.name ?? "Unknown"),
          email: String(reg?.email ?? "N/A"),
        };
      }) ?? [];

    return json(200, { ok: true, approvals: result });
  } catch (err) {
    console.error("pending-approvals handler failed:", err);
    return json(500, { error: (err instanceof Error && err.message) || String(err) });
  }
}

