import { useState, useCallback } from "react";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ParsedInvoice {
  invoice_number: string;
  client_name: string;
  client_email?: string;
  issue_date: string;
  due_date: string;
  total: number;
  tax_rate: number;
  items: { description: string; quantity: number; unit_price: number }[];
}

function parseCSV(text: string): ParsedInvoice[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const invoices: ParsedInvoice[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(";").map((v) => v.trim().replace(/"/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });

    invoices.push({
      invoice_number: row["cislo"] || row["invoice_number"] || row["cislo_faktury"] || `IMP-${i}`,
      client_name: row["klient"] || row["client_name"] || row["nazov"] || row["odberatel"] || "Neznámy",
      client_email: row["email"] || row["client_email"] || undefined,
      issue_date: row["datum"] || row["issue_date"] || row["datum_vystavenia"] || new Date().toISOString().split("T")[0],
      due_date: row["splatnost"] || row["due_date"] || row["datum_splatnosti"] || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      total: parseFloat(row["suma"] || row["total"] || row["celkom"] || "0") || 0,
      tax_rate: 0,
      items: [
        {
          description: row["popis"] || row["description"] || row["polozka"] || "Importovaná položka",
          quantity: parseFloat(row["mnozstvo"] || row["quantity"] || "1") || 1,
          unit_price: parseFloat(row["cena"] || row["unit_price"] || row["suma"] || "0") || 0,
        },
      ],
    });
  }

  return invoices;
}

export default function ImportCSV() {
  const [parsed, setParsed] = useState<ParsedInvoice[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const createInvoice = useCreateInvoice();
  const { toast } = useToast();

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const result = parseCSV(text);
      setParsed(result);
      setImportResult(null);

      if (result.length === 0) {
        toast({ title: "Prázdny súbor alebo neplatný formát", variant: "destructive" });
      } else {
        toast({ title: `Načítaných ${result.length} faktúr` });
      }
    };
    reader.readAsText(file);
  }, [toast]);

  const handleImport = async () => {
    setImporting(true);
    let success = 0;
    let failed = 0;

    for (const inv of parsed) {
      try {
        const total = inv.items.reduce((s, item) => s + item.quantity * item.unit_price, 0);

        await createInvoice.mutateAsync({
          invoice: {
            invoice_number: inv.invoice_number,
            client_name: inv.client_name,
            client_email: inv.client_email || null,
            issue_date: inv.issue_date,
            due_date: inv.due_date,
            tax_rate: 0,
            subtotal: total,
            tax_amount: 0,
            total,
          },
          items: inv.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          })),
        });
        success++;
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed });
    setImporting(false);
    toast({
      title: "Import dokončený",
      description: `Úspešných: ${success}, Neúspešných: ${failed}`,
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Import faktúr</h1>
        <p className="mt-1 text-muted-foreground">Importujte faktúry z CSV súboru</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nahrať CSV súbor</CardTitle>
          <CardDescription>
            CSV súbor oddelený bodkočiarkou (;). Podporované stĺpce: cislo, klient, email, datum,
            splatnost, suma, dph, popis, mnozstvo, cena
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-8 transition-colors hover:border-primary/50 hover:bg-muted/50">
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Kliknite pre nahratie CSV</span>
            <span className="mt-1 text-xs text-muted-foreground">alebo presuňte súbor sem</span>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </CardContent>
      </Card>

      {parsed.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Náhľad ({parsed.length} faktúr)
              </CardTitle>
            </div>
            <Button onClick={handleImport} disabled={importing} className="gap-2">
              {importing ? "Importujem..." : "Importovať všetko"}
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Číslo</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Splatnosť</TableHead>
                  <TableHead className="text-right">Suma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map((inv, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                    <TableCell>{inv.client_name}</TableCell>
                    <TableCell>{inv.issue_date}</TableCell>
                    <TableCell>{inv.due_date}</TableCell>
                    <TableCell className="text-right">
                      {inv.total.toLocaleString("sk-SK", { style: "currency", currency: "EUR" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {importResult && (
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            {importResult.failed === 0 ? (
              <>
                <CheckCircle className="h-8 w-8 text-success" />
                <div>
                  <p className="font-medium text-foreground">Import úspešný</p>
                  <p className="text-sm text-muted-foreground">
                    Importovaných {importResult.success} faktúr
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-8 w-8 text-warning" />
                <div>
                  <p className="font-medium text-foreground">Import čiastočne úspešný</p>
                  <p className="text-sm text-muted-foreground">
                    Úspešných: {importResult.success}, Neúspešných: {importResult.failed}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
