import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getSQL() {
  return postgres({
    host: Deno.env.get("MYSQL_HOST")!,
    port: Number(Deno.env.get("MYSQL_PORT") || 5432),
    database: Deno.env.get("MYSQL_DATABASE")!,
    username: Deno.env.get("MYSQL_USER")!,
    password: Deno.env.get("MYSQL_PASSWORD")!,
    ssl: false,
  });
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("No auth");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  return user;
}

async function initTables(sql: ReturnType<typeof postgres>) {
  await sql`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL,
      invoice_number VARCHAR(100) NOT NULL,
      client_name VARCHAR(255) NOT NULL,
      client_email VARCHAR(255),
      client_address TEXT,
      client_ico VARCHAR(50),
      client_dic VARCHAR(50),
      client_ic_dph VARCHAR(50),
      issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      currency VARCHAR(10) NOT NULL DEFAULT 'EUR',
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20,
      tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS company_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL UNIQUE,
      company_name VARCHAR(255),
      ico VARCHAR(50),
      dic VARCHAR(50),
      ic_dph VARCHAR(50),
      address TEXT,
      city VARCHAR(255),
      postal_code VARCHAR(20),
      country VARCHAR(100) DEFAULT 'Slovensko',
      email VARCHAR(255),
      phone VARCHAR(50),
      website VARCHAR(255),
      bank_name VARCHAR(255),
      iban VARCHAR(50),
      swift VARCHAR(20),
      logo_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS invoice_attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_url TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const sql = getSQL();

  try {
    const user = await getUser(req);
    await initTables(sql);

    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/mysql-api\/?/, "");
    const method = req.method;

    // === COMPANY SETTINGS ===

    // GET /settings
    if (method === "GET" && path === "settings") {
      const rows = await sql`
        SELECT * FROM company_settings WHERE user_id = ${user.id}
      `;
      return json(rows.length > 0 ? rows[0] : null);
    }

    // PUT /settings
    if (method === "PUT" && path === "settings") {
      const body = await req.json();
      const existing = await sql`
        SELECT id FROM company_settings WHERE user_id = ${user.id}
      `;

      if (existing.length > 0) {
        await sql`
          UPDATE company_settings SET
            company_name = ${body.company_name || null},
            ico = ${body.ico || null},
            dic = ${body.dic || null},
            ic_dph = ${body.ic_dph || null},
            address = ${body.address || null},
            city = ${body.city || null},
            postal_code = ${body.postal_code || null},
            country = ${body.country || 'Slovensko'},
            email = ${body.email || null},
            phone = ${body.phone || null},
            website = ${body.website || null},
            bank_name = ${body.bank_name || null},
            iban = ${body.iban || null},
            swift = ${body.swift || null},
            logo_url = ${body.logo_url || null},
            updated_at = NOW()
          WHERE user_id = ${user.id}
        `;
      } else {
        await sql`
          INSERT INTO company_settings (user_id, company_name, ico, dic, ic_dph, address, city, postal_code, country, email, phone, website, bank_name, iban, swift, logo_url)
          VALUES (${user.id}, ${body.company_name || null}, ${body.ico || null}, ${body.dic || null}, ${body.ic_dph || null},
            ${body.address || null}, ${body.city || null}, ${body.postal_code || null}, ${body.country || 'Slovensko'},
            ${body.email || null}, ${body.phone || null}, ${body.website || null},
            ${body.bank_name || null}, ${body.iban || null}, ${body.swift || null}, ${body.logo_url || null})
        `;
      }

      const updated = await sql`SELECT * FROM company_settings WHERE user_id = ${user.id}`;
      return json(updated[0]);
    }

    // === INVOICES ===

    // GET /invoices
    if (method === "GET" && (path === "invoices" || path === "")) {
      const invoices = await sql`
        SELECT * FROM invoices WHERE user_id = ${user.id} ORDER BY created_at DESC
      `;

      for (const inv of invoices) {
        const items = await sql`
          SELECT * FROM invoice_items WHERE invoice_id = ${inv.id}
        `;
        inv.invoice_items = items;
      }

      return json(invoices);
    }

    // GET /invoices/:id
    if (method === "GET" && path.startsWith("invoices/") && !path.includes("/status")) {
      const id = path.replace("invoices/", "");
      const invoices = await sql`
        SELECT * FROM invoices WHERE id = ${id} AND user_id = ${user.id}
      `;
      if (invoices.length === 0) return json({ error: "Not found" }, 404);

      const invoice = invoices[0];
      const items = await sql`
        SELECT * FROM invoice_items WHERE invoice_id = ${invoice.id}
      `;
      invoice.invoice_items = items;

      return json(invoice);
    }

    // POST /invoices
    if (method === "POST" && path === "invoices") {
      const body = await req.json();
      const { invoice, items } = body;
      const id = crypto.randomUUID();

      await sql`
        INSERT INTO invoices (id, user_id, invoice_number, client_name, client_email, client_address,
          client_ico, client_dic, client_ic_dph, issue_date, due_date, tax_rate, subtotal, tax_amount, total, notes, currency, status)
        VALUES (${id}, ${user.id}, ${invoice.invoice_number}, ${invoice.client_name},
          ${invoice.client_email || null}, ${invoice.client_address || null},
          ${invoice.client_ico || null}, ${invoice.client_dic || null}, ${invoice.client_ic_dph || null},
          ${invoice.issue_date}, ${invoice.due_date}, ${invoice.tax_rate || 20},
          ${invoice.subtotal || 0}, ${invoice.tax_amount || 0}, ${invoice.total || 0},
          ${invoice.notes || null}, ${invoice.currency || "EUR"}, ${invoice.status || "draft"})
      `;

      if (items && items.length > 0) {
        for (const item of items) {
          await sql`
            INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total)
            VALUES (${crypto.randomUUID()}, ${id}, ${item.description}, ${item.quantity || 1}, ${item.unit_price || 0}, ${item.total || 0})
          `;
        }
      }

      return json({ id, ...invoice });
    }

    // PATCH /invoices/:id/status
    if (method === "PATCH" && path.match(/^invoices\/[^/]+\/status$/)) {
      const id = path.split("/")[1];
      const { status } = await req.json();
      await sql`
        UPDATE invoices SET status = ${status}, updated_at = NOW() WHERE id = ${id} AND user_id = ${user.id}
      `;
      return json({ success: true });
    }

    // DELETE /invoices/:id
    if (method === "DELETE" && path.startsWith("invoices/")) {
      const id = path.replace("invoices/", "");
      await sql`
        DELETE FROM invoices WHERE id = ${id} AND user_id = ${user.id}
      `;
      return json({ success: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("PG API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, err instanceof Error && message === "Unauthorized" ? 401 : 500);
  } finally {
    await sql.end();
  }
});
