"""Persistence layer — works on SQLite (local) AND Postgres (Supabase / Railway).

Selection is driven by `DATABASE_URL`:
  - empty / unset   → SQLite at server/atlas.db
  - postgres://...  → Postgres (Supabase or Railway)

All SQL uses SQLAlchemy `text()` with named parameters so it runs on both.
"""
from __future__ import annotations
import hashlib
import json
import secrets
import time
from contextlib import contextmanager
from typing import Any, Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from . import config


# ----------------------------- engine ------------------------------------- #

def _make_engine() -> Engine:
    url = config.DATABASE_URL
    if not url:
        url = f"sqlite:///{config.DB_PATH}"
    else:
        # SQLAlchemy doesn't accept the bare `postgres://` scheme; normalise it.
        if url.startswith("postgres://"):
            url = "postgresql+psycopg://" + url[len("postgres://"):]
        elif url.startswith("postgresql://") and "+psycopg" not in url:
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(url, pool_pre_ping=True, future=True, connect_args=connect_args)


ENGINE: Engine = _make_engine()
IS_POSTGRES = ENGINE.url.get_backend_name().startswith("postgresql")


def _autoincrement_pk() -> str:
    """Return the right primary-key DDL for the current backend."""
    return "BIGSERIAL PRIMARY KEY" if IS_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"


def _bool_default(default: bool) -> str:
    """Default literal for a boolean-as-integer column."""
    return "TRUE" if IS_POSTGRES and False else ("1" if default else "0")


