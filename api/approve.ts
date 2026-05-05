/// <reference types="node" />
import { getServiceSupabase, json } from "./_supabase";

interface LoginApprovalRow {
  id: string;
  registration_id: string;
  user_id: string;
  role: string;
  status: string;
  registrations?: {
    name: string;
    email: string;
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
    const { data: approval, error: fetchError } = await supabase
      .from("login_approvals")
      .select(`
        id,
        role,
        status,
        user_id,
        registration_id,
        registrations (
          name,
          email
        )
      `)
      .eq("id", id)
      .single<LoginApprovalRow>();

    console.log("approve fetched record:", approval);

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return json(404, { success: false, error: "Approval record not found" });
      }
      console.error("approve fetch error:", fetchError);
      return json(500, { success: false, error: fetchError.message });
    }

    if (!approval) {
      return json(404, { success: false, error: "Approval record not found" });
    }

    const name = approval.registrations?.name ?? "";
    const email = approval.registrations?.email ?? "";
    const role = approval.role.toLowerCase();
    const user_id = approval.user_id;

    console.log("approve extracted info:", { name, email, role, user_id });

    if (approval.status !== "pending") {
      return json(409, { success: false, error: "Approval is not pending" });
    }

    if (!name || !email) {
      return json(400, { success: false, error: "Missing registration name or email" });
    }

    let insertedRecord: any = null;
    const targetTable = role === "student" ? "students" : "drivers";

    // Check duplicate by email/login_id
    try {
      const { data: existingByEmail, error: checkErr } = await supabase
        .from(targetTable)
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (checkErr) {
        console.error("approve check existing error:", checkErr);
      }

      if (!existingByEmail) {
        console.log(`approve inserting into ${targetTable}:`, { user_id, name, email });
        const insertPayload: Record<string, unknown> = {
          id: user_id,
          name,
          email,
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

    return json(200, {
      success: true,
      role,
      userId: user_id,
    });
  } catch (err) {
    console.error("approve handler failed:", err);
    return json(500, { success: false, error: (err instanceof Error && err.message) || String(err) });
  }
}

