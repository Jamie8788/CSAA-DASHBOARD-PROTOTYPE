"""Mino Bimaadiziwin Atlas — backend server.

Run from the repo root:

    pip install -r server/requirements.txt
    python -m server.main            # or: uvicorn server.main:app --reload

Endpoints
=========
GET  /api/health
POST /api/auth/login              (form: username, password)
POST /api/auth/logout
GET  /api/auth/me
GET  /api/users                   (admin)
POST /api/users                   (admin) — body: {username, password, role}
DELETE /api/users/{username}      (admin)
POST /api/users/{username}/password  (admin) — body: {password}

GET  /api/communities             — current dataset (records[])
POST /api/communities/upload      (admin) — multipart file
POST /api/communities/{id}/edit   (admin) — body: partial record
DELETE /api/communities/{id}      (admin)
GET  /api/communities/edits       — merged edits
GET  /api/communities/versions    — dataset version history
POST /api/communities/versions/{v}/activate (admin)

GET  /api/analytics/overview
GET  /api/analytics/pillars
GET  /api/analytics/gaps
GET  /api/analytics/population
GET  /api/analytics/keywords
GET  /api/analytics/clusters?k=5
GET  /api/analytics/coverage
GET  /api/analytics/quality
GET  /api/analytics/full

Plus static file serving for the dashboard at `/` and the CMS at `/cms`.
"""
from __future__ import annotations
import shutil
import sys
import uuid
from pathlib import Path

