# Deployment guide — Railway + Supabase + Hostinger

This repo is set up to deploy as a **single Python service on Railway**, with **Supabase Postgres** as the database. The dashboard, CMS, and FastAPI backend all run from the same service.

For ~1,000 users this stack costs roughly **$5/month total** (Railway hobby pod) or stays on the **free tier** if your traffic is low.

---

## TL;DR — what you need to do

1. **Supabase**: create a project, copy the `Connection string (URI)`, run one SQL block.
2. **Railway**: connect this GitHub repo (already done), paste env vars below, click deploy.
3. Wait ~3 minutes. Open your Railway URL. Log in as `admin / mino2025`. Change the password.

That's it. Steps below walk through each.

---

## 1. Supabase — set up the database

### 1a. Create the project

1. Sign in at <https://supabase.com>.
2. **New project** → name it `mino-atlas` → pick a region near your users → set a strong DB password and **save it**.
3. Wait ~2 min for provisioning.

### 1b. Get the connection string

1. In the project sidebar: **Project Settings → Database**.
2. Find **Connection string** → switch to the `URI` tab.
3. Copy the string. It looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijkl.supabase.co:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the password you set in step 1a.

**This whole string** is what you'll paste as `DATABASE_URL` in Railway. Keep it safe — it's the master credential.

### 1c. (Optional) Inspect / pre-create tables

You don't *need* to run any SQL — the FastAPI server creates the schema on first boot. But if you want to verify or pre-create:

1. Supabase sidebar → **SQL editor → New query**.
2. Paste:

   ```sql
   -- The app creates these tables itself on first boot, but you can pre-create
   -- them here if you want to lock them down with Row Level Security first.

   CREATE TABLE IF NOT EXISTS users (
       id BIGSERIAL PRIMARY KEY,
       username TEXT UNIQUE NOT NULL,
       email TEXT,
       password_hash TEXT NOT NULL,
       salt TEXT NOT NULL,
       role TEXT NOT NULL DEFAULT 'admin',
       created_at DOUBLE PRECISION NOT NULL,
       last_login DOUBLE PRECISION
   );

   CREATE TABLE IF NOT EXISTS datasets (
       id BIGSERIAL PRIMARY KEY,
       version INTEGER NOT NULL,
       source_filename TEXT,
       uploaded_by TEXT,
       uploaded_at DOUBLE PRECISION NOT NULL,
       record_count INTEGER NOT NULL,
       payload TEXT NOT NULL,
       is_current INTEGER NOT NULL DEFAULT 0
   );

   CREATE TABLE IF NOT EXISTS edits (
       id BIGSERIAL PRIMARY KEY,
       community_id TEXT NOT NULL,
       payload TEXT NOT NULL,
       edited_by TEXT,
       edited_at DOUBLE PRECISION NOT NULL
   );

   CREATE TABLE IF NOT EXISTS audit_log (
       id BIGSERIAL PRIMARY KEY,
       actor TEXT, action TEXT NOT NULL, target TEXT, detail TEXT,
       at DOUBLE PRECISION NOT NULL
   );

   CREATE TABLE IF NOT EXISTS settings (
       key TEXT PRIMARY KEY, value TEXT NOT NULL,
       updated_at DOUBLE PRECISION NOT NULL, updated_by TEXT
   );

   CREATE TABLE IF NOT EXISTS pages (
       slug TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
       visible INTEGER NOT NULL DEFAULT 1,
       updated_at DOUBLE PRECISION NOT NULL, updated_by TEXT
   );

   CREATE TABLE IF NOT EXISTS workbook_snapshots (
       id BIGSERIAL PRIMARY KEY,
       dataset_id INTEGER NOT NULL,
       payload TEXT NOT NULL,
       created_at DOUBLE PRECISION NOT NULL
   );

   CREATE TABLE IF NOT EXISTS password_resets (
       id BIGSERIAL PRIMARY KEY,
       username TEXT NOT NULL, token TEXT UNIQUE NOT NULL,
       created_at DOUBLE PRECISION NOT NULL,
       expires_at DOUBLE PRECISION NOT NULL,
       used_at DOUBLE PRECISION
   );

   CREATE TABLE IF NOT EXISTS nav_items (
       id BIGSERIAL PRIMARY KEY,
       slot TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
       label TEXT NOT NULL, view TEXT NOT NULL, icon TEXT,
       visible INTEGER NOT NULL DEFAULT 1,
       updated_at DOUBLE PRECISION NOT NULL, updated_by TEXT
   );
   ```

3. Click **Run**. If it complains "table already exists", you've already deployed once — that's fine.

### 1d. (Optional) Connection pooler

For higher concurrency, Supabase exposes a **transaction pooler** on port 6543. Swap `:5432` for `:6543` in your `DATABASE_URL` and append `?pgbouncer=true` at the end. Not required at 1k users.

---

## 2. Railway — deploy the app

You said Railway already has access to your GitHub repo — great. If not: sign in to <https://railway.com>, click **New project → Deploy from GitHub repo → Jamie8788/CSAA-DASHBOARD-PROTOTYPE**.

### 2a. Set environment variables

In your Railway project: **Variables → New variable**. Paste these:

| Variable | Value | What it does |
|----------|-------|--------------|
| `DATABASE_URL` | the Supabase URI from step 1b | tells the app to use Postgres instead of SQLite |
| `ATLAS_JWT_SECRET` | any 64-char random string | signs admin session tokens. **Don't reuse the default**. Generate one: <https://www.random.org/strings/?num=1&len=64&digits=on&loweralpha=on&upperalpha=on&unique=on> |
| `ATLAS_ADMIN_PASSWORD` | a strong password | first-boot admin password (default `mino2025`) |
| `PUBLIC_BASE_URL` | `https://<your-railway-domain>` | used when generating password reset links |
| `ATLAS_CORS_ORIGINS` | `*` for testing, your domain in prod | restricts who can call the API from JS |

