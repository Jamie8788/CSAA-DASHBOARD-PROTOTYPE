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

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
