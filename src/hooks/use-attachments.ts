import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { apiFetchJson } from "@/lib/edge-api";

export interface Attachment {
  id: string;
  invoice_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
}

const apiFetch = <T,>(path: string, options: RequestInit = {}) => apiFetchJson<T>(path, options);

export function useAttachments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["attachments", invoiceId],
    queryFn: () => apiFetch(`invoices/${invoiceId}/attachments`) as Promise<Attachment[]>,
    enabled: !!invoiceId,
  });
}

export function useAddAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, file }: { invoiceId: string; file: File }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const ext = file.name.split(".").pop();
      const filePath = `${session.user.id}/${invoiceId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("invoice-attachments")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("invoice-attachments")
        .getPublicUrl(filePath);

      return apiFetch(`invoices/${invoiceId}/attachments`, {
        method: "POST",
        body: JSON.stringify({
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
        }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attachments", variables.invoiceId] });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, attachmentId, fileUrl }: { invoiceId: string; attachmentId: string; fileUrl: string }) => {
      // Extract storage path from URL
      try {
        const url = new URL(fileUrl);
        const pathMatch = url.pathname.match(/\/object\/public\/invoice-attachments\/(.+)/);
        if (pathMatch) {
          await supabase.storage.from("invoice-attachments").remove([pathMatch[1]]);
        }
      } catch {
        // ignore storage delete errors
      }

      return apiFetch(`invoices/${invoiceId}/attachments/${attachmentId}`, {
        method: "DELETE",
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["attachments", variables.invoiceId] });
    },
  });
}
