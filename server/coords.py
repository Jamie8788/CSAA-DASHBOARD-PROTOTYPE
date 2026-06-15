"""Curated coordinate gazetteer.

The master sheet leaves some communities and umbrella organizations without
latitude/longitude. This fills them in so every mappable entry actually plots.
Entries are matched by substring against the *slugified* name, so messy source
names (embedded newlines, parenthetical aliases, slash-aliases) still resolve.

Coordinates are the community's main reserve, or — for organizations — their
headquarters. Abstract rows (test entries, "umbrella organizations", a link to
a map) are deliberately NOT listed and stay unplotted.
"""
from __future__ import annotations

import re

# (substring-in-slug, lat, lng)  — first match wins, so list specific keys first.
GAZETTEER: list[tuple[str, float, float]] = [
    # --- real First Nations communities -----------------------------------
    ("batchewana",                  46.62, -84.30),   # Rankin / Goulais, Sault Ste Marie
    ("cape-crocker",                44.90, -80.97),   # Neyaashiinigmiing (Cape Croker)
    ("nawash",                      44.90, -80.97),
    ("chippewa-of-the-thames",      42.85, -81.48),   # SW of London, ON
    ("chippewas-thames",            42.85, -81.48),
    # --- organizations — plotted at their headquarters --------------------
    ("maamwesying",                 46.66, -82.18),   # Cutler, North Shore of Lake Huron
    ("north-shore-tribal",          46.66, -82.18),
    ("association-of-native-child", 43.66, -79.38),   # ANCFSAO — Toronto
    ("ancfsao",                     43.66, -79.38),
    ("grand-council-of-the-crees",  51.69, -76.24),   # Nemaska, QC
    ("cree-board-of-health",        53.79, -78.90),   # Chisasibi, QC
    ("mushkegowuk",                 51.26, -80.60),   # Moose Factory, ON
    ("access-open-minds",           45.50, -73.58),   # McGill, Montreal
]


def _slug(s: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", str(s or "").lower())
    return re.sub(r"^-|-$", "", s)


# Canada bounding box (with a little margin). Any community coordinate outside
# this is wrong — usually a bad Wikidata match (e.g. a same-named place abroad).
# We drop those so the map never flies off to South America, etc.
_CA = (40.0, 84.0, -142.0, -51.0)   # min_lat, max_lat, min_lng, max_lng


def _in_canada(lat, lng) -> bool:
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return _CA[0] <= lat <= _CA[1] and _CA[2] <= lng <= _CA[3]


def scrub_bad_coords(records: list[dict]) -> list[dict]:
    """Remove coordinates that fall outside Canada (bad enrichment matches) so a
    single wrong point can't break the map. The gazetteer can then re-fill them."""
    for r in records:
        lat = r.get("lat")
        lng = r.get("lng") if r.get("lng") is not None else r.get("lon")
        if lat is not None and lng is not None and not _in_canada(lat, lng):
            r["lat"] = None
            r["lng"] = None
            r["lon"] = None
            ai = r.get("_ai")
            if isinstance(ai, dict):
                ai.pop("lat", None)
                ai.pop("lng", None)
    return records


def fill_missing_coords(records: list[dict]) -> list[dict]:
    """Drop any out-of-Canada coordinates, then overlay coordinates onto records
    that have none. Idempotent — records already carrying valid lat + (lng or
    lon) are left untouched."""
    scrub_bad_coords(records)
    for r in records:
        lat = r.get("lat")
        lng = r.get("lng") if r.get("lng") is not None else r.get("lon")
        if lat is not None and lng is not None:
            continue
        sl = _slug(r.get("name", ""))
        if not sl:
            continue
        for key, la, lo in GAZETTEER:
            if key in sl:
                r["lat"] = la
                r["lng"] = lo
                r["lon"] = lo
                r["_coordSource"] = "gazetteer"
                break
    return records
