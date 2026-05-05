/// <reference types="node" />
import { getServiceSupabase, json } from "./_supabase";

interface Input {
  driverId: string | null;
  busId: string;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return json(405, { success: false, error: "Method not allowed" });
  }

  try {
    let body: Input;
    try {
      body = (await req.json()) as Input;
    } catch {
      return json(400, { success: false, error: "Invalid JSON" });
    }

    const { driverId, busId } = body;

    console.log("assign incoming:", { driverId, busId });

    if (!busId) {
      return json(400, { success: false, error: "Missing busId" });
    }

    const supabase = getServiceSupabase();

    const { data: currentBus, error: fetchError } = await supabase
      .from("buses")
      .select("id, assigned_driver_user_id")
      .eq("id", busId)
      .single();

    console.log("assign current bus:", currentBus);

    if (fetchError) {
      console.error("assign fetch error:", fetchError);
      return json(500, { success: false, error: fetchError.message });
    }

    if (!currentBus) {
      return json(404, { success: false, error: "Bus not found" });
    }

    if (currentBus.assigned_driver_user_id && currentBus.assigned_driver_user_id !== driverId) {
      const { error: clearError } = await supabase
        .from("buses")
        .update({ assigned_driver_user_id: null })
        .eq("assigned_driver_user_id", currentBus.assigned_driver_user_id)
        .neq("id", busId);

      if (clearError) {
        console.error("assign clear previous error:", clearError);
      }
    }

    const { data: updatedBus, error: updateError } = await supabase
      .from("buses")
      .update({ assigned_driver_user_id: driverId })
      .eq("id", busId)
      .select("id, assigned_driver_user_id")
      .single();

    console.log("assign update result:", updatedBus);

    if (updateError) {
      console.error("assign update error:", updateError);
      return json(500, { success: false, error: updateError.message });
    }

    return json(200, { success: true, data: updatedBus });
  } catch (err) {
    console.error("assign handler failed:", err);
    return json(500, { success: false, error: (err instanceof Error && err.message) || String(err) });
  }
}