from fastapi import (
    FastAPI, HTTPException, UploadFile, File, Form, Depends, Request, Response, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import analytics, auth, config, db, processor


app = FastAPI(
    title="Mino Bimaadiziwin Community Atlas API",
    version="1.0.0",
    description="Backend for the Community Services Atlas dashboard.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------------- bootstrap ---------------------------------- #

@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    # Seed dataset from communities-data.js if DB has none yet.
    if db.current_dataset() is None:
        records = processor.load_initial_records()
        if records:
            db.save_dataset(records, source_filename="communities-data.js (seed)",
                            uploaded_by="system")
            db.log_audit("system", "seed", "dataset",
                         f"Seeded {len(records)} records from communities-data.js")


# ----------------------------- schemas ------------------------------------ #

class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserIn(BaseModel):
    username: str = Field(min_length=2, max_length=80)
    password: str = Field(min_length=4, max_length=200)
    role: str = "admin"


class PasswordIn(BaseModel):
    password: str = Field(min_length=4, max_length=200)


class EditIn(BaseModel):
    fields: dict = Field(default_factory=dict)
    staff: list | None = None
    departments: list | None = None


class SettingsIn(BaseModel):
    values: dict


class PageIn(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    visible: bool = True


# ------------------------------ health ------------------------------------ #

@app.get("/api/health")
def health() -> dict:
    ds = db.current_dataset()
    return {
        "status": "ok",
        "version": app.version,
        "dataset": {
            "loaded": ds is not None,
            "records": ds["record_count"] if ds else 0,
            "version": ds["version"] if ds else None,
        },
    }


# ------------------------------ auth -------------------------------------- #

@app.post("/api/auth/login", response_model=LoginOut)
def login(response: Response,
          username: str = Form(...),
          password: str = Form(...)) -> LoginOut:
    user = db.verify_user(username, password)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Bad credentials")
    token = auth.create_access_token(user["username"], user["role"])
    response.set_cookie(
        "atlas_token", token,
        httponly=True, samesite="lax",
        max_age=config.JWT_EXPIRE_HOURS * 3600,
    )
    db.log_audit(user["username"], "login")
    return LoginOut(access_token=token, user=user)


@app.post("/api/auth/logout")
def logout(response: Response, user: dict = Depends(auth.optional_user)) -> dict:
    response.delete_cookie("atlas_token")
    if user:
        db.log_audit(user.get("username"), "logout")
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: dict = Depends(auth.get_current_user)) -> dict:
    return user


# ------------------------------ users ------------------------------------- #

@app.get("/api/users")
def users_list(_: dict = Depends(auth.require_admin)) -> dict:
    return {"users": db.list_users()}


@app.post("/api/users", status_code=201)
def users_create(payload: UserIn, actor: dict = Depends(auth.require_admin)) -> dict:
    try:
        u = db.create_user(payload.username, payload.password, payload.role)
    except Exception as e:
        raise HTTPException(400, f"Could not create user: {e}")
    db.log_audit(actor["username"], "user.create", payload.username)
    return u


@app.delete("/api/users/{username}")
def users_delete(username: str, actor: dict = Depends(auth.require_admin)) -> dict:
    if username == actor["username"]:
        raise HTTPException(400, "Cannot delete yourself")
    ok = db.delete_user(username)
    if not ok:
        raise HTTPException(404, "User not found")
    db.log_audit(actor["username"], "user.delete", username)
    return {"ok": True}


@app.post("/api/users/{username}/password")
def users_change_password(username: str, payload: PasswordIn,
                          actor: dict = Depends(auth.require_admin)) -> dict:
    ok = db.change_password(username, payload.password)
    if not ok:
        raise HTTPException(404, "User not found")
    db.log_audit(actor["username"], "user.password", username)
    return {"ok": True}


# ---------------------------- communities --------------------------------- #

def _build_records() -> list[dict]:
    ds = db.current_dataset()
    base = ds["records"] if ds else []
    edits = db.latest_edits()
    enriched = processor.enrich(base)
    if not edits:
        return enriched
    out = []
    for r in enriched:
        cid = r.get("id")
        if cid and cid in edits:
            patch = edits[cid]
            merged = {**r, **{k: v for k, v in patch.items()
                              if k not in ("staff", "departments")}}
            if "staff" in patch:
                merged["staff"] = patch["staff"]
            if "departments" in patch:
                merged["departments"] = patch["departments"]
            # Recompute hasX flags after edits
            for key in analytics.PILLAR_KEYS + ["youth", "survivors", "connect"]:
                cap = f"has{key.capitalize()}"
                val = str(merged.get(key, "") or "").strip().lower()
                merged[cap] = val not in {"", "missing information", "needs review",
                                          "n/a", "no definite value", "duplicate record"}
            out.append(merged)
        else:
            out.append(r)
    return out


@app.get("/api/communities")
def communities_all() -> dict:
    records = _build_records()
    ds = db.current_dataset()
    return {
        "records": records,
        "count": len(records),
        "datasetVersion": ds["version"] if ds else 0,
        "datasetUploadedAt": ds["uploaded_at"] if ds else None,
        "datasetSource": ds["source_filename"] if ds else None,
    }


@app.get("/api/communities/edits")
def communities_edits(_: dict = Depends(auth.require_admin)) -> dict:
    return {"edits": db.latest_edits(), "history": db.edit_history(limit=100)}


@app.get("/api/communities/versions")
def communities_versions(_: dict = Depends(auth.require_admin)) -> dict:
    return {"versions": db.list_dataset_versions()}


@app.post("/api/communities/versions/{version}/activate")
def communities_activate(version: int, actor: dict = Depends(auth.require_admin)) -> dict:
    ok = db.activate_dataset_version(version)
    if not ok:
        raise HTTPException(404, "Version not found")
    db.log_audit(actor["username"], "dataset.activate", str(version))
    # Refresh on-disk JS file too so static dashboard sees it
    ds = db.current_dataset()
    if ds:
        processor.write_communities_js(ds["records"])
    return {"ok": True, "version": version}


@app.post("/api/communities/upload")
async def communities_upload(
    file: UploadFile = File(...),
    actor: dict = Depends(auth.require_admin),
) -> dict:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in (".xlsx", ".xls", ".csv"):
        raise HTTPException(400, "Only .xlsx, .xls, or .csv files are accepted")
    target = config.UPLOADS_DIR / f"{uuid.uuid4().hex}{suffix}"
    with target.open("wb") as f:
        shutil.copyfileobj(file.file, f)

    previous = (db.current_dataset() or {}).get("records") or []
    try:
        records = processor.process_file(target, previous=previous)
    except Exception as e:
        raise HTTPException(400, f"Processing failed: {e}")

    if not records:
        raise HTTPException(400, "No records parsed from file")

    version = db.save_dataset(records, source_filename=file.filename, uploaded_by=actor["username"])
    processor.write_communities_js(records)
    db.log_audit(actor["username"], "dataset.upload",
                 file.filename, f"v{version}, {len(records)} records")
    return {"ok": True, "version": version, "records": len(records)}


@app.post("/api/communities/{community_id}/edit")
def communities_edit(community_id: str, payload: EditIn,
                     actor: dict = Depends(auth.require_admin)) -> dict:
    merged = dict(payload.fields)
    if payload.staff is not None:
        merged["staff"] = payload.staff
    if payload.departments is not None:
        merged["departments"] = payload.departments
    edit_id = db.save_edit(community_id, merged, actor["username"])
    db.log_audit(actor["username"], "community.edit", community_id,
                 f"fields: {', '.join(merged.keys())}")
    return {"ok": True, "editId": edit_id}


@app.delete("/api/communities/{community_id}")
def communities_delete(community_id: str, actor: dict = Depends(auth.require_admin)) -> dict:
    db.save_edit(community_id, {"_deleted": True}, actor["username"])
    db.log_audit(actor["username"], "community.delete", community_id)
    return {"ok": True}


# ----------------------------- analytics ---------------------------------- #

@app.get("/api/analytics/overview")
def an_overview() -> dict:
    return analytics.overview(_build_records())


@app.get("/api/analytics/pillars")
def an_pillars() -> dict:
    return analytics.pillars_breakdown(_build_records())


@app.get("/api/analytics/gaps")
def an_gaps() -> dict:
    return analytics.gaps(_build_records())


@app.get("/api/analytics/population")
def an_population() -> dict:
    return analytics.population_distribution(_build_records())


@app.get("/api/analytics/keywords")
def an_keywords() -> dict:
    return analytics.keywords(_build_records())


@app.get("/api/analytics/clusters")
def an_clusters(k: int = 5) -> dict:
    return analytics.cluster_communities(_build_records(), n_clusters=k)


@app.get("/api/analytics/coverage")
def an_coverage() -> dict:
    return analytics.coverage_matrix(_build_records())


@app.get("/api/analytics/quality")
def an_quality() -> dict:
    return analytics.quality_report(_build_records())


@app.get("/api/analytics/full")
def an_full() -> dict:
    return analytics.full_report(_build_records())


@app.get("/api/audit")
def audit_log(_: dict = Depends(auth.require_admin), limit: int = 100) -> dict:
    return {"events": db.recent_audit(limit)}


# ----------------------------- settings ----------------------------------- #

@app.get("/api/settings")
def settings_get() -> dict:
    """Public — the dashboard reads these to customise the UI."""
    return db.get_settings()


@app.put("/api/settings")
def settings_update(payload: SettingsIn, actor: dict = Depends(auth.require_admin)) -> dict:
    db.bulk_set_settings(payload.values, actor["username"])
    db.log_audit(actor["username"], "settings.update", None,
                 f"keys: {', '.join(payload.values.keys())}")
    return db.get_settings()


# ----------------------------- pages -------------------------------------- #

@app.get("/api/pages")
def pages_list(visible_only: bool = False) -> dict:
    return {"pages": db.list_pages(only_visible=visible_only)}


@app.get("/api/pages/{slug}")
def pages_get(slug: str) -> dict:
    p = db.get_page(slug)
    if not p:
        raise HTTPException(404, "Page not found")
    return p


@app.put("/api/pages/{slug}")
def pages_upsert(slug: str, payload: PageIn,
                 actor: dict = Depends(auth.require_admin)) -> dict:
    p = db.upsert_page(payload.slug or slug, payload.title, payload.body,
                       payload.visible, actor["username"])
    db.log_audit(actor["username"], "page.upsert", payload.slug or slug)
    return p


@app.delete("/api/pages/{slug}")
def pages_delete(slug: str, actor: dict = Depends(auth.require_admin)) -> dict:
    ok = db.delete_page(slug)
    if not ok:
        raise HTTPException(404, "Page not found")
    db.log_audit(actor["username"], "page.delete", slug)
    return {"ok": True}


# --------------------------- static hosting ------------------------------- #
# Serve the dashboard files at /, the CMS at /cms.

DASHBOARD_ROOT = config.ROOT
CMS_ROOT = config.ROOT / "cms"


@app.get("/")
def root_page() -> FileResponse:
    return FileResponse(DASHBOARD_ROOT / "Community Atlas.html")


@app.get("/cms")
@app.get("/cms/")
def cms_page() -> FileResponse:
    return FileResponse(CMS_ROOT / "index.html")


# Static mounts must come after explicit routes so the index resolves first.
app.mount("/cms", StaticFiles(directory=str(CMS_ROOT), html=True), name="cms")
app.mount("/", StaticFiles(directory=str(DASHBOARD_ROOT), html=True), name="dashboard")


def run() -> None:
    import uvicorn
    uvicorn.run("server.main:app", host=config.HOST, port=config.PORT, reload=False)


if __name__ == "__main__":
    run()
