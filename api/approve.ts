/// <reference types="node" />
import { getServiceSupabase, json } from "./_supabase";

interface LoginApprovalRow {
  id: string;
  registration_id: string;
  user_id: string;
  login_id: string;
  role: string;
  status: string;
  requested_at: string;
  approved_at: string | null;
  registrations?: {
    name: string;
    phone_number: string;
  };
}

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

    // Fetch the approval record
    const { data: fetchedRecord, error: fetchError } = await supabase
      .from("login_approvals")
      .select("id, registration_id, user_id, login_id, role, status, requested_at, approved_at")
      .eq("id", id)
      .single<LoginApprovalRow>();

    console.log("approve fetched record:", fetchedRecord);

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return json(404, { success: false, error: "Approval record not found" });
      }
      console.error("approve fetch error:", fetchError);
      return json(500, { success: false, error: fetchError.message });
    }

    if (!fetchedRecord) {
      return json(404, { success: false, error: "Approval record not found" });
    }

    // Extract user info and determine role
    const { user_id, login_id, role } = fetchedRecord;
    // Use login_id as email; derive a display name from it
    const email = login_id;
    const name = typeof login_id === "string" && login_id.includes("@") ? login_id.split("@")[0] : login_id;

    console.log("approve extracted info:", { user_id, email, name, role });

    let insertedRecord: any = null;
    const targetTable = role === "student" ? "students" : "drivers";

    // Check duplicate by email/login_id
    try {
      const { data: existingByEmail, error: checkErr } = await supabase
        .from(targetTable)
        .select("user_id, login_id")
        .eq("login_id", email)
        .maybeSingle();

      if (checkErr) {
        console.error("approve check existing error:", checkErr);
      }

      if (!existingByEmail) {
        console.log(`approve inserting into ${targetTable}:`, { user_id, name, email });
        const insertPayload: Record<string, unknown> = {
          user_id,
          name,
          login_id: email,
        };

        const { data: ins, error: insertError } = await supabase
          .from(targetTable)
          .insert(insertPayload)
          .select("*")
          .maybeSingle();

        if (insertError) {
          console.error(`approve insert ${targetTable} error:`, insertError);
        } else {
          insertedRecord = ins;
          console.log(`approve inserted ${targetTable}:`, insertedRecord);
        }
      } else {
        console.log(`approve ${targetTable} already exists:`, existingByEmail);
        insertedRecord = existingByEmail;
      }
    } catch (e) {
      console.error("approve insert/check failed:", e);
    }

    // Update approval status to "approved"
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

    return json(200, { success: true, data: updatedRecord, inserted: insertedRecord });
  } catch (err) {
    console.error("approve handler failed:", err);
    return json(500, { success: false, error: (err instanceof Error && err.message) || String(err) });
  }
}

