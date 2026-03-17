# 🚀 Deployment Guide — Self-hosting s vlastným Supabase

## Prehľad

Táto aplikácia používa:
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Auth + Storage**: Supabase (auth, storage bucket pre prílohy)
- **Dáta**: Externá PostgreSQL DB (db.r1.websupport.sk) cez Supabase Edge Functions
- **Edge Functions**: `mysql-api` (CRUD pre faktúry, nastavenia, prílohy) a `bysquare-qr` (QR kódy)

---

## 1. Vytvor Supabase projekt

1. Choď na [supabase.com](https://supabase.com) a vytvor nový projekt
2. Poznač si:
   - **Project URL** (napr. `https://xxxxx.supabase.co`)
   - **Anon/Public Key** (v Settings → API)
   - **Service Role Key** (v Settings → API)

---

## 2. Naklonuj repozitár

```bash
git clone https://github.com/TVOJ-USERNAME/TVOJ-REPO.git
cd TVOJ-REPO
npm install
```

---

## 3. Nainštaluj Supabase CLI

```bash
npm install -g supabase
supabase login
```

---

## 4. Pripoj sa na vlastný Supabase projekt

```bash
supabase link --project-ref TVOJ_PROJECT_REF
```

`TVOJ_PROJECT_REF` je časť z URL: `https://TVOJ_PROJECT_REF.supabase.co`

---

## 5. Nastav environment premenné

### Frontend (.env)

Vytvor/uprav `.env` v root projekte:

```env
VITE_SUPABASE_URL=https://TVOJ_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=tvoj-anon-key
VITE_SUPABASE_PROJECT_ID=TVOJ_PROJECT_REF
```

### Supabase Edge Functions secrets

V Supabase Dashboard → Settings → Edge Functions → Secrets, pridaj:

| Secret Name | Hodnota |
|---|---|
| `MYSQL_HOST` | `db.r1.websupport.sk` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_DATABASE` | `CXZQPKUg` |
| `MYSQL_USER` | `bkgHEarY` |
| `MYSQL_PASSWORD` | `NYi\`m41HMRLPB@ZSyHxU` |
| `BYSQUARE_API_KEY` | tvoj API kľúč pre bysquare.org |

Alebo cez CLI:

```bash
supabase secrets set MYSQL_HOST=db.r1.websupport.sk
supabase secrets set MYSQL_PORT=3306
supabase secrets set MYSQL_DATABASE=CXZQPKUg
supabase secrets set MYSQL_USER=bkgHEarY
supabase secrets set "MYSQL_PASSWORD=NYi\`m41HMRLPB@ZSyHxU"
supabase secrets set BYSQUARE_API_KEY=tvoj-bysquare-key
```

---

## 6. Vytvor Storage Bucket

V Supabase Dashboard → SQL Editor, spusti:

```sql
-- Vytvor bucket pre prílohy faktúr
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-attachments', 'invoice-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies pre storage
CREATE POLICY "Authenticated users can upload invoice attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'invoice-attachments');

CREATE POLICY "Authenticated users can view invoice attachments"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'invoice-attachments');

CREATE POLICY "Authenticated users can delete invoice attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'invoice-attachments');
```

---

## 7. Uprav Supabase klienta

Uprav `src/integrations/supabase/client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

> ⚠️ Odstráň `import type { Database } from './types'` ak nechceš udržiavať typy — alebo vygeneruj nové cez `supabase gen types typescript`.

---

## 8. Uprav config.toml

Súbor `supabase/config.toml` zmeň na:

```toml
[functions.mysql-api]
verify_jwt = false

[functions.bysquare-qr]
verify_jwt = false
```

Odstráň riadok `project_id = "..."` (CLI použije linked projekt).

---

## 9. Nasaď Edge Functions

```bash
supabase functions deploy mysql-api
supabase functions deploy bysquare-qr
```

---

## 10. (Voliteľné) Nastav Email Confirmation

V Supabase Dashboard → Authentication → Settings:
- Ak chceš **okamžitú registráciu** bez potvrdenia emailu: zapni "Enable auto-confirm"
- Ak chceš **email verifikáciu**: nechaj vypnuté (default)

---

## 11. Build a Deploy Frontend

### Možnosť A: Vercel (odporúčané)

1. Pripoj GitHub repo na [vercel.com](https://vercel.com)
2. Nastav Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_PROJECT_ID`
3. Build command: `npm run build`
4. Output directory: `dist`
5. V Vercel Settings → Domains pridaj vlastnú doménu

### Možnosť B: Vlastný server (Nginx)

```bash
npm run build
```

Skopíruj obsah `dist/` na server. Nginx konfig:

```nginx
server {
    listen 80;
    server_name tvoja-domena.sk;
    root /var/www/fakturacia/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 12. Vlastná doména pre Supabase (voliteľné)

Ak chceš vlastnú doménu aj pre Supabase API, nastav ju v Supabase Dashboard → Settings → Custom Domains.

---

## Zhrnutie architektúry

```
┌─────────────────────┐
│   Frontend (Vite)   │ ← Vercel / Nginx / vlastný server
│   React + Tailwind  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Supabase          │ ← Tvoj vlastný projekt
│   - Auth            │
│   - Storage         │
│   - Edge Functions  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   PostgreSQL DB     │ ← db.r1.websupport.sk
│   (Websupport)      │
│   - invoices        │
│   - invoice_items   │
│   - company_settings│
│   - attachments     │
└─────────────────────┘
```

---

## Riešenie problémov

| Problém | Riešenie |
|---|---|
| CORS error | Over, že edge functions majú správne CORS headers |
| Auth nefunguje | Over VITE_SUPABASE_URL a PUBLISHABLE_KEY v .env |
| Edge function 500 | Over secrets v Supabase Dashboard (MYSQL_*) |
| Storage upload fail | Over, že bucket existuje a má RLS policies |
| DB connection refused | Over, že Websupport DB povoluje spojenie z Supabase IP |
