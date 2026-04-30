import { getServiceSupabase, json } from "./_supabase";

export default async function handler(req: any) {
  if (req.method !== "POST") {
    return json(405, { success: false, error: "Method not allowed" });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(400, { success: false, error: "Invalid JSON" });
    }

    const { id } = body;

    console.log("approve incoming id:", id);

    if (!id) {
      return json(400, { success: false, error: "Missing id" });
    }

    const supabase = getServiceSupabase();

    const { data: fetchedRecord, error: fetchError } = await supabase
      .from("login_approvals")
      .select("*")
      .eq("id", id)
      .single();

    console.log("approve fetched record:", fetchedRecord);

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        // No rows found (single() throws when no record)
        return json(404, { success: false, error: "Approval record not found" });
      }
      console.error("approve fetch error:", fetchError);
      return json(500, { success: false, error: fetchError.message });
    }

    if (!fetchedRecord) {
      return json(404, { success: false, error: "Approval record not found" });
    }

    const { data: updatedRecord, error: updateError } = await supabase
      .from("login_approvals")
      .update({ status: "approved" })
      .eq("id", id)
      .select("*")
      .single();

    console.log("approve update result:", updatedRecord);

    if (updateError) {
      console.error("approve update error:", updateError);
      return json(500, { success: false, error: updateError.message });
    }

    return json(200, { success: true, data: updatedRecord });
  } catch (err) {
    console.error("approve handler failed:", err);
    return json(500, { success: false, error: (err instanceof Error && err.message) || String(err) });
  }
}

