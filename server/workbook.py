"""State-of-the-art multi-sheet workbook ingestion.

The master `.xlsx` has SEVEN sheets that we cross-reference:

  - 'Master Sheet'           — canonical narrative data (one row per community)
  - 'List of 85 communities' — the official list of supported communities AND
                               a second column listing communities found in the
                               Master Sheet that are NOT in the official 85
  - 'Missing Information'    — per-community, per-field WHAT is missing + why
  - 'Needs Review'           — per-community, per-field WHAT needs review
  - 'Correction sheet'       — corrections that have been applied / are queued
  - 'Additional links'       — extra organisation links (umbrella orgs)
  - 'Colour Codes'           — legend (cosmetic, skipped)

This module reads them ALL and produces:

  - records: enriched community records (same shape as tools/process_sheet.py)
  - coverage85: per-canonical-community status (in master? notes? matched-to?)
  - annotations: per-community-per-field missing/review/correction items
  - workbookMeta: which sheets we found, how many rows each, etc.

If a workbook only has a single sheet (the legacy format), everything still
works — the cross-reference panels just come back empty.
"""
from __future__ import annotations
import re
import unicodedata
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

# Reuse the canonical-field detector and contact parser from process_sheet.
from . import processor  # for processor._load_sheet_module()


def _ps():
    """Lazy import the existing process_sheet helpers."""
    return processor._load_sheet_module()


# --- normalisation -------------------------------------------------------- #

_NORM_RX = re.compile(r"[\s\(\)\/,'\-\.#&]")
_FN_RX = re.compile(r"firstnations?")


def normalize(name: str) -> str:
    if not name:
        return ""
    s = unicodedata.normalize("NFKD", str(name)).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    s = re.sub(r"\s+", " ", s)
    s = _NORM_RX.sub("", s)
    s = _FN_RX.sub("fn", s)
    return s.strip()


# Pre-clean fragments that show up inside parens in the 85-list right column
PAREN_REGION_RX = re.compile(r"\s*\(\s*([^)]+)\s*\)\s*")


def clean_community_name(name: str) -> tuple[str, str]:
    """Return (clean_name, region_hint). Strips trailing `(North)`/region tags."""
    if not name:
        return "", ""
    s = re.sub(r"\s+", " ", str(name)).strip()
    m = PAREN_REGION_RX.search(s)
    region = ""
    if m:
        region = m.group(1).strip()
        s = PAREN_REGION_RX.sub("", s).strip()
    return s, region


# --- workbook readers ----------------------------------------------------- #

def _read_sheet(wb, name: str) -> list[list[str]]:
    if name not in wb.sheetnames:
        return []
    ws = wb[name]
    rows = []
    for raw in ws.iter_rows(values_only=True):
        if not raw:
            continue
        rows.append(["" if v is None else str(v) for v in raw])
    return rows


def _find_sheet(wb, candidates: list[str]) -> str | None:
    """Find the first sheet whose name matches any candidate (case-insensitive)."""
    lowered = {s.lower().strip(): s for s in wb.sheetnames}
    for c in candidates:
        if c.lower() in lowered:
            return lowered[c.lower()]
    # Fuzzy: contains
    for c in candidates:
        for low, real in lowered.items():
            if c.lower() in low:
                return real
    return None


# --- structured readers per sheet ---------------------------------------- #

def read_master_sheet(wb) -> list[dict]:
    """Master Sheet → enriched community records, via tools/process_sheet.py."""
    sheet = _find_sheet(wb, ["Master Sheet", "Master", "Programs"])
    if not sheet:
        # Fall back to whatever the first sheet is.
        sheet = wb.sheetnames[0]
    rows = _read_sheet(wb, sheet)
    if not rows:
        return []
    ps = _ps()
    return ps.process_rows(rows, previous=None, verbose=False)


def read_85_list(wb) -> dict:
    """Returns {'official': [{number, name, note}], 'inMasterNotInList': [{number, name, region}]}."""
    sheet = _find_sheet(wb, ["List of 85 communities", "List of communities", "85 communities"])
    if not sheet:
        return {"official": [], "inMasterNotInList": []}
    rows = _read_sheet(wb, sheet)

    official, extra = [], []
    # Header is in row 1 ("List of the 85 communities") with sub-header in row 2
    # ("Number" / "First Nation" on the left, "Number" / "Community" on the right).
    for r in rows[2:]:  # skip both header rows
        # Left side: official 85 list (cols 0-2: Number, FirstNation, Notes)
        number = r[0] if len(r) > 0 else ""
        fn = r[1] if len(r) > 1 else ""
        note = r[2] if len(r) > 2 else ""
        if fn and not fn.lower().startswith("number"):
            clean, region = clean_community_name(fn)
            try:
                num = int(float(number)) if number else None
            except ValueError:
                num = None
            official.append({
                "number": num,
                "name": clean,
                "note": (note or "").strip() or None,
                "region": region or None,
                "key": normalize(clean),
            })
        # Right side: in-master-not-in-list (cols 4-5)
        en = r[4] if len(r) > 4 else ""
        ef = r[5] if len(r) > 5 else ""
        if ef and not ef.lower().startswith("number") and not ef.lower().startswith("community"):
            clean, region = clean_community_name(ef)
            try:
                num = int(float(en)) if en else None
            except ValueError:
                num = None
            extra.append({
                "number": num,
                "name": clean,
                "region": region or None,
                "key": normalize(clean),
            })

    return {"official": official, "inMasterNotInList": extra}


