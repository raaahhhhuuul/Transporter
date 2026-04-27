export interface ServerSupabaseConfig {
  supabaseUrl: string | null;
  serviceRoleKey: string | null;
}

type EnvSource = Record<string, string | undefined>;

function readEnvFromProcess(key: string): string | null {
  if (typeof process === "undefined") return null;

  const processEnv = (process.env ?? {}) as EnvSource;
  const value = processEnv[key];
  if (!value) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readEnvFromImportMeta(key: string): string | null {
  try {
    const env = (import.meta as ImportMeta & { env?: EnvSource }).env;
    const value = env?.[key];
    if (!value) return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export function getServerEnv(...keys: string[]): string | null {
  for (const key of keys) {
    const fromProcess = readEnvFromProcess(key);
    if (fromProcess) return fromProcess;

    const fromImportMeta = readEnvFromImportMeta(key);
    if (fromImportMeta) return fromImportMeta;
  }

  return null;
}

export function getServerSupabaseConfig(): ServerSupabaseConfig {
  return {
    supabaseUrl: getServerEnv("SUPABASE_URL", "VITE_SUPABASE_URL"),
    serviceRoleKey: getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}