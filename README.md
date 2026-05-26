# Mino Bimaadiziwin · Community Services Atlas

A living atlas of community-care programming across First Nations and partner
organizations in the Algoma district and beyond.

Three pieces ship together:

| Piece | What it is | Where it lives |
|-------|-----------|----------------|
| **Dashboard** | Public-facing single-page React app: map, directory, analytics, journey game | `Community Atlas.html` (+ `*.jsx`, `styles.css`) |
| **CMS** | Separate admin panel: login, Excel upload, edit records, manage users, analytics dive | `cms/` |
| **Backend** | FastAPI server: auth, dataset versioning, Python analytics (pandas + scikit-learn), REST API, static hosting | `server/` |
| **Standalone** | Single-file HTML — no backend, no internet for data | `Community Atlas (standalone).html`, `Mino Bimaadiziwin Atlas - standalone.html` |

## Quick start (full stack)

```bash
# 1. Clone and enter the project
git clone https://github.com/Jamie8788/CSAA-DASHBOARD-PROTOTYPE.git
cd CSAA-DASHBOARD-PROTOTYPE

# 2. Run (Windows)
run-server.bat

# 2. Run (macOS / Linux)
./run-server.sh
```

That starts FastAPI on `http://localhost:8000`. Three URLs:

- **Dashboard**: <http://localhost:8000/>
- **CMS**: <http://localhost:8000/cms>
- **API docs (Swagger)**: <http://localhost:8000/docs>

Default admin login: **`admin` / `mino2025`**. Change it immediately under
**Admin users → Reset password** in the CMS.

The first time it boots, the server seeds its SQLite database from the
bundled `communities-data.js`. Every Excel upload after that is versioned and
roll-backable.

## How the pieces fit

```
                       ┌────────────────────────────┐
                       │  Excel master sheet (.xlsx)│
                       └──────────────┬─────────────┘
                                      │ upload via CMS
                                      ▼
        ┌─────────────────────────────────────────────────────────┐
        │                FastAPI backend  (server/)               │
        │  • auth (JWT)         • dataset versioning  (SQLite)    │
        │  • Excel/CSV parser   • analytics (pandas + sklearn)    │
        │  • REST API           • static hosting                  │
        └──────────────┬─────────────────────────┬────────────────┘
                       │ /api/communities        │ static
                       ▼                         ▼
              ┌────────────────┐         ┌────────────────┐
              │   Dashboard    │         │       CMS       │
              │  /  (public)   │         │ /cms  (admin)   │
              └────────────────┘         └────────────────┘
```

The dashboard, when served by the backend, fetches `/api/communities` and
uses live data. When opened as a static file (or as the bundled standalone),
it falls back to `communities-data.js` shipped in the repo.

## Backend — `server/`

FastAPI app. SQLite persistence. No external services required.

### Endpoints (selection)

```
GET  /api/health
POST /api/auth/login              (form: username, password)
POST /api/auth/logout
GET  /api/auth/me

GET  /api/users                   (admin)
POST /api/users                   (admin) — body: {username, password, role}
DELETE /api/users/{username}      (admin)
POST /api/users/{username}/password (admin)

GET  /api/communities             — current dataset (records[])
POST /api/communities/upload      (admin) — multipart .xlsx/.xls/.csv
POST /api/communities/{id}/edit   (admin) — body: { fields:{}, staff:[], departments:[] }
DELETE /api/communities/{id}      (admin)
GET  /api/communities/versions    (admin)
POST /api/communities/versions/{v}/activate (admin)

GET  /api/analytics/overview      — KPIs, coverage, completeness
GET  /api/analytics/pillars       — pillar coverage × direction/type
GET  /api/analytics/gaps          — communities with most missing pillars
GET  /api/analytics/population    — histogram + percentiles
GET  /api/analytics/keywords      — TF-IDF top terms per pillar
GET  /api/analytics/clusters?k=5  — K-means service-profile clusters
GET  /api/analytics/coverage      — direction × pillar heat-map
GET  /api/analytics/quality       — per-record completeness score
GET  /api/analytics/full          — everything above in one call

GET  /api/audit                   (admin) — recent audit log entries
```

