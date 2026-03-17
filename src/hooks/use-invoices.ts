import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiFetchJson } from "@/lib/edge-api";

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string;
  client_name: string;
  client_email: string | null;
  client_address: string | null;
  client_ico: string | null;
  client_dic: string | null;
  client_ic_dph: string | null;
  issue_date: string;
  due_date: string;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceWithItems = Invoice & { invoice_items: InvoiceItem[] };

const apiFetch = <T,>(path: string, options: RequestInit = {}) => apiFetchJson<T>(path, options);

export function useInvoices() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["invoices", user?.id],
    queryFn: () => apiFetch("invoices") as Promise<InvoiceWithItems[]>,
    enabled: !!user,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiFetch(`invoices/${id}`) as Promise<InvoiceWithItems>,
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      invoice,
      items,
    }: {
      invoice: Partial<Omit<Invoice, "id" | "user_id" | "created_at" | "updated_at">> & { invoice_number: string; client_name: string };
      items: Omit<InvoiceItem, "id" | "invoice_id" | "created_at">[];
    }) => {
      if (!user) throw new Error("Not authenticated");
      return apiFetch("invoices", {
        method: "POST",
        body: JSON.stringify({ invoice, items }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}

export function useUpdateInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Invoice["status"] }) => {
      return apiFetch(`invoices/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", variables.id] });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiFetch(`invoices/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
