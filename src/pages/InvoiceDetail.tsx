import { useParams, Link, useNavigate } from "react-router-dom";
import { useInvoice, useUpdateInvoiceStatus, useDeleteInvoice } from "@/hooks/use-invoices";
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
import { ArrowLeft, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Koncept", variant: "secondary" },
  sent: { label: "Odoslaná", variant: "default" },
  paid: { label: "Zaplatená", variant: "outline" },
  overdue: { label: "Po splatnosti", variant: "destructive" },
  cancelled: { label: "Zrušená", variant: "secondary" },
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: companySettings } = useCompanySettings();
  const updateStatus = useUpdateInvoiceStatus();
  const deleteInvoice = useDeleteInvoice();
  const navigate = useNavigate();
  const { toast } = useToast();

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
