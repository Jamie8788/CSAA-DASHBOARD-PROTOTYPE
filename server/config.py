"""Centralised configuration for the Mino Bimaadiziwin backend."""
from __future__ import annotations
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
UPLOADS_DIR = ROOT / "uploads"
DB_PATH = ROOT / "server" / "atlas.db"
COMMUNITIES_JS = ROOT / "communities-data.js"

JWT_SECRET = os.environ.get("ATLAS_JWT_SECRET", "mino-bimaadiziwin-change-me-in-prod")
JWT_ALG = "HS256"
JWT_EXPIRE_HOURS = 12

DEFAULT_ADMIN_USER = os.environ.get("ATLAS_ADMIN_USER", "admin")
DEFAULT_ADMIN_PASSWORD = os.environ.get("ATLAS_ADMIN_PASSWORD", "mino2025")

HOST = os.environ.get("ATLAS_HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", os.environ.get("ATLAS_PORT", "8000")))

CORS_ORIGINS = os.environ.get("ATLAS_CORS_ORIGINS", "*").split(",")

# DATABASE_URL: when set (Railway / Supabase Postgres), the server uses
# Postgres via SQLAlchemy. When empty, it falls back to local SQLite.
# Supabase format:  postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres
# Railway format:   postgresql://postgres:<password>@<host>.railway.app:5432/railway
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

# Optional outbound email for password resets etc. If none of these are set,
# the password reset link is returned in the API response so an admin can
# share it manually.
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "").strip()
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@mino.local").strip()

# Public base URL for password-reset links (Railway / Hostinger / local).
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