def read_annotations(wb, sheet_name: str, kind: str) -> list[dict]:
    """Generic reader for Missing Information / Needs Review / Correction sheet."""
    sheet = _find_sheet(wb, [sheet_name])
    if not sheet:
        return []
    rows = _read_sheet(wb, sheet)
    out = []
    for r in rows[1:]:  # skip header row
        community = r[0] if len(r) > 0 else ""
        item = r[1] if len(r) > 1 else ""
        if not community and not item:
            continue
        # Correction sheet header is slightly different (no Status column).
        if kind == "correction":
            entry = {
                "kind": kind,
                "community": (community or "").strip(),
                "communityKey": normalize(community),
                "item": (item or "").strip(),
                "description": (r[2] if len(r) > 2 else "").strip(),
                "date": (r[3] if len(r) > 3 else "").strip(),
                "note": (r[4] if len(r) > 4 else "").strip(),
            }
        else:
            entry = {
                "kind": kind,
                "community": (community or "").strip(),
                "communityKey": normalize(community),
                "item": (item or "").strip(),
                "status": (r[2] if len(r) > 2 else "").strip(),
                "description": (r[3] if len(r) > 3 else "").strip(),
                "date": (r[4] if len(r) > 4 else "").strip(),
                "note": (r[5] if len(r) > 5 else "").strip(),
            }
        out.append(entry)
    return out


def read_additional_links(wb) -> list[dict]:
    sheet = _find_sheet(wb, ["Additional links", "Additional Links"])
    if not sheet:
        return []
    rows = _read_sheet(wb, sheet)
    out = []
    cur_section = ""
    for r in rows[1:]:
        a = r[0] if len(r) > 0 else ""
        b = r[1] if len(r) > 1 else ""
        if not a:
            continue
        # Section row (single col)
        if a and not b:
            cur_section = a.strip()
            continue
        out.append({
            "name": a.strip(),
            "link": b.strip(),
            "section": cur_section,
            "key": normalize(a),
        })
    return out


# --- main entry ----------------------------------------------------------- #

def ingest_workbook(path: Path) -> dict:
    """Read the whole workbook and produce a structured snapshot."""
    wb = load_workbook(filename=str(path), data_only=True, read_only=True)

    master_records = read_master_sheet(wb)
    list85 = read_85_list(wb)
    missing = read_annotations(wb, "Missing Information", "missing")
    review = read_annotations(wb, "Needs Review", "review")
    corrections = read_annotations(wb, "Correction sheet", "correction")
    extra_links = read_additional_links(wb)

    # Cross-reference: stamp each master record with whether it appears in the
    # canonical 85-list, and attach related annotations + corrections.
    by_key_85 = {c["key"]: c for c in list85["official"]}
    by_key_extra = {c["key"]: c for c in list85["inMasterNotInList"]}

    ann_by_community: dict[str, list[dict]] = {}
    for batch in (missing, review, corrections):
        for a in batch:
            ann_by_community.setdefault(a["communityKey"], []).append(a)

    for rec in master_records:
        key = normalize(rec.get("name", ""))
        rec["nameKey"] = key
        rec["in85List"] = key in by_key_85
        rec["in85Extra"] = key in by_key_extra
        if key in by_key_85:
            rec["officialNumber"] = by_key_85[key]["number"]
            if by_key_85[key].get("note"):
                rec["listNote"] = by_key_85[key]["note"]
        elif key in by_key_extra:
            rec["officialNumber"] = None
            rec["extraSection"] = by_key_extra[key].get("region")
        rec["annotations"] = ann_by_community.get(key, [])
        rec["missingCount"] = sum(1 for a in rec["annotations"] if a["kind"] == "missing")
        rec["reviewCount"] = sum(1 for a in rec["annotations"] if a["kind"] == "review")
        rec["correctionCount"] = sum(1 for a in rec["annotations"] if a["kind"] == "correction")

    # Coverage85: for every official community, was a master sheet record found?
    by_master_key = {normalize(r.get("name", "")): r for r in master_records}
    coverage_items = []
    for entry in list85["official"]:
        matched = by_master_key.get(entry["key"])
        coverage_items.append({
            "number": entry["number"],
            "name": entry["name"],
            "note": entry["note"],
            "inMaster": matched is not None,
            "matchedName": matched["name"] if matched else None,
            "matchedDirection": (matched or {}).get("direction"),
            "matchedAnnotations": len((matched or {}).get("annotations", [])),
        })

    return {
        "records": master_records,
        "list85": list85,
        "coverage85": coverage_items,
        "annotations": {
            "missing": missing,
            "review": review,
            "corrections": corrections,
            "totals": {
                "missing": len(missing),
                "review": len(review),
                "corrections": len(corrections),
            },
        },
        "additionalLinks": extra_links,
        "meta": {
            "sheets": wb.sheetnames,
            "masterRows": len(master_records),
            "list85Official": len(list85["official"]),
            "list85Extra": len(list85["inMasterNotInList"]),
        },
    }
