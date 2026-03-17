import { supabase } from "@/integrations/supabase/client";

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const mysqlApiBaseUrl = `${supabaseUrl}/functions/v1/mysql-api`;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : typeof payload === "string" && payload.trim()
          ? payload
          : `Request failed with status ${response.status}`;

    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function apiFetchJson<T>(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new ApiError("Not authenticated", 401);
  }

  const response = await fetch(`${mysqlApiBaseUrl}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(options.headers || {}),
    },
  });

  return parseJsonResponse<T>(response);
}
