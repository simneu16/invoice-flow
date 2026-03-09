const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BYSQUARE_API_KEY = Deno.env.get("BYSQUARE_API_KEY");
    if (!BYSQUARE_API_KEY) {
      throw new Error("BYSQUARE_API_KEY is not configured");
    }

    const body = await req.json();
    // body should contain: { iban, bic?, amount, currencyCode, variableSymbol?, beneficiaryName, paymentNote?, dueDate? }

    const normalizedIban = String(body.iban || "").replace(/\s/g, "").toUpperCase();
    const normalizedBic = String(body.bic || "").replace(/\s/g, "").toUpperCase();
    const isValidBic = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(normalizedBic);

    const paymentOptions = Array.isArray(body.paymentOptions)
      ? body.paymentOptions
      : ["paymentorder"];

    const payment: Record<string, unknown> = {
      amount: body.amount,
      currencyCode: body.currencyCode || "EUR",
      bankAccounts: [
        {
          iban: normalizedIban,
          ...(isValidBic ? { bic: normalizedBic } : {}),
        },
      ],
      beneficiaryName: body.beneficiaryName || "Prijemca",
      paymentOptions,
    };

    if (!normalizedIban) {
      throw new Error("IBAN is required");
    }

    if (body.variableSymbol) payment.variableSymbol = body.variableSymbol;
    if (body.paymentNote) payment.paymentNote = body.paymentNote;
    if (body.dueDate) payment.dueDate = body.dueDate;

    const requestBody = { payments: [payment] };

    console.log("[bysquare-qr] Calling API with:", JSON.stringify(requestBody));

    const response = await fetch("https://api.bysquare.com/generate/pay?formats=pay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": BYSQUARE_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[bysquare-qr] API error:", response.status, JSON.stringify(data));
      throw new Error(`bysquare API error [${response.status}]: ${JSON.stringify(data)}`);
    }

    console.log("[bysquare-qr] Success, image length:", data.image?.length || 0);

    return new Response(JSON.stringify({ image: data.image, payload: data.payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bysquare-qr] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
