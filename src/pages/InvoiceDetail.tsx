import { useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useInvoice, useUpdateInvoiceStatus, useDeleteInvoice } from "@/hooks/use-invoices";
import QueryErrorState from "@/components/QueryErrorState";
import { useAttachments, useAddAttachment, useDeleteAttachment } from "@/hooks/use-attachments";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { generateInvoicePDF } from "@/lib/generate-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Trash2, Download, Upload, FileText, ExternalLink, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Koncept", variant: "secondary" },
  sent: { label: "Odoslaná", variant: "default" },
  paid: { label: "Zaplatená", variant: "outline" },
  overdue: { label: "Po splatnosti", variant: "destructive" },
  cancelled: { label: "Zrušená", variant: "secondary" },
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InvoiceDetail() {
  const { id } = useParams();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: companySettings } = useCompanySettings();
  const { data: attachments, isLoading: attachmentsLoading } = useAttachments(id);
  const addAttachment = useAddAttachment();
  const deleteAttachment = useDeleteAttachment();
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (isLoading || !invoice) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const st = statusMap[invoice.status] || statusMap.draft;

  const handleDelete = async () => {
    await deleteInvoice.mutateAsync(invoice.id);
    toast({ title: "Faktúra vymazaná" });
    navigate("/invoices");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await addAttachment.mutateAsync({ invoiceId: invoice.id, file });
      }
      toast({ title: `${files.length > 1 ? `${files.length} súborov nahraných` : "Súbor nahraný"}` });
    } catch {
      toast({ title: "Chyba pri nahrávaní", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    try {
      await deleteAttachment.mutateAsync({ invoiceId: invoice.id, attachmentId, fileUrl });
      toast({ title: "Príloha vymazaná" });
    } catch {
      toast({ title: "Chyba pri mazaní", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {invoice.invoice_number}
              </h1>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground">{invoice.client_name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => generateInvoicePDF(invoice, companySettings ?? null)}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
          {invoice.status === "draft" && (
            <Button
              variant="outline"
              onClick={() => updateStatus.mutate({ id: invoice.id, status: "sent" })}
            >
              Odoslať
            </Button>
          )}
          {(invoice.status === "sent" || invoice.status === "overdue") && (
            <Button
              onClick={() => updateStatus.mutate({ id: invoice.id, status: "paid" })}
            >
              Označiť ako zaplatenú
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Údaje odberateľa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{invoice.client_name}</p>
            {invoice.client_address && <p className="text-muted-foreground">{invoice.client_address}</p>}
            {invoice.client_email && <p className="text-muted-foreground">{invoice.client_email}</p>}
            {invoice.client_ico && <p className="text-muted-foreground">IČO: {invoice.client_ico}</p>}
            {invoice.client_dic && <p className="text-muted-foreground">DIČ: {invoice.client_dic}</p>}
            {invoice.client_ic_dph && <p className="text-muted-foreground">IČ DPH: {invoice.client_ic_dph}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detaily faktúry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dátum vystavenia</span>
              <span className="text-foreground">{new Date(invoice.issue_date).toLocaleDateString("sk-SK")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Dátum splatnosti</span>
              <span className="text-foreground">{new Date(invoice.due_date).toLocaleDateString("sk-SK")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mena</span>
              <span className="text-foreground">{invoice.currency}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Položky</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Popis</TableHead>
                <TableHead className="text-right">Množstvo</TableHead>
                <TableHead className="text-right">Cena/ks</TableHead>
                <TableHead className="text-right">Celkom</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.invoice_items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {Number(item.unit_price).toLocaleString("sk-SK", { style: "currency", currency: invoice.currency })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(item.total).toLocaleString("sk-SK", { style: "currency", currency: invoice.currency })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 border-t border-border pt-4 text-right">
            <div className="text-lg font-bold text-foreground">
              Celkom: {Number(invoice.total).toLocaleString("sk-SK", { style: "currency", currency: invoice.currency })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attachments / Bank Statements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Prílohy / Výpisy z banky
          </CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Nahrať súbor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {attachmentsLoading ? (
            <div className="flex justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !attachments || attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Žiadne prílohy. Nahrajte výpis z banky alebo iný dokument.
            </p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{att.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(att.file_size)} • {new Date(att.created_at).toLocaleDateString("sk-SK")}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDeleteAttachment(att.id, att.file_url)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Poznámky</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
