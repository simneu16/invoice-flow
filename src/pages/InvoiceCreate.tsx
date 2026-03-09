import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateInvoice } from "@/hooks/use-invoices";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface ItemRow {
  description: string;
  quantity: number;
  unit_price: number;
}

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const { toast } = useToast();

  const [form, setForm] = useState({
    invoice_number: "",
    client_name: "",
    client_email: "",
    client_address: "",
    client_ico: "",
    client_dic: "",
    client_ic_dph: "",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
    notes: "",
  });

  const [items, setItems] = useState<ItemRow[]>([
    { description: "", quantity: 1, unit_price: 0 },
  ]);

  const updateField = (field: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (index: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.invoice_number || !form.client_name) {
      toast({ title: "Vyplňte povinné polia", variant: "destructive" });
      return;
    }

    try {
      await createInvoice.mutateAsync({
        invoice: {
          invoice_number: form.invoice_number,
          client_name: form.client_name,
          client_email: form.client_email || null,
          client_address: form.client_address || null,
          client_ico: form.client_ico || null,
          client_dic: form.client_dic || null,
          client_ic_dph: form.client_ic_dph || null,
          issue_date: form.issue_date,
          due_date: form.due_date,
          tax_rate: 0,
          subtotal: total,
          tax_amount: 0,
          total,
          notes: form.notes || null,
        },
        items: items
          .filter((item) => item.description)
          .map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          })),
      });

      toast({ title: "Faktúra vytvorená" });
      navigate("/invoices");
    } catch {
      toast({ title: "Chyba pri vytváraní faktúry", variant: "destructive" });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Nová faktúra</h1>
          <p className="mt-1 text-muted-foreground">Vyplňte údaje faktúry</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Základné údaje</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Číslo faktúry *</Label>
              <Input
                value={form.invoice_number}
                onChange={(e) => updateField("invoice_number", e.target.value)}
                placeholder="FV-2026-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Dátum vystavenia</Label>
              <Input
                type="date"
                value={form.issue_date}
                onChange={(e) => updateField("issue_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dátum splatnosti</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) => updateField("due_date", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Client */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Odberateľ</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Názov / Meno *</Label>
              <Input
                value={form.client_name}
                onChange={(e) => updateField("client_name", e.target.value)}
                placeholder="Firma s.r.o."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.client_email}
                onChange={(e) => updateField("client_email", e.target.value)}
                placeholder="firma@email.sk"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Adresa</Label>
              <Input
                value={form.client_address}
                onChange={(e) => updateField("client_address", e.target.value)}
                placeholder="Ulica 123, 811 01 Bratislava"
              />
            </div>
            <div className="space-y-2">
              <Label>IČO</Label>
              <Input
                value={form.client_ico}
                onChange={(e) => updateField("client_ico", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>DIČ</Label>
              <Input
                value={form.client_dic}
                onChange={(e) => updateField("client_dic", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>IČ DPH</Label>
              <Input
                value={form.client_ic_dph}
                onChange={(e) => updateField("client_ic_dph", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Položky</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1">
              <Plus className="h-3 w-3" /> Pridať
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  {index === 0 && <Label className="text-xs">Popis</Label>}
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="Popis položky"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Množstvo</Label>}
                  <Input
                    type="number"
                    step="0.001"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  {index === 0 && <Label className="text-xs">Cena/ks</Label>}
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, "unit_price", Number(e.target.value))}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-end text-sm font-medium text-foreground">
                  {(item.quantity * item.unit_price).toLocaleString("sk-SK", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </div>
                <div className="col-span-1 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="mt-4 border-t border-border pt-4 text-right">
              <div className="text-lg font-bold text-foreground">
                Celkom: {total.toLocaleString("sk-SK", { style: "currency", currency: "EUR" })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Poznámky</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Poznámky k faktúre..."
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link to="/invoices">
            <Button type="button" variant="outline">Zrušiť</Button>
          </Link>
          <Button type="submit" disabled={createInvoice.isPending}>
            {createInvoice.isPending ? "Ukladám..." : "Vytvoriť faktúru"}
          </Button>
        </div>
      </form>
    </div>
  );
}
