/// <reference types="node" />
import { getServiceSupabase, json } from "./_supabase";

type Input = {
  email: string;
};

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  let input: Input;
  try {
    input = (await req.json()) as Input;
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" });
  }

  const email = (input.email ?? "").trim().toLowerCase();
  if (!email) {
    return json(400, { ok: false, error: "Missing email" });
  }

  try {
    const supabase = getServiceSupabase();

    console.log("login check incoming:", { email });

    const [{ data: driver, error: driverError }, { data: student, error: studentError }] = await Promise.all([
      supabase.from("drivers").select("id, name, email").eq("email", email).maybeSingle(),
      supabase.from("students").select("id, name, email").eq("email", email).maybeSingle(),
    ]);

    if (driverError) {
      console.error("login driver lookup error:", driverError);
      return json(500, { ok: false, error: driverError.message });
    }

    if (studentError) {
      console.error("login student lookup error:", studentError);
      return json(500, { ok: false, error: studentError.message });
    }

    if (driver) {
      console.log("login approved driver:", driver);
      return json(200, {
        ok: true,
        approved: true,
        role: "driver",
        userId: driver.id,
        name: driver.name,
        email: driver.email,
      });
    }

    if (student) {
      console.log("login approved student:", student);
      return json(200, {
        ok: true,
        approved: true,
        role: "student",
        userId: student.id,
        name: student.name,
        email: student.email,
      });
    }

    console.log("login not approved:", { email });
    return json(200, { ok: true, approved: false });
  } catch (err) {
    console.error("login handler failed:", err);
    return json(500, { ok: false, error: (err instanceof Error && err.message) || String(err) });
  }
}
