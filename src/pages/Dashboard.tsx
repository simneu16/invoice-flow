import { useInvoices } from "@/hooks/use-invoices";
import QueryErrorState from "@/components/QueryErrorState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const { data: invoices, isLoading, isError, error, refetch } = useInvoices();

  const stats = invoices
    ? {
        total: invoices.length,
        draft: invoices.filter((i) => i.status === "draft").length,
        paid: invoices.filter((i) => i.status === "paid").length,
        overdue: invoices.filter((i) => i.status === "overdue").length,
        totalAmount: invoices.reduce((sum, i) => sum + Number(i.total), 0),
        paidAmount: invoices
          .filter((i) => i.status === "paid")
          .reduce((sum, i) => sum + Number(i.total), 0),
      }
    : { total: 0, draft: 0, paid: 0, overdue: 0, totalAmount: 0, paidAmount: 0 };

  const cards = [
    { title: "Celkom faktúr", value: stats.total, icon: FileText, color: "text-primary" },
    { title: "Koncept", value: stats.draft, icon: Clock, color: "text-muted-foreground" },
    { title: "Zaplatené", value: stats.paid, icon: CheckCircle, color: "text-success" },
    { title: "Po splatnosti", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
  ];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Prehľad</h1>
        <p className="mt-1 text-muted-foreground">Rýchly prehľad vašich faktúr</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Celková suma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {stats.totalAmount.toLocaleString("sk-SK", { style: "currency", currency: "EUR" })}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Zo všetkých faktúr</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Zaplatená suma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">
              {stats.paidAmount.toLocaleString("sk-SK", { style: "currency", currency: "EUR" })}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Z uhradených faktúr</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
