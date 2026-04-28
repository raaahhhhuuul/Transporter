export function isMissingSupabaseTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const typed = error as {
    status?: number;
    code?: string;
    message?: string;
  };

  const message = typed.message?.toLowerCase() ?? "";
  return (
    typed.status === 404 ||
    typed.code === "PGRST116" ||
    typed.code === "PGRST301" ||
    typed.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("schema cache") ||
    message.includes("not found")
  );
}