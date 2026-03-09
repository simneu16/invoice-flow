import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export interface CompanySettings {
  id: string;
  user_id: string;
  company_name: string | null;
  ico: string | null;
  dic: string | null;
  ic_dph: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  bank_name: string | null;
  iban: string | null;
  swift: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/mysql-api`;

async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const res = await fetch(`${BASE_URL}/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(options.headers || {}),
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "API error");
  return data;
}

export function useCompanySettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["company-settings", user?.id],
    queryFn: () => apiFetch("settings") as Promise<CompanySettings | null>,
    enabled: !!user,
  });
}

export function useSaveCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<Omit<CompanySettings, "id" | "user_id" | "created_at" | "updated_at">>) => {
      return apiFetch("settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      }) as Promise<CompanySettings>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    },
  });
}
