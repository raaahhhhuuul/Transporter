/// <reference types="node" />
import { getServiceSupabase, json } from "./_supabase";

interface Input {
  driverId: string;
  busId: string;
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

    const { driverId, busId } = body as Input;

    console.log("assign-driver incoming:", { driverId, busId });

    if (!driverId || !busId) {
      return json(400, { success: false, error: "Missing driverId or busId" });
    }

    const supabase = getServiceSupabase();

    // Fetch the current bus record
    const { data: currentBus, error: fetchError } = await supabase
      .from("buses")
      .select("*")
      .eq("id", busId)
      .single();

    console.log("current bus:", currentBus);

    if (fetchError) {
      console.error("assign-driver fetch error:", fetchError);
      return json(500, { success: false, error: fetchError.message });
    }

    if (!currentBus) {
      return json(404, { success: false, error: "Bus not found" });
    }

    // If a different driver was previously assigned, clear their assignment
    if (currentBus.assigned_driver_user_id && currentBus.assigned_driver_user_id !== driverId) {
      const { error: clearError } = await supabase
        .from("buses")
        .update({ assigned_driver_user_id: null })
        .eq("assigned_driver_user_id", currentBus.assigned_driver_user_id)
        .neq("id", busId);

      if (clearError) {
        console.error("assign-driver clear previous error:", clearError);
        // Continue anyway
      }
    }

    // Update this bus with the new driver assignment
    const { data: updatedBus, error: updateError } = await supabase
      .from("buses")
      .update({ assigned_driver_user_id: driverId })
      .eq("id", busId)
      .select("*")
      .single();

    console.log("assign-driver update result:", updatedBus);

    if (updateError) {
      console.error("assign-driver update error:", updateError);
      return json(500, { success: false, error: updateError.message });
    }

    return json(200, { success: true, data: updatedBus });
  } catch (err) {
    console.error("assign-driver handler failed:", err);
    return json(500, { success: false, error: (err instanceof Error && err.message) || String(err) });
  }
}
