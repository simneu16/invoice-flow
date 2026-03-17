import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useInvoices, useDeleteInvoice, useUpdateInvoiceStatus } from "@/hooks/use-invoices";
import QueryErrorState from "@/components/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, MoreHorizontal, Eye, Trash2, CalendarIcon, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { sk } from "date-fns/locale";
import { cn } from "@/lib/utils";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Koncept", variant: "secondary" },
  sent: { label: "Odoslaná", variant: "default" },
  paid: { label: "Zaplatená", variant: "outline" },
  overdue: { label: "Po splatnosti", variant: "destructive" },
  cancelled: { label: "Zrušená", variant: "secondary" },
};

export default function InvoiceList() {
  const { data: invoices, isLoading } = useInvoices();
  const deleteInvoice = useDeleteInvoice();
  const updateStatus = useUpdateInvoiceStatus();
  const { toast } = useToast();

  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    return invoices.filter((inv) => {
      const issueDate = new Date(inv.issue_date);
      if (dateFrom && issueDate < dateFrom) return false;
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        if (issueDate > endOfDay) return false;
      }
      return true;
    });
  }, [invoices, dateFrom, dateTo]);

  const filteredTotal = useMemo(
    () => filteredInvoices.reduce((sum, i) => sum + Number(i.total), 0),
    [filteredInvoices]
  );

  const hasFilter = dateFrom || dateTo;

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice.mutateAsync(id);
      toast({ title: "Faktúra vymazaná" });
    } catch {
      toast({ title: "Chyba pri mazaní", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Faktúry</h1>
          <p className="mt-1 text-muted-foreground">Spravujte vaše faktúry</p>
        </div>
        <Link to="/invoices/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nová faktúra
          </Button>
        </Link>
      </div>

      {/* Date filter */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-3">
          <span className="text-sm font-medium text-muted-foreground">Filter podľa dátumu:</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "d.M.yyyy") : "Od"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                locale={sk}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">—</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "d.M.yyyy") : "Do"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                locale={sk}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          {hasFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}
              className="gap-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" /> Zrušiť filter
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {hasFilter ? "Filtrované" : "Celkom"}:
            </span>
            <span className="text-lg font-bold text-foreground">
              {filteredTotal.toLocaleString("sk-SK", { style: "currency", currency: "EUR" })}
            </span>
            <span className="text-xs text-muted-foreground">
              ({filteredInvoices.length} {filteredInvoices.length === 1 ? "faktúra" : filteredInvoices.length < 5 ? "faktúry" : "faktúr"})
            </span>
          </div>
        </CardContent>
      </Card>

      {!filteredInvoices.length ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="text-muted-foreground">
            <p className="text-lg font-medium">
              {hasFilter ? "Žiadne faktúry v zvolenom období" : "Zatiaľ nemáte žiadne faktúry"}
            </p>
            {!hasFilter && <p className="mt-1 text-sm">Vytvorte svoju prvú faktúru</p>}
          </div>
          {!hasFilter && (
            <Link to="/invoices/new" className="mt-4">
              <Button>Vytvoriť faktúru</Button>
            </Link>
          )}
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Číslo</TableHead>
                <TableHead>Klient</TableHead>
                <TableHead>Dátum</TableHead>
                <TableHead>Splatnosť</TableHead>
                <TableHead>Suma</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const st = statusMap[invoice.status] || statusMap.draft;
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{invoice.client_name}</TableCell>
                    <TableCell>{new Date(invoice.issue_date).toLocaleDateString("sk-SK")}</TableCell>
                    <TableCell>{new Date(invoice.due_date).toLocaleDateString("sk-SK")}</TableCell>
                    <TableCell className="font-medium">
                      {Number(invoice.total).toLocaleString("sk-SK", { style: "currency", currency: invoice.currency })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/invoices/${invoice.id}`} className="flex items-center gap-2">
                              <Eye className="h-4 w-4" /> Zobraziť
                            </Link>
                          </DropdownMenuItem>
                          {invoice.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: invoice.id, status: "sent" })}
                            >
                              Označiť ako odoslanú
                            </DropdownMenuItem>
                          )}
                          {(invoice.status === "sent" || invoice.status === "overdue") && (
                            <DropdownMenuItem
                              onClick={() => updateStatus.mutate({ id: invoice.id, status: "paid" })}
                            >
                              Označiť ako zaplatenú
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(invoice.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Vymazať
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
