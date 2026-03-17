import { useEffect, useState } from "react";
import { useCompanySettings, useSaveCompanySettings } from "@/hooks/use-company-settings";
import QueryErrorState from "@/components/QueryErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Building2, CreditCard, Mail, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const { data: settings, isLoading, isError, error, refetch } = useCompanySettings();
  const saveSettings = useSaveCompanySettings();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    company_name: "",
    ico: "",
    dic: "",
    ic_dph: "",
    address: "",
    city: "",
    postal_code: "",
    country: "Slovensko",
    email: "",
    phone: "",
    website: "",
    bank_name: "",
    iban: "",
    swift: "",
    logo_url: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        company_name: settings.company_name || "",
        ico: settings.ico || "",
        dic: settings.dic || "",
        ic_dph: settings.ic_dph || "",
        address: settings.address || "",
        city: settings.city || "",
        postal_code: settings.postal_code || "",
        country: settings.country || "Slovensko",
        email: settings.email || "",
        phone: settings.phone || "",
        website: settings.website || "",
        bank_name: settings.bank_name || "",
        iban: settings.iban || "",
        swift: settings.swift || "",
        logo_url: settings.logo_url || "",
      });
    }
  }, [settings]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveSettings.mutateAsync(form);
      toast({ title: "Nastavenia uložené" });
    } catch {
      toast({ title: "Chyba pri ukladaní", variant: "destructive" });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const filePath = `logos/${session.user.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-assets")
        .getPublicUrl(filePath);

      setForm((prev) => ({ ...prev, logo_url: publicUrl }));
      toast({ title: "Logo nahrané" });
    } catch (err) {
      console.error(err);
      toast({ title: "Chyba pri nahrávaní loga", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <QueryErrorState
        title="Nepodarilo sa načítať nastavenia"
        description={error instanceof Error ? error.message : "Skúste obnoviť stránku alebo skontrolovať backend pripojenie."}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Nastavenia</h1>
        <p className="mt-1 text-muted-foreground">Vaše fakturačné údaje</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" /> Firemné údaje
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="company_name">Názov firmy</Label>
              <Input id="company_name" value={form.company_name} onChange={(e) => handleChange("company_name", e.target.value)} placeholder="Moja firma s.r.o." />
            </div>
            <div>
              <Label htmlFor="ico">IČO</Label>
              <Input id="ico" value={form.ico} onChange={(e) => handleChange("ico", e.target.value)} placeholder="12345678" />
            </div>
            <div>
              <Label htmlFor="dic">DIČ</Label>
              <Input id="dic" value={form.dic} onChange={(e) => handleChange("dic", e.target.value)} placeholder="1234567890" />
            </div>
            <div>
              <Label htmlFor="ic_dph">IČ DPH</Label>
              <Input id="ic_dph" value={form.ic_dph} onChange={(e) => handleChange("ic_dph", e.target.value)} placeholder="SK1234567890" />
            </div>
          </CardContent>
        </Card>

        {/* Address & Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Adresa a kontakt
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="address">Ulica a číslo</Label>
              <Input id="address" value={form.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="Hlavná 1" />
            </div>
            <div>
              <Label htmlFor="city">Mesto</Label>
              <Input id="city" value={form.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="Bratislava" />
            </div>
            <div>
              <Label htmlFor="postal_code">PSČ</Label>
              <Input id="postal_code" value={form.postal_code} onChange={(e) => handleChange("postal_code", e.target.value)} placeholder="811 01" />
            </div>
            <div>
              <Label htmlFor="country">Krajina</Label>
              <Input id="country" value={form.country} onChange={(e) => handleChange("country", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="info@firma.sk" />
            </div>
            <div>
              <Label htmlFor="phone">Telefón</Label>
              <Input id="phone" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="+421 900 000 000" />
            </div>
            <div>
              <Label htmlFor="website">Web</Label>
              <Input id="website" value={form.website} onChange={(e) => handleChange("website", e.target.value)} placeholder="www.firma.sk" />
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" /> Bankové údaje
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="bank_name">Názov banky</Label>
              <Input id="bank_name" value={form.bank_name} onChange={(e) => handleChange("bank_name", e.target.value)} placeholder="Slovenská sporiteľňa" />
            </div>
            <div>
              <Label htmlFor="iban">IBAN</Label>
              <Input id="iban" value={form.iban} onChange={(e) => handleChange("iban", e.target.value)} placeholder="SK00 0000 0000 0000 0000 0000" />
            </div>
            <div>
              <Label htmlFor="swift">SWIFT/BIC</Label>
              <Input id="swift" value={form.swift} onChange={(e) => handleChange("swift", e.target.value)} placeholder="GIBASKBX" />
            </div>
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4" /> Logo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.logo_url && (
              <div className="flex items-center gap-4">
                <img src={form.logo_url} alt="Logo firmy" className="h-16 w-auto rounded border border-border object-contain" />
                <Button type="button" variant="outline" size="sm" onClick={() => handleChange("logo_url", "")}>
                  Odstrániť
                </Button>
              </div>
            )}
            <div>
              <Label htmlFor="logo">Nahrať logo</Label>
              <Input id="logo" type="file" accept="image/*" onChange={handleLogoUpload} disabled={uploading} className="mt-1" />
              {uploading && <p className="mt-1 text-xs text-muted-foreground">Nahráva sa...</p>}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={saveSettings.isPending} className="gap-2">
          {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Uložiť nastavenia
        </Button>
      </form>
    </div>
  );
}
