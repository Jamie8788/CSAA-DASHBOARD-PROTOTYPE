"""SQLite persistence for users, edits, audit log, and dataset versions."""
from __future__ import annotations
import sqlite3
import json
import time
import hashlib
import secrets
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from . import config


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at REAL NOT NULL,
    last_login REAL
);

CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL,
    source_filename TEXT,
    uploaded_by TEXT,
    uploaded_at REAL NOT NULL,
    record_count INTEGER NOT NULL,
    payload TEXT NOT NULL,
    is_current INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    edited_by TEXT,
    edited_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_edits_community ON edits(community_id);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT,
    action TEXT NOT NULL,
    target TEXT,
    detail TEXT,
    at REAL NOT NULL
);
"""


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000
    ).hex()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(str(config.DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        row = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()
        if row["n"] == 0:
            create_user(
                config.DEFAULT_ADMIN_USER,
                config.DEFAULT_ADMIN_PASSWORD,
                role="admin",
                conn=conn,
            )
            log_audit(
                actor="system",
                action="bootstrap",
                target=config.DEFAULT_ADMIN_USER,
                detail="Default admin created",
                conn=conn,
            )


def create_user(
    username: str,
    password: str,
    role: str = "admin",
    conn: sqlite3.Connection | None = None,
) -> dict:
    salt = secrets.token_hex(16)
    pw_hash = _hash_password(password, salt)
    own_conn = conn is None
    if own_conn:
        ctx = get_conn()
        conn = ctx.__enter__()
    try:
        conn.execute(
            "INSERT INTO users(username, password_hash, salt, role, created_at) "
            "VALUES(?,?,?,?,?)",
            (username.strip().lower(), pw_hash, salt, role, time.time()),
        )
        if own_conn:
            conn.commit()
    finally:
        if own_conn:
            ctx.__exit__(None, None, None)
    return {"username": username, "role": role}


def verify_user(username: str, password: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ?", (username.strip().lower(),)
        ).fetchone()
        if not row:
            return None
        if _hash_password(password, row["salt"]) != row["password_hash"]:
            return None
        conn.execute(
            "UPDATE users SET last_login = ? WHERE id = ?", (time.time(), row["id"])
        )
        return {"username": row["username"], "role": row["role"]}


def list_users() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT username, role, created_at, last_login FROM users ORDER BY username"
        ).fetchall()
        return [dict(r) for r in rows]


def delete_user(username: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM users WHERE username = ?", (username.strip().lower(),))
        return cur.rowcount > 0


def change_password(username: str, new_password: str) -> bool:
    salt = secrets.token_hex(16)
    pw_hash = _hash_password(new_password, salt)
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE users SET password_hash = ?, salt = ? WHERE username = ?",
            (pw_hash, salt, username.strip().lower()),
        )
        return cur.rowcount > 0


# ------------------------------ dataset ----------------------------------- #

def save_dataset(
    records: list[dict],
    source_filename: str | None,
    uploaded_by: str | None,
) -> int:
    payload = json.dumps(records, ensure_ascii=False)
    with get_conn() as conn:
        row = conn.execute("SELECT COALESCE(MAX(version), 0) AS v FROM datasets").fetchone()
        new_version = (row["v"] or 0) + 1
        conn.execute("UPDATE datasets SET is_current = 0")
        conn.execute(
            "INSERT INTO datasets(version, source_filename, uploaded_by, uploaded_at, "
            "record_count, payload, is_current) VALUES(?,?,?,?,?,?,1)",
            (new_version, source_filename, uploaded_by, time.time(), len(records), payload),
        )
        return new_version


def current_dataset() -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM datasets WHERE is_current = 1 ORDER BY uploaded_at DESC LIMIT 1"
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["records"] = json.loads(d.pop("payload"))
        return d


def list_dataset_versions() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, version, source_filename, uploaded_by, uploaded_at, "
            "record_count, is_current FROM datasets ORDER BY version DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def activate_dataset_version(version: int) -> bool:
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM datasets WHERE version = ?", (version,)).fetchone()
        if not row:
            return False
        conn.execute("UPDATE datasets SET is_current = 0")
        conn.execute("UPDATE datasets SET is_current = 1 WHERE id = ?", (row["id"],))
        return True


# ------------------------------- edits ------------------------------------ #

def save_edit(community_id: str, payload: dict, actor: str | None) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO edits(community_id, payload, edited_by, edited_at) VALUES(?,?,?,?)",
            (community_id, json.dumps(payload, ensure_ascii=False), actor, time.time()),
        )
        return cur.lastrowid


def latest_edits() -> dict[str, dict]:
    """Return the merged latest edit per community."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT community_id, payload, edited_at FROM edits ORDER BY edited_at ASC"
        ).fetchall()
        merged: dict[str, dict] = {}
        for r in rows:
            try:
                p = json.loads(r["payload"])
            except json.JSONDecodeError:
                continue
            merged.setdefault(r["community_id"], {}).update(p)
        return merged


def edit_history(community_id: str | None = None, limit: int = 200) -> list[dict]:
    with get_conn() as conn:
        if community_id:
            rows = conn.execute(
                "SELECT * FROM edits WHERE community_id = ? ORDER BY edited_at DESC LIMIT ?",
                (community_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM edits ORDER BY edited_at DESC LIMIT ?", (limit,)
            ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            try:
                d["payload"] = json.loads(d["payload"])
            except json.JSONDecodeError:
                d["payload"] = {}
            out.append(d)
        return out


# ------------------------------ audit ------------------------------------- #

def log_audit(
    actor: str | None,
    action: str,
    target: str | None = None,
    detail: str | None = None,
    conn: sqlite3.Connection | None = None,
) -> None:
    own_conn = conn is None
    if own_conn:
        ctx = get_conn()
        conn = ctx.__enter__()
    try:
        conn.execute(
            "INSERT INTO audit_log(actor, action, target, detail, at) VALUES(?,?,?,?,?)",
            (actor, action, target, detail, time.time()),
        )
        if own_conn:
            conn.commit()
    finally:
        if own_conn:
            ctx.__exit__(None, None, None)


def recent_audit(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM audit_log ORDER BY at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