Full OpenAPI/Swagger at `/docs` once running.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` (or `ATLAS_PORT`) | `8000` | HTTP port |
| `ATLAS_HOST` | `0.0.0.0` | Bind address |
| `ATLAS_JWT_SECRET` | random-but-static | Sign access tokens. **Set this in production.** |
| `ATLAS_ADMIN_USER` | `admin` | Default admin username on first boot |
| `ATLAS_ADMIN_PASSWORD` | `mino2025` | Default admin password on first boot |
| `ATLAS_CORS_ORIGINS` | `*` | Comma-separated allowed origins |

### State-of-the-art analytics

Powered by **pandas** + **scikit-learn**:

- **KPI overview**: total, coverage by pillar, geo coverage, completeness score
- **Pivot tables**: pillar × direction, pillar × org-type
- **TF-IDF keywords**: surfaces what makes "physical" different from "spiritual" across all communities
- **K-means clusters**: groups communities by service profile (configurable k)
- **Population stats**: histogram, percentiles, stddev
- **Gap analysis**: top 25 communities missing pillars
- **Coverage heat-map**: direction × pillar saturation
- **Per-record data quality scoring**

The CMS *Analytics* view consumes these endpoints and renders them with
**Recharts**.

## CMS — `cms/`

A separate React admin app, served at `/cms`. No build step required —
the page loads React + Babel from CDN and the JSX files directly. Tabs:

- **Analytics** — full report (charts, clusters, gaps, TF-IDF, quality)
- **Upload data** — drag-and-drop `.xlsx`/`.csv` + version history with rollback
- **Communities** — searchable table, edit drawer for every record
- **Admin users** — create / delete users, reset passwords
- **Open dashboard ↗** — pop the public dashboard in a new tab

## Excel ingestion

The same Python ETL (`tools/process_sheet.py`) is used both as a CLI and from
the server. Header-driven column detection means the script keeps working
even if columns are reordered or renamed. See `tools/README.md` for details.

### Two ways to update data

**A. Via CMS (admin):** Drop the `.xlsx` on `/cms` → instant re-parse →
versioned in DB → new dataset live in the dashboard.

**B. Via CLI (devs):** `python tools/process_sheet.py path/to/master.xlsx`
writes a fresh `communities-data.js`. Commit and push.

## Standalone (offline) mode

Open `Community Atlas (standalone).html` or
`Mino Bimaadiziwin Atlas - standalone.html` directly. Everything is inlined
— no servers, no fetches. Ship to anyone, anywhere.

The live dashboard (`Community Atlas.html`) silently falls back to the
bundled dataset if it can't reach `/api/communities`, so it also works as a
static file.

## Sacred Directions (Anishinaabe Medicine Wheel)

| Direction | Colour | Season | Medicine | Stage of life |
|-----------|--------|--------|----------|---------------|
| East · Waabanong | Yellow | Spring · Ziigwan | Tobacco · Asemaa | New beginnings |
| South · Zhaawanong | Red | Summer · Niibin | Cedar · Giizhik | Youth |
| West · Ningaabii'anong | Black | Autumn · Dagwaagin | Sage · Mashkodewashk | Adulthood |
| North · Giiwedinong | White | Winter · Biboon | Sweetgrass · Wiingashk | Elders · Wisdom |

## Deployment

### Free static-only (dashboard + standalone)

The dashboard works as a static site — push to GitHub and enable Pages.
No backend means no CMS, no upload, no live analytics.

### Full-stack (recommended)

Any host that runs Python 3.10+. Examples:

- **Render.com** — Web service, build `pip install -r server/requirements.txt`,
  start `python -m server.main`. Free tier OK for low traffic.
- **Fly.io** — `fly launch`, dockerfile auto-detected.
- **Heroku-style** — `Procfile`: `web: python -m server.main`
- **VPS / On-prem** — `run-server.sh` plus a systemd unit + nginx in front.

Set `ATLAS_JWT_SECRET` to something long and random in production.

## Repo layout

```
.
├── server/                          FastAPI backend
│   ├── main.py                       app + routes
│   ├── auth.py                       JWT helpers
│   ├── db.py                         SQLite persistence
│   ├── analytics.py                  pandas + sklearn analytics
│   ├── processor.py                  Excel/CSV ingestion
│   ├── config.py                     env-driven config
│   └── requirements.txt
├── cms/                             admin CMS (React, no build step)
│   ├── index.html
│   ├── api.js                        REST client
│   ├── app.jsx                       shell + routing
│   ├── login.jsx
│   ├── upload.jsx
│   ├── communities.jsx
│   ├── users.jsx
│   ├── analytics.jsx
│   ├── ui.jsx
│   └── cms.css
├── tools/
│   ├── process_sheet.py              CLI Excel parser
│   └── README.md
├── data/                            extracted JSON snapshots
├── uploads/                         uploaded files (gitignored)
├── Community Atlas.html             dashboard entry (talks to backend if available)
├── Community Atlas (standalone).html  single-file offline build
├── api-bridge.js                    fetches /api/communities into window.COMMUNITIES
├── app.jsx, helpers.jsx, map.jsx, …  dashboard React app
├── styles.css, animations.css       dashboard styles
├── run-server.bat / run-server.sh   start scripts
└── README.md
```

## License

MIT for the code; the community data is shared in trust with the
participating organizations. Reach out before redistributing.