def _ddl() -> list[str]:
    pk = _autoincrement_pk()
    return [
        f"""CREATE TABLE IF NOT EXISTS users (
            id {pk},
            username TEXT UNIQUE NOT NULL,
            email TEXT,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'admin',
            created_at DOUBLE PRECISION NOT NULL,
            last_login DOUBLE PRECISION
        )""",
        f"""CREATE TABLE IF NOT EXISTS datasets (
            id {pk},
            version INTEGER NOT NULL,
            source_filename TEXT,
            uploaded_by TEXT,
            uploaded_at DOUBLE PRECISION NOT NULL,
            record_count INTEGER NOT NULL,
            payload TEXT NOT NULL,
            is_current INTEGER NOT NULL DEFAULT 0
        )""",
        f"""CREATE TABLE IF NOT EXISTS edits (
            id {pk},
            community_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            edited_by TEXT,
            edited_at DOUBLE PRECISION NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS idx_edits_community ON edits(community_id)",
        f"""CREATE TABLE IF NOT EXISTS audit_log (
            id {pk},
            actor TEXT,
            action TEXT NOT NULL,
            target TEXT,
            detail TEXT,
            at DOUBLE PRECISION NOT NULL
        )""",
        """CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DOUBLE PRECISION NOT NULL,
            updated_by TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS pages (
            slug TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            visible INTEGER NOT NULL DEFAULT 1,
            updated_at DOUBLE PRECISION NOT NULL,
            updated_by TEXT
        )""",
        f"""CREATE TABLE IF NOT EXISTS workbook_snapshots (
            id {pk},
            dataset_id INTEGER NOT NULL,
            payload TEXT NOT NULL,
            created_at DOUBLE PRECISION NOT NULL
        )""",
        "CREATE INDEX IF NOT EXISTS idx_snapshots_dataset ON workbook_snapshots(dataset_id)",
        f"""CREATE TABLE IF NOT EXISTS password_resets (
            id {pk},
            username TEXT NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at DOUBLE PRECISION NOT NULL,
            expires_at DOUBLE PRECISION NOT NULL,
            used_at DOUBLE PRECISION
        )""",
        "CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token)",
        f"""CREATE TABLE IF NOT EXISTS nav_items (
            id {pk},
            slot TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            label TEXT NOT NULL,
            view TEXT NOT NULL,
            icon TEXT,
            visible INTEGER NOT NULL DEFAULT 1,
            updated_at DOUBLE PRECISION NOT NULL,
            updated_by TEXT
        )""",
        "CREATE INDEX IF NOT EXISTS idx_nav_slot ON nav_items(slot, position)",
        """CREATE TABLE IF NOT EXISTS layouts (
            name TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at DOUBLE PRECISION NOT NULL,
            updated_by TEXT
        )""",
        """CREATE TABLE IF NOT EXISTS element_styles (
            selector TEXT PRIMARY KEY,
            properties TEXT NOT NULL,
            custom_css TEXT,
            updated_at DOUBLE PRECISION NOT NULL,
            updated_by TEXT
        )""",
        f"""CREATE TABLE IF NOT EXISTS media (
            id {pk},
            filename TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            alt_text TEXT,
            content_b64 TEXT NOT NULL,
            uploaded_at DOUBLE PRECISION NOT NULL,
            uploaded_by TEXT
        )""",
        "CREATE INDEX IF NOT EXISTS idx_media_uploaded ON media(uploaded_at)",
        f"""CREATE TABLE IF NOT EXISTS submissions (
            id {pk},
            form_slug TEXT NOT NULL,
            payload TEXT NOT NULL,
            visitor_ip TEXT,
            visitor_ua TEXT,
            received_at DOUBLE PRECISION NOT NULL,
            read_at DOUBLE PRECISION,
            notes TEXT
        )""",
        "CREATE INDEX IF NOT EXISTS idx_subs_form ON submissions(form_slug, received_at)",
    ]


DEFAULT_SETTINGS = {
    "site.title": "Mino Bimaadiziwin · Community Services Atlas",
    "site.tagline": "A living atlas of community-care programming across First Nations and partner organizations.",
    "site.heroEyebrow": "Mino Bimaadiziwin",
    "site.heroTitle": "A living atlas of community care.",
    "site.heroSubtitleLead": "Find",
    "site.heroSubtitleTrail": "programming across {communities} First Nations and {partners} partner organizations.",
    "site.statCommunitiesLabel": "Communities",
    "site.statPartnersLabel": "Partners",
    "site.statPeopleLabel": "People",
    "site.theme": "paper",
    "site.accent": "#b8351e",
    "site.elderModeDefault": "false",
    "site.showJourneyGame": "true",
    "site.showStoriesView": "true",
    "site.showAnalyticsView": "true",
    "site.showCoverageView": "true",
    "admin.allowSelfSignup": "false",
    # SEO
    "site.metaDescription": "A living atlas of community-care programming across First Nations and partner organizations.",
    "site.metaKeywords":    "First Nations, community care, atlas, services, programs",
    "site.metaAuthor":      "Mino Bimaadiziwin project team",
    "site.ogImage":         "",
    "site.canonicalUrl":    "",
    "site.twitterCard":     "summary_large_image",
    "site.robotsAllow":     "true",
}

DEFAULT_PAGES = [
    {
        "slug": "intro",
        "title": "About this atlas",
        "body": (
            "The Mino Bimaadiziwin (Good Life) Community Services Atlas maps "
            "community-care programming across First Nations and partner "
            "organizations. Filter by Sacred Direction, service pillar, or "
            "population — every view stays in sync."
        ),
    },
    {
        "slug": "acknowledgement",
        "title": "Land acknowledgement",
        "body": (
            "We acknowledge that this work takes place on the traditional "
            "territories of Anishinaabe, Cree, and Métis peoples. We honour "
            "the knowledge keepers, past and present, who guide this work."
        ),
    },
    {
        "slug": "contact",
        "title": "Contact",
        "body": "For corrections, additions, or partnership inquiries, reach the project team via your community liaison.",
    },
    {
        "slug": "map-intro",
        "title": "About the map",
        "body": "Pan and zoom to explore. Click a marker for the full community detail drawer. Filters on the left apply to the map, the directory and the analytics.",
    },
    {
        "slug": "directory-intro",
        "title": "About the directory",
        "body": "The directory mirrors the map. Sort by name, population, or how fully documented a community is. Click any card to open its full record.",
    },
]


DEFAULT_NAV = [
    {"slot": "main", "position": 0, "label": "Map · Search", "view": "map", "icon": "◉", "visible": 1},
    {"slot": "main", "position": 1, "label": "Directory", "view": "list", "icon": "☷", "visible": 1},
    {"slot": "main", "position": 2, "label": "Community Stories", "view": "stories", "icon": "❋", "visible": 1},
    {"slot": "main", "position": 3, "label": "Analytics", "view": "analytics", "icon": "◐", "visible": 1},
    {"slot": "main", "position": 4, "label": "Insights & Stories", "view": "stats", "icon": "◭", "visible": 1},
    {"slot": "main", "position": 5, "label": "Coverage (85)", "view": "coverage", "icon": "⌧", "visible": 1},
]


# Layout = ordered list of blocks rendered above (header) or below (footer) the
# view-switched main content area. Each block has:
#   id       — stable handle
#   type     — what to render: 'banner', 'admin-bar', 'a11y-panel', 'hero',
#              'page' (props.slug), 'spacer', 'html' (props.html)
#   visible  — show/hide flag
#   props    — type-specific extras
DEFAULT_LAYOUTS = {
    "header": [
        {"id": "h-banner", "type": "banner",     "visible": True, "props": {}},
        {"id": "h-admin",  "type": "admin-bar",  "visible": True, "props": {}},
        {"id": "h-a11y",   "type": "a11y-panel", "visible": True, "props": {}},
        {"id": "h-hero",   "type": "hero",       "visible": True, "props": {}},
    ],
    "footer": [
        {"id": "f-ack",     "type": "page", "visible": True, "props": {"slug": "acknowledgement"}},
        {"id": "f-contact", "type": "page", "visible": True, "props": {"slug": "contact"}},
    ],
    # Per-view layouts — each main tab can have its own header/footer content.
    # Default empty so existing dashboards behave the same; admins add custom
    # text/heading/image/columns blocks via the CMS Page Builder.
    "view.map.header":      [],
    "view.map.footer":      [],
    "view.list.header":     [],
    "view.list.footer":     [],
    "view.stories.header":  [],
    "view.stories.footer":  [],
    "view.stats.header":    [],
    "view.stats.footer":    [],
    "view.coverage.header": [],
    "view.coverage.footer": [],
}


# --------------------------- low-level helpers ---------------------------- #

@contextmanager
def get_conn() -> Iterator[Any]:
    """Yield a transactional connection (auto-commit / rollback on exit)."""
    with ENGINE.begin() as conn:
        yield conn


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000
    ).hex()


def _rows(result) -> list[dict]:
    return [dict(r._mapping) for r in result]


def _row(result) -> dict | None:
    r = result.first()
    return dict(r._mapping) if r else None


# ----------------------------- init --------------------------------------- #

def _try_alter(conn, stmt: str) -> None:
    """Run an ALTER that may fail if the column/index already exists.

    On Postgres a failed statement poisons the entire transaction, so we wrap
    this in a SAVEPOINT (begin_nested) — the rollback only undoes the failed
    sub-statement, leaving the outer transaction intact. SQLite also supports
    SAVEPOINTs so the same code path works on both backends.
    """
    sp = conn.begin_nested()
    try:
        conn.execute(text(stmt))
        sp.commit()
    except Exception:
        sp.rollback()


def init_db() -> None:
    if not IS_POSTGRES:
        config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        for stmt in _ddl():
            conn.execute(text(stmt))
        # ---- migrations for older databases ----
        _try_alter(conn, "ALTER TABLE users ADD COLUMN email TEXT")

        n = conn.execute(text("SELECT COUNT(*) AS n FROM users")).scalar()
        if (n or 0) == 0:
            _insert_user(
                conn,
                config.DEFAULT_ADMIN_USER,
                config.DEFAULT_ADMIN_PASSWORD,
                role="admin",
                email=None,
            )
            _log_audit(conn, "system", "bootstrap",
                       config.DEFAULT_ADMIN_USER, "Default admin created")

        now = time.time()
        for k, v in DEFAULT_SETTINGS.items():
            conn.execute(
                text("INSERT INTO settings(key, value, updated_at, updated_by) "
                     "VALUES(:k,:v,:u,:b) ON CONFLICT (key) DO NOTHING"),
                {"k": k, "v": v, "u": now, "b": "system"},
            )
        for p in DEFAULT_PAGES:
            conn.execute(
                text("INSERT INTO pages(slug, title, body, visible, updated_at, updated_by) "
                     "VALUES(:s,:t,:bd,1,:u,:by) ON CONFLICT (slug) DO NOTHING"),
                {"s": p["slug"], "t": p["title"], "bd": p["body"],
                 "u": now, "by": "system"},
            )
        # Seed nav items only if table is empty.
        count = conn.execute(text("SELECT COUNT(*) AS n FROM nav_items")).scalar()
        if (count or 0) == 0:
            for n in DEFAULT_NAV:
                conn.execute(
                    text("INSERT INTO nav_items(slot, position, label, view, icon, visible, "
                         "updated_at, updated_by) VALUES(:slot,:pos,:lbl,:view,:icon,1,:u,:by)"),
                    {"slot": n["slot"], "pos": n["position"], "lbl": n["label"],
                     "view": n["view"], "icon": n["icon"], "u": now, "by": "system"},
                )
        # Migration — add Analytics nav item if it doesn't exist yet (for
        # databases that were seeded before the Analytics tab was added).
        rows = conn.execute(text("SELECT view FROM nav_items WHERE slot = 'main'")).fetchall()
        existing_views = {r[0] for r in rows}
        if "analytics" not in existing_views:
            # Bump positions 3+ to make room, then insert at position 3.
            conn.execute(text(
                "UPDATE nav_items SET position = position + 1 "
                "WHERE slot = 'main' AND position >= 3"
            ))
            conn.execute(
                text("INSERT INTO nav_items(slot, position, label, view, icon, visible, "
                     "updated_at, updated_by) "
                     "VALUES('main', 3, 'Analytics', 'analytics', '◐', 1, :u, 'migration')"),
                {"u": now},
            )

        # Migration — clean settings that got polluted by the old textContent
        # bug (where CMS bind-tag text got concatenated into saved values).
        # Detect by the literal "setting:" substring inside the value.
        polluted = conn.execute(
            text("SELECT key, value FROM settings WHERE value LIKE '%setting:%'")
        ).fetchall()
        for k, v in polluted:
            default = DEFAULT_SETTINGS.get(k)
            if default is not None:
                conn.execute(
                    text("UPDATE settings SET value = :v, updated_at = :u, "
                         "updated_by = 'migration' WHERE key = :k"),
                    {"v": default, "u": now, "k": k},
                )

        # Migration — heal hero* and stat label settings that were saved as
        # empty / whitespace strings (caused the hero title to vanish on the
        # public site). Reset every site.hero* and site.stat* key that's
        # empty after trim() back to its DEFAULT_SETTINGS value.
        all_settings = conn.execute(text("SELECT key, value FROM settings")).fetchall()
        for k, v in all_settings:
            if not (k.startswith("site.hero") or k.startswith("site.stat") or k == "site.title"):
                continue
            if (v or "").strip():
                continue
            default = DEFAULT_SETTINGS.get(k)
            if default:
                conn.execute(
                    text("UPDATE settings SET value = :v, updated_at = :u, "
                         "updated_by = 'migration' WHERE key = :k"),
                    {"v": default, "u": now, "k": k},
                )

        # Migration — recursively scan element_styles for invisibility traps:
        # ANY property anywhere in the nested {state:{breakpoint:{props}}} tree
        # whose value would hide the element. Caught patterns include:
        #   color/backgroundColor: transparent or paper colours
        #   opacity: 0 (or very near 0)
        #   display: none
        #   visibility: hidden / collapse
        #   fontSize: 0 / 0px / 0em / 0rem
        #   width: 0 / 0px
        #   height: 0 / 0px
        #   transform: scale(0)
        #   transform: translate(>1000px, …) — pushes off-screen
        try:
            import re as _re
            DANGER_COLORS = {
                "transparent", "#fff", "#ffffff", "white",
                "#f5ede0", "#fbf7ec", "#fbf6ec",
                "#ece2cf", "#ddd0b5", "#e8dcc1",
                "#fff8dc", "#faf0e6", "#fff5ee",
            }
            ZERO_SIZES = {"0", "0px", "0em", "0rem", "0%"}

            def is_dangerous_property(key, value):
                if not isinstance(value, str):
                    return False
                v = value.strip().lower()
                if key in ("color", "backgroundColor"):
                    return v in DANGER_COLORS
                if key == "opacity":
                    try:
                        return float(v) <= 0.05
                    except ValueError:
                        return False
                if key == "display":
                    return v == "none"
                if key == "visibility":
                    return v in ("hidden", "collapse")
                if key in ("fontSize", "width", "height"):
                    return v in ZERO_SIZES
                if key == "transform":
                    flat = v.replace(" ", "")
                    if "scale(0)" in flat or "scale(0," in flat or "scale(0," in flat:
                        return True
                    # translate(Xpx, Ypx) with X or Y outside ±2000px = off-screen
                    for m in _re.finditer(r"translate(?:x|y|)?\(([-\d., %a-z]+)\)", flat):
                        nums = _re.findall(r"-?\d+(?:\.\d+)?", m.group(1))
                        for n in nums:
                            try:
                                if abs(float(n)) > 2000:
                                    return True
                            except ValueError:
                                pass
                return False

            def has_invisibility_trap(obj):
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        if is_dangerous_property(k, v):
                            return True
                        if isinstance(v, (dict, list)) and has_invisibility_trap(v):
                            return True
                elif isinstance(obj, list):
                    for x in obj:
                        if has_invisibility_trap(x):
                            return True
                return False

            rows = conn.execute(text(
                "SELECT selector, properties, custom_css FROM element_styles"
            )).fetchall()
            for sel, props_json, custom in rows:
                try:
                    props = json.loads(props_json or "{}")
                except json.JSONDecodeError:
                    props = {}
                bad = has_invisibility_trap(props)
                # Also flag custom_css that contains color: transparent / paper
                if not bad and custom:
                    low = str(custom).lower().replace(" ", "")
                    bad_patterns = [
                        "color:transparent", "color:#fff", "color:white",
                        "color:#f5ede0", "color:#fbf7ec", "color:#fbf6ec",
                        "opacity:0;", "opacity:0}",
                        "display:none", "visibility:hidden", "visibility:collapse",
                        "font-size:0", "width:0;", "height:0;",
                        "transform:scale(0)",
                    ]
                    if any(p in low for p in bad_patterns):
                        bad = True
                if bad:
                    conn.execute(
                        text("DELETE FROM element_styles WHERE selector = :s"),
                        {"s": sel},
                    )
        except Exception as e:
            print(f"[db migration] style cleanup skipped: {e}")
        # Seed layouts only if missing.
        for name, blocks in DEFAULT_LAYOUTS.items():
            conn.execute(
                text("INSERT INTO layouts(name, payload, updated_at, updated_by) "
                     "VALUES(:n,:p,:u,:by) ON CONFLICT (name) DO NOTHING"),
                {"n": name, "p": json.dumps(blocks), "u": now, "by": "system"},
            )


# ----------------------------- users -------------------------------------- #

def _insert_user(conn, username: str, password: str, role: str = "admin",
                 email: str | None = None) -> None:
    salt = secrets.token_hex(16)
    pw_hash = _hash_password(password, salt)
    conn.execute(
        text("INSERT INTO users(username, email, password_hash, salt, role, created_at) "
             "VALUES(:u,:e,:h,:s,:r,:c)"),
        {"u": username.strip().lower(), "e": (email or None),
         "h": pw_hash, "s": salt, "r": role, "c": time.time()},
    )


def create_user(username: str, password: str, role: str = "admin",
                email: str | None = None) -> dict:
    with get_conn() as conn:
        _insert_user(conn, username, password, role, email)
    return {"username": username.strip().lower(), "role": role, "email": email}


def verify_user(username: str, password: str) -> dict | None:
    with get_conn() as conn:
        r = _row(conn.execute(
            text("SELECT * FROM users WHERE username = :u"),
            {"u": username.strip().lower()},
        ))
        if not r:
            return None
        if _hash_password(password, r["salt"]) != r["password_hash"]:
            return None
        conn.execute(
            text("UPDATE users SET last_login = :t WHERE id = :id"),
            {"t": time.time(), "id": r["id"]},
        )
        return {"username": r["username"], "role": r["role"], "email": r["email"]}


def get_user(username: str) -> dict | None:
    with get_conn() as conn:
        r = _row(conn.execute(
            text("SELECT username, email, role, created_at, last_login FROM users WHERE username = :u"),
            {"u": username.strip().lower()},
        ))
        return r


def list_users() -> list[dict]:
    with get_conn() as conn:
        return _rows(conn.execute(
            text("SELECT username, email, role, created_at, last_login FROM users ORDER BY username")
        ))


def delete_user(username: str) -> bool:
    with get_conn() as conn:
        result = conn.execute(
            text("DELETE FROM users WHERE username = :u"),
            {"u": username.strip().lower()},
        )
        return result.rowcount > 0


def change_password(username: str, new_password: str) -> bool:
    salt = secrets.token_hex(16)
    pw_hash = _hash_password(new_password, salt)
    with get_conn() as conn:
        result = conn.execute(
            text("UPDATE users SET password_hash = :h, salt = :s WHERE username = :u"),
            {"h": pw_hash, "s": salt, "u": username.strip().lower()},
        )
        return result.rowcount > 0


def set_user_email(username: str, email: str | None) -> bool:
    with get_conn() as conn:
        result = conn.execute(
            text("UPDATE users SET email = :e WHERE username = :u"),
            {"e": email, "u": username.strip().lower()},
        )
        return result.rowcount > 0


# ----------------------- password reset tokens ---------------------------- #

def create_reset_token(username: str, ttl_seconds: int = 3600) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    with get_conn() as conn:
        conn.execute(
            text("INSERT INTO password_resets(username, token, created_at, expires_at) "
                 "VALUES(:u,:t,:c,:e)"),
            {"u": username.strip().lower(), "t": token,
             "c": now, "e": now + ttl_seconds},
        )
    return token


def consume_reset_token(token: str) -> str | None:
    """Validate + mark used. Returns the username on success."""
    now = time.time()
    with get_conn() as conn:
        r = _row(conn.execute(
            text("SELECT * FROM password_resets WHERE token = :t"),
            {"t": token},
        ))
        if not r:
            return None
        if r.get("used_at"):
            return None
        if (r.get("expires_at") or 0) < now:
            return None
        conn.execute(
            text("UPDATE password_resets SET used_at = :u WHERE id = :id"),
            {"u": now, "id": r["id"]},
        )
        return r["username"]


# ------------------------------ dataset ----------------------------------- #

def save_dataset(records: list[dict], source_filename: str | None,
                 uploaded_by: str | None, snapshot: dict | None = None) -> int:
    payload = json.dumps(records, ensure_ascii=False)
    with get_conn() as conn:
        v = conn.execute(text("SELECT COALESCE(MAX(version), 0) AS v FROM datasets")).scalar() or 0
        new_version = v + 1
        conn.execute(text("UPDATE datasets SET is_current = 0"))
        conn.execute(
            text("INSERT INTO datasets(version, source_filename, uploaded_by, uploaded_at, "
                 "record_count, payload, is_current) VALUES(:v,:s,:u,:t,:c,:p,1)"),
            {"v": new_version, "s": source_filename, "u": uploaded_by,
             "t": time.time(), "c": len(records), "p": payload},
        )
        ds_id = conn.execute(
            text("SELECT id FROM datasets WHERE version = :v"), {"v": new_version}
        ).scalar()
        if snapshot is not None and ds_id is not None:
            conn.execute(
                text("INSERT INTO workbook_snapshots(dataset_id, payload, created_at) "
                     "VALUES(:d,:p,:c)"),
                {"d": ds_id, "p": json.dumps(snapshot, ensure_ascii=False),
                 "c": time.time()},
            )
        return new_version


def current_dataset() -> dict | None:
    with get_conn() as conn:
        r = _row(conn.execute(
            text("SELECT * FROM datasets WHERE is_current = 1 ORDER BY uploaded_at DESC")
        ))
        if not r:
            return None
        r["records"] = json.loads(r.pop("payload"))
        return r


def current_snapshot() -> dict | None:
    with get_conn() as conn:
        r = _row(conn.execute(text(
            "SELECT s.payload AS payload FROM workbook_snapshots s "
            "JOIN datasets d ON s.dataset_id = d.id "
            "WHERE d.is_current = 1 ORDER BY s.created_at DESC"
        )))
        if not r:
            return None
        try:
            return json.loads(r["payload"])
        except json.JSONDecodeError:
            return None


def list_dataset_versions() -> list[dict]:
    with get_conn() as conn:
        return _rows(conn.execute(text(
            "SELECT id, version, source_filename, uploaded_by, uploaded_at, "
            "record_count, is_current FROM datasets ORDER BY version DESC"
        )))


def activate_dataset_version(version: int) -> bool:
    with get_conn() as conn:
        r = _row(conn.execute(
            text("SELECT id FROM datasets WHERE version = :v"), {"v": version}
        ))
        if not r:
            return False
        conn.execute(text("UPDATE datasets SET is_current = 0"))
        conn.execute(
            text("UPDATE datasets SET is_current = 1 WHERE id = :id"),
            {"id": r["id"]},
        )
        return True


# ------------------------------- edits ------------------------------------ #

def save_edit(community_id: str, payload: dict, actor: str | None) -> int:
    with get_conn() as conn:
        conn.execute(
            text("INSERT INTO edits(community_id, payload, edited_by, edited_at) "
                 "VALUES(:c,:p,:b,:t)"),
            {"c": community_id, "p": json.dumps(payload, ensure_ascii=False),
             "b": actor, "t": time.time()},
        )
        return conn.execute(
            text("SELECT MAX(id) AS mx FROM edits")
        ).scalar() or 0


def latest_edits() -> dict[str, dict]:
    with get_conn() as conn:
        rows = _rows(conn.execute(text(
            "SELECT community_id, payload, edited_at FROM edits ORDER BY edited_at ASC"
        )))
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
            rows = _rows(conn.execute(text(
                "SELECT * FROM edits WHERE community_id = :c ORDER BY edited_at DESC LIMIT :l"
            ), {"c": community_id, "l": limit}))
        else:
            rows = _rows(conn.execute(text(
                "SELECT * FROM edits ORDER BY edited_at DESC LIMIT :l"
            ), {"l": limit}))
    for r in rows:
        try:
            r["payload"] = json.loads(r["payload"])
        except json.JSONDecodeError:
            r["payload"] = {}
    return rows


# ------------------------------ audit ------------------------------------- #

def _log_audit(conn, actor, action, target, detail):
    conn.execute(
        text("INSERT INTO audit_log(actor, action, target, detail, at) "
             "VALUES(:a,:ac,:t,:d,:tm)"),
        {"a": actor, "ac": action, "t": target, "d": detail, "tm": time.time()},
    )


def log_audit(actor, action, target=None, detail=None):
    with get_conn() as conn:
        _log_audit(conn, actor, action, target, detail)


def recent_audit(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        return _rows(conn.execute(
            text("SELECT * FROM audit_log ORDER BY at DESC LIMIT :l"),
            {"l": limit},
        ))


# ----------------------------- settings ----------------------------------- #

def get_settings() -> dict[str, str]:
    with get_conn() as conn:
        rows = _rows(conn.execute(text("SELECT key, value FROM settings")))
    return {r["key"]: r["value"] for r in rows}


def set_setting(key: str, value: str, actor: str | None) -> None:
    with get_conn() as conn:
        conn.execute(
            text("INSERT INTO settings(key, value, updated_at, updated_by) "
                 "VALUES(:k,:v,:u,:a) ON CONFLICT(key) DO UPDATE SET "
                 "value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, "
                 "updated_by = EXCLUDED.updated_by"),
            {"k": key, "v": value, "u": time.time(), "a": actor},
        )


def bulk_set_settings(values: dict, actor: str | None) -> None:
    for k, v in values.items():
        set_setting(k, str(v), actor)


# ------------------------------- pages ------------------------------------ #

def list_pages(only_visible: bool = False) -> list[dict]:
    with get_conn() as conn:
        sql = "SELECT * FROM pages"
        if only_visible:
            sql += " WHERE visible = 1"
        sql += " ORDER BY slug"
        return _rows(conn.execute(text(sql)))


def get_page(slug: str) -> dict | None:
    with get_conn() as conn:
        return _row(conn.execute(
            text("SELECT * FROM pages WHERE slug = :s"), {"s": slug},
        ))


def upsert_page(slug: str, title: str, body: str, visible: bool, actor: str | None) -> dict:
    with get_conn() as conn:
        conn.execute(
            text("INSERT INTO pages(slug, title, body, visible, updated_at, updated_by) "
                 "VALUES(:s,:t,:b,:v,:u,:a) ON CONFLICT(slug) DO UPDATE SET "
                 "title=EXCLUDED.title, body=EXCLUDED.body, visible=EXCLUDED.visible, "
                 "updated_at=EXCLUDED.updated_at, updated_by=EXCLUDED.updated_by"),
            {"s": slug, "t": title, "b": body,
             "v": 1 if visible else 0, "u": time.time(), "a": actor},
        )
        return _row(conn.execute(
            text("SELECT * FROM pages WHERE slug = :s"), {"s": slug},
        )) or {}


def delete_page(slug: str) -> bool:
    with get_conn() as conn:
        result = conn.execute(text("DELETE FROM pages WHERE slug = :s"), {"s": slug})
        return result.rowcount > 0


# ----------------------------- nav items ---------------------------------- #

def list_nav(slot: str | None = None) -> list[dict]:
    with get_conn() as conn:
        if slot:
            return _rows(conn.execute(
                text("SELECT * FROM nav_items WHERE slot = :s ORDER BY position, id"),
                {"s": slot},
            ))
        return _rows(conn.execute(
            text("SELECT * FROM nav_items ORDER BY slot, position, id")
        ))


def upsert_nav(item: dict, actor: str | None) -> dict:
    # Build the params dict explicitly so bind names match the SQL,
    # regardless of what the caller's dict happens to be keyed by
    # (the API receives `position`/`label`/`visible`, the SQL uses
    # `:pos`/`:lbl`/`:vis`).
    params = {
        "slot": item.get("slot", "main"),
        "pos": int(item.get("position", 0)),
        "lbl": item.get("label", ""),
        "view": item.get("view", ""),
        "icon": item.get("icon"),
        "vis": 1 if item.get("visible", True) else 0,
        "u": time.time(),
        "by": actor,
    }
    with get_conn() as conn:
        if item.get("id"):
            params["id"] = item["id"]
            conn.execute(
                text("UPDATE nav_items SET slot=:slot, position=:pos, label=:lbl, "
                     "view=:view, icon=:icon, visible=:vis, updated_at=:u, updated_by=:by "
                     "WHERE id=:id"),
                params,
            )
            return _row(conn.execute(
                text("SELECT * FROM nav_items WHERE id = :id"), {"id": item["id"]}
            )) or {}
        else:
            conn.execute(
                text("INSERT INTO nav_items(slot, position, label, view, icon, visible, "
                     "updated_at, updated_by) VALUES(:slot,:pos,:lbl,:view,:icon,:vis,:u,:by)"),
                params,
            )
            new_id = conn.execute(text("SELECT MAX(id) AS mx FROM nav_items")).scalar()
            return _row(conn.execute(
                text("SELECT * FROM nav_items WHERE id = :id"), {"id": new_id}
            )) or {}


def delete_nav(nav_id: int) -> bool:
    with get_conn() as conn:
        result = conn.execute(text("DELETE FROM nav_items WHERE id = :id"), {"id": nav_id})
        return result.rowcount > 0


# ----------------------------- layouts ------------------------------------ #

def get_layout(name: str) -> list[dict]:
    with get_conn() as conn:
        row = _row(conn.execute(
            text("SELECT payload FROM layouts WHERE name = :n"), {"n": name}
        ))
        if not row:
            return DEFAULT_LAYOUTS.get(name, [])
        try:
            return json.loads(row["payload"])
        except json.JSONDecodeError:
            return DEFAULT_LAYOUTS.get(name, [])


def get_all_layouts() -> dict[str, list[dict]]:
    with get_conn() as conn:
        rows = _rows(conn.execute(text("SELECT name, payload FROM layouts")))
    out = {}
    for r in rows:
        try:
            out[r["name"]] = json.loads(r["payload"])
        except json.JSONDecodeError:
            out[r["name"]] = []
    # Make sure default layout names always present
    for n, default in DEFAULT_LAYOUTS.items():
        out.setdefault(n, default)
    return out


def save_layout(name: str, blocks: list[dict], actor: str | None) -> list[dict]:
    payload = json.dumps(blocks, ensure_ascii=False)
    with get_conn() as conn:
        conn.execute(
            text("INSERT INTO layouts(name, payload, updated_at, updated_by) "
                 "VALUES(:n,:p,:u,:by) ON CONFLICT(name) DO UPDATE SET "
                 "payload=EXCLUDED.payload, updated_at=EXCLUDED.updated_at, "
                 "updated_by=EXCLUDED.updated_by"),
            {"n": name, "p": payload, "u": time.time(), "by": actor},
        )
    return blocks


def reset_layout(name: str, actor: str | None) -> list[dict]:
    """Restore a layout to its default."""
    default = DEFAULT_LAYOUTS.get(name, [])
    return save_layout(name, default, actor)


# --------------------------- element styles ------------------------------- #
# Per-element style overrides. `selector` is a dotted key like:
#   "bind:setting:site.heroTitle"   -> [data-cms-bind="setting:site.heroTitle"]
#   "section:header:h-hero"         -> [data-cms-section="header:h-hero"]
# `properties` is a JSON object of {camelCaseProperty: value}.
# `custom_css` is a free-form CSS string scoped to the selector.

def list_styles() -> dict[str, dict]:
    with get_conn() as conn:
        rows = _rows(conn.execute(text(
            "SELECT selector, properties, custom_css FROM element_styles"
        )))
    out = {}
    for r in rows:
        try:
            props = json.loads(r["properties"] or "{}")
        except json.JSONDecodeError:
            props = {}
        out[r["selector"]] = {
            "selector": r["selector"],
            "properties": props,
            "customCss": r.get("custom_css") or "",
        }
    return out


def get_style(selector: str) -> dict | None:
    with get_conn() as conn:
        r = _row(conn.execute(
            text("SELECT selector, properties, custom_css FROM element_styles "
                 "WHERE selector = :s"), {"s": selector}
        ))
        if not r:
            return None
        try:
            props = json.loads(r["properties"] or "{}")
        except json.JSONDecodeError:
            props = {}
        return {"selector": r["selector"], "properties": props,
                "customCss": r.get("custom_css") or ""}


def save_style(selector: str, properties: dict, custom_css: str | None,
               actor: str | None) -> dict:
    payload = json.dumps(properties or {}, ensure_ascii=False)
    with get_conn() as conn:
        conn.execute(
            text("INSERT INTO element_styles(selector, properties, custom_css, "
                 "updated_at, updated_by) VALUES(:s,:p,:c,:u,:by) "
                 "ON CONFLICT(selector) DO UPDATE SET "
                 "properties=EXCLUDED.properties, custom_css=EXCLUDED.custom_css, "
                 "updated_at=EXCLUDED.updated_at, updated_by=EXCLUDED.updated_by"),
            {"s": selector, "p": payload, "c": custom_css or "",
             "u": time.time(), "by": actor},
        )
    return {"selector": selector, "properties": properties or {}, "customCss": custom_css or ""}


def delete_style(selector: str) -> bool:
    with get_conn() as conn:
        result = conn.execute(
            text("DELETE FROM element_styles WHERE selector = :s"),
            {"s": selector},
        )
        return result.rowcount > 0


# ------------------------------ media ------------------------------------- #

def save_media(filename: str, mime_type: str, content_b64: str,
               size_bytes: int, alt_text: str | None, actor: str | None) -> dict:
    with get_conn() as conn:
        conn.execute(
            text("INSERT INTO media(filename, mime_type, size_bytes, alt_text, "
                 "content_b64, uploaded_at, uploaded_by) "
                 "VALUES(:f,:m,:s,:a,:c,:t,:by)"),
            {"f": filename, "m": mime_type, "s": size_bytes,
             "a": alt_text, "c": content_b64, "t": time.time(), "by": actor},
        )
        new_id = conn.execute(text("SELECT MAX(id) AS mx FROM media")).scalar()
        row = _row(conn.execute(
            text("SELECT id, filename, mime_type, size_bytes, alt_text, "
                 "uploaded_at, uploaded_by FROM media WHERE id = :id"),
            {"id": new_id},
        ))
        return row or {}


def list_media(limit: int = 200) -> list[dict]:
    with get_conn() as conn:
        return _rows(conn.execute(
            text("SELECT id, filename, mime_type, size_bytes, alt_text, "
                 "uploaded_at, uploaded_by FROM media "
                 "ORDER BY uploaded_at DESC LIMIT :l"),
            {"l": limit},
        ))


def get_media_content(media_id: int) -> dict | None:
    with get_conn() as conn:
        return _row(conn.execute(
            text("SELECT id, filename, mime_type, content_b64 FROM media "
                 "WHERE id = :id"),
            {"id": media_id},
        ))


def delete_media(media_id: int) -> bool:
    with get_conn() as conn:
        result = conn.execute(
            text("DELETE FROM media WHERE id = :id"), {"id": media_id})
        return result.rowcount > 0


# --------------------------- submissions ---------------------------------- #

def save_submission(form_slug: str, payload: dict,
                    visitor_ip: str | None, visitor_ua: str | None) -> int:
    with get_conn() as conn:
        conn.execute(
            text("INSERT INTO submissions(form_slug, payload, visitor_ip, "
                 "visitor_ua, received_at) VALUES(:s,:p,:ip,:ua,:t)"),
            {"s": form_slug, "p": json.dumps(payload, ensure_ascii=False),
             "ip": visitor_ip, "ua": visitor_ua, "t": time.time()},
        )
        return conn.execute(text("SELECT MAX(id) AS mx FROM submissions")).scalar() or 0


def list_submissions(form_slug: str | None = None, limit: int = 200) -> list[dict]:
    with get_conn() as conn:
        if form_slug:
            rows = _rows(conn.execute(
                text("SELECT * FROM submissions WHERE form_slug = :s "
                     "ORDER BY received_at DESC LIMIT :l"),
                {"s": form_slug, "l": limit},
            ))
        else:
            rows = _rows(conn.execute(
                text("SELECT * FROM submissions ORDER BY received_at DESC LIMIT :l"),
                {"l": limit},
            ))
    for r in rows:
        try:
            r["payload"] = json.loads(r["payload"])
        except json.JSONDecodeError:
            r["payload"] = {}
    return rows


def mark_submission_read(sub_id: int) -> bool:
    with get_conn() as conn:
        result = conn.execute(
            text("UPDATE submissions SET read_at = :t WHERE id = :id"),
            {"id": sub_id, "t": time.time()},
        )
        return result.rowcount > 0


def delete_submission(sub_id: int) -> bool:
    with get_conn() as conn:
        result = conn.execute(
            text("DELETE FROM submissions WHERE id = :id"), {"id": sub_id})
        return result.rowcount > 0


def submissions_summary() -> dict:
    with get_conn() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM submissions")).scalar() or 0
        unread = conn.execute(
            text("SELECT COUNT(*) FROM submissions WHERE read_at IS NULL")
        ).scalar() or 0
    return {"total": int(total), "unread": int(unread)}
