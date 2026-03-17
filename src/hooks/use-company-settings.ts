import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiFetchJson } from "@/lib/edge-api";

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

const apiFetch = <T,>(path: string, options: RequestInit = {}) => apiFetchJson<T>(path, options);

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