**Optional — only set these if you want email-based password reset to work automatically:**

| Variable | Example | Where to get it |
|----------|---------|----------------|
| `SMTP_HOST` | `smtp.resend.com` | any SMTP provider — Resend, SendGrid, Postmark, Mailgun |
| `SMTP_PORT` | `587` | usually 587 (STARTTLS) or 465 (SSL) |
| `SMTP_USER` | `resend` | provider login |
| `SMTP_PASS` | `re_…` | provider API key / password |
| `SMTP_FROM` | `Mino Atlas <noreply@yourdomain.ca>` | sender |

Without SMTP, the password reset flow still works — the reset link appears in the CMS Admin Users panel for the admin to copy/share manually.

### 2b. Deploy

Railway watches your `main` branch — every push redeploys. The first deploy:

1. Reads `nixpacks.toml` → installs Python 3.11 + `pip install -r server/requirements.txt`.
2. Runs `uvicorn server.main:app --host 0.0.0.0 --port $PORT --workers 2` (from `Procfile` / `railway.json`).
3. Health-checks `/api/health`.
4. Done — your URL works.

### 2c. Get your public URL

**Settings → Networking → Generate Domain**. You get something like `csaa-dashboard-prototype-production.up.railway.app`.

Copy that URL and paste it back into the `PUBLIC_BASE_URL` env var. Redeploy (Railway auto-redeploys when env vars change).

### 2d. Sanity check

```
https://<your-railway-url>/api/health
```

Should return:
```json
{"status":"ok","version":"1.0.0","dataset":{...}}
```

Then open:
- `https://<your-url>/` — the public dashboard
- `https://<your-url>/cms` — the admin CMS (login `admin` / whatever you set as `ATLAS_ADMIN_PASSWORD`)

**First thing to do**: log in to the CMS → **Admin users** → set your email and click *send reset link* to verify the email flow if you wired SMTP. Then create a new admin and delete the default one if you want.

---

## 3. Custom domain (optional)

Three places, depending on where you bought the domain:

### Hostinger (the user mentioned this)

1. Hostinger panel → **Domains → DNS / Nameservers → Manage DNS records**.
2. Add a `CNAME` record:
   - **Type**: `CNAME`
   - **Name**: `atlas` (or `@` for the apex, with caveats)
   - **Target**: your Railway domain (e.g. `csaa-dashboard-prototype-production.up.railway.app`)
   - **TTL**: 3600
3. In Railway: **Settings → Networking → Custom Domain → Add Domain** → `atlas.yourdomain.ca`. Railway issues a TLS cert automatically (Let's Encrypt).
4. Update `PUBLIC_BASE_URL=https://atlas.yourdomain.ca` and redeploy.

For the apex (`yourdomain.ca` without `www.`) you usually need an `ALIAS` / `ANAME` record — Hostinger calls it `CNAME flat`. If it's not available, use `www.yourdomain.ca` as `CNAME` and a 301 redirect at apex.

---

## 4. Local development

```bash
# Windows
run-server.bat

# macOS / Linux
./run-server.sh
```

Both scripts auto-create `.venv`, install deps, start uvicorn on `:8000`. They use **SQLite at `server/atlas.db`** by default. To point your local server at Supabase too, set `DATABASE_URL` in your shell first.

---

## 5. The 1,000-user question — capacity sanity check

For 1k users:

- **Database**: Supabase free tier gives 500 MB and 60 concurrent connections. The atlas's heaviest table (dataset payloads) is ~500 KB per version. You'll fit hundreds of versions before paying.
- **Backend**: a Railway hobby pod (512 MB / 1 vCPU shared) at `--workers 2` comfortably handles ~50 req/s of read-heavy traffic. The dashboard is mostly static + a single `/api/communities` call per page load.
- **Bandwidth**: Railway free tier includes ~5 GB/month. The dashboard bundle is ~500 KB compressed; first paint per user is well under 1 MB. You can serve ~5,000 unique daily users on the free tier.

You're far below any of those ceilings. The first paid tier ($5/mo Railway hobby plan) gets you persistent CPU and removes the cold-start delay — worth it once you go live.

---

## 6. Going beyond — when you outgrow this stack

- Move static assets to a CDN (Cloudflare in front of Railway is free).
- Move uploaded `.xlsx` files to Supabase Storage (currently the `uploads/` folder on the pod — ephemeral; this only matters if you depend on the raw files later, since the parsed data is in Postgres).
- Add Supabase Auth for end-user logins (if you ever need self-service accounts). Admin auth in this repo already works — Supabase Auth would only add value if you opened up registration to community members.

---

## 7. Troubleshooting

**`relation "users" does not exist`** after first deploy.
→ The app auto-creates the schema on boot. If you see this, the first DDL run was rolled back — check Railway logs for permission errors. Re-paste `DATABASE_URL` and redeploy.

**Password reset link 404s.**
→ `PUBLIC_BASE_URL` is wrong. It must be the public origin (`https://…`), no trailing slash.

**CMS shows blank page.**
→ Hard-refresh (Ctrl+Shift+R). The static asset paths are absolute (`/cms/…`); the page also works regardless of trailing slash.

**SSE / live updates not firing on Railway.**
→ Make sure your custom domain / proxy isn't buffering. Railway's default proxy passes `text/event-stream` through fine. Cloudflare in front needs **"Cache Level: Bypass"** for `/api/events`.

**Database is "out of connections".**
→ Switch to the Supabase pooler (port `6543`, append `?pgbouncer=true`). Or reduce uvicorn `--workers`.
