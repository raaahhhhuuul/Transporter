import { getServiceSupabase, json } from "./_supabase";

type Input = {
  name: string;
  email: string;
};

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

  if (!input.name || !input.email) {
    return json(400, { error: "Missing required fields" });
  }

  const supabase = getServiceSupabase();

  const { data, error } = await supabase
    .from("registrations")
    .upsert(
      {
        name: input.name,
        email: input.email,
      },
      { onConflict: "email" },
    )
    .select("id, name, email")
    .maybeSingle();

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, { ok: true, registration: data });
}

