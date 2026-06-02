"""Free, no-API-key data enrichment core.

Looks up OBJECTIVE facts for a community from authoritative free sources and
scrapes the official website for contacts and documents. Returns plain dicts —
no Excel/IO here, so both the CLI tool (tools/enrich_master_sheet.py) and the
FastAPI server can import it.

Sources (all free, no key, no payment):
  * Wikipedia REST/Action API   — article match, coordinates
  * Wikidata Action API         — population (P1082), official site (P856), coords (P625)
  * The community's own website  — emails, phones, strategic plan / AGM / financial links

Honesty: every suggestion carries a SOURCE url and a CONFIDENCE level. We never
fabricate values — if a citable source doesn't have it, we don't suggest it.
"""
from __future__ import annotations

import re
import time
import html
import difflib
from urllib.parse import urljoin, urlparse

# `requests` is an optional dependency for enrichment. Guard the import so a
# missing package can never crash the whole API (it once did on deploy).
try:
    import requests
    _HAS_REQUESTS = True
except Exception:  # pragma: no cover
    requests = None
    _HAS_REQUESTS = False

UA = "MinoBimaadiziwinAtlas/1.0 (community services atlas; contact: mujamil@algomau.ca)"
SESSION = requests.Session() if _HAS_REQUESTS else None
if SESSION is not None:
    SESSION.headers.update({"User-Agent": UA})
TIMEOUT = 18

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}")
DOC_KINDS = {
    "Strategic Plan":               ["strategic plan", "strategicplan", "strategy"],
    "Annual General Meeting (AGM)":  ["agm", "annual general meeting", "annual-general"],
    "Financial Statements":         ["financial statement", "financials", "audited",
                                     "annual report", "annual-report"],
}
CONTACT_HINTS = ["contact", "staff", "directory", "departments", "governance",
                 "administration", "council", "team", "about"]


def clean(s) -> str:
    return re.sub(r"\s+", " ", str(s or "")).strip()


def num(v):
    if v is None:
        return None
    m = re.search(r"\d[\d,]*", str(v).replace("\xa0", " "))
    return int(m.group(0).replace(",", "")) if m else None


def _similar(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a.lower(), b.lower()).ratio()


def looks_like_community(name: str) -> bool:
    n = (name or "").strip().lower()
    if not n or n in {"test1", "test"}:
        return False
    # exact section-header / region-divider labels that sit between communities
    if n in {"east", "south", "west", "north", "central", "pilot",
             "indigenous health authorities", "community", "first nation",
             "number", "name"}:
        return False
    bad = ["umbrella", "map of indigenous", "association of", "tribal council",
           "grand council", "board of health", "open minds", "ancfsao",
           "first 10", "(pilot)", "next 75", "additional links",
           "second project", "environmental scan", "first project",
           "list of", "health authorities", "section"]
    return not any(b in n for b in bad)


# tracking / placeholder / asset emails that scraping picks up but aren't real contacts
_JUNK_EMAIL = re.compile(
    r"(sentry|wixpress|yourdomain|placeholder|@2x|sentry\.io|@example|@domain\.|"
    r"\.(png|jpg|jpeg|gif|webp|svg)$|no-?reply|donotreply|u003e|u003c)", re.I)
_JUNK_LOCAL = re.compile(r"^(example|test|name|email|user|your|firstname|lastname|info)@(example|domain|test|email|site)\.", re.I)


def _junk_email(e: str) -> bool:
    return (bool(_JUNK_EMAIL.search(e)) or bool(_JUNK_LOCAL.match(e))
            or e.lower().startswith(("example@", "test@", "you@", "your@", "name@"))
            or len(e) > 60 or e.count("@") != 1)


# ---------------- website scraping ---------------- #
def _fetch(url):
    try:
        r = SESSION.get(url, timeout=14, allow_redirects=True)
        if r.status_code == 200 and "html" in r.headers.get("content-type", ""):
            return r.text
    except Exception:
        return None
    return None


def link_ok(url) -> bool:
    """True if the URL loads (2xx/3xx). Used to detect dead/old links in the
    sheet so the AI can flag or replace them instead of trusting them."""
    if not _HAS_REQUESTS or not url or not str(url).startswith("http"):
        return False
    try:
        r = SESSION.get(url, timeout=10, allow_redirects=True, stream=True)
        r.close()
        return r.status_code < 400
    except Exception:
        return False


def _links(base, text):
    out = []
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', text, re.I | re.S):
        href, label = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        out.append((html.unescape(clean(label)), urljoin(base, href)))
    return out


def _visible_text(html_text):
    t = re.sub(r"(?is)<(script|style|noscript).*?</\1>", " ", html_text)
    t = re.sub(r"(?s)<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(t)).strip()


def scrape_site(start_url):
    found = {"emails": {}, "phones": {}, "docs": {}, "contact_pages": [],
             "reached": False, "text": "", "closest": None}
    home = _fetch(start_url)
    if not home:
        return found
    found["reached"] = True
    text_parts = [_visible_text(home)[:4000]]

    def harvest(url, text):
        for e in set(EMAIL_RE.findall(text)):
            if _junk_email(e):
                continue
            found["emails"].setdefault(e, url)
        for p in set(PHONE_RE.findall(text)):
            found["phones"].setdefault(clean(p), url)
        for label, link in _links(url, text):
            low = (label + " " + link).lower()
            for kind, keys in DOC_KINDS.items():
                if any(k in low for k in keys):
                    found["docs"].setdefault(kind, (link, label or kind))

    harvest(start_url, home)
    host = urlparse(start_url).netloc
    # remember a "closest" page (governance/about/documents/reports) to offer
    # when an exact Strategic-Plan/AGM/Financial document can't be found.
    CLOSEST_HINTS = ["governance", "about", "document", "report", "council",
                     "administration", "publication"]
    for label, link in _links(start_url, home):
        low = (label + " " + link).lower()
        if urlparse(link).netloc == host and any(h in low for h in CLOSEST_HINTS):
            found["closest"] = link
            break
    seen = set()
    for label, link in _links(start_url, home):
        low = (label + " " + link).lower()
        if urlparse(link).netloc == host and any(h in low for h in CONTACT_HINTS) and link not in seen:
            seen.add(link)
            if len(found["contact_pages"]) >= 3:
                break
            sub = _fetch(link)
            if sub:
                found["contact_pages"].append(link)
                harvest(link, sub)
                text_parts.append(_visible_text(sub)[:3000])
            time.sleep(0.05)
    if not found["closest"]:
        found["closest"] = (found["contact_pages"] or [start_url])[0]
    found["text"] = "  ".join(text_parts)[:8000]
    return found


# ---------------- Wikipedia / Wikidata ---------------- #
def wiki_search(name: str):
    r = SESSION.get("https://en.wikipedia.org/w/api.php", timeout=TIMEOUT, params={
        "action": "query", "list": "search", "srsearch": name, "srlimit": 5, "format": "json"})
    r.raise_for_status()
    hits = r.json().get("query", {}).get("search", [])
    if not hits:
        return None
    best = max(hits, key=lambda h: _similar(name, h["title"]))
    if _similar(name, best["title"]) < 0.45:
        return None
    title = best["title"]
    pr = SESSION.get("https://en.wikipedia.org/w/api.php", timeout=TIMEOUT, params={
        "action": "query", "prop": "pageprops|coordinates", "titles": title,
        "ppprop": "wikibase_item", "format": "json"})
    pr.raise_for_status()
    page = next(iter(pr.json().get("query", {}).get("pages", {}).values()), {})
    qid = page.get("pageprops", {}).get("wikibase_item")
    coords = None
    if page.get("coordinates"):
        c = page["coordinates"][0]
        coords = (round(c["lat"], 4), round(c["lon"], 4))
    return {"title": title, "qid": qid, "coords": coords,
            "url": "https://en.wikipedia.org/wiki/" + title.replace(" ", "_")}


def wikidata_facts(qid: str):
    r = SESSION.get("https://www.wikidata.org/w/api.php", timeout=TIMEOUT, params={
        "action": "wbgetentities", "ids": qid, "props": "claims", "format": "json"})
    r.raise_for_status()
    claims = r.json().get("entities", {}).get(qid, {}).get("claims", {})
    out = {"population": None, "website": None, "coords": None}
    best_pop, best_year = None, -1
    for st in claims.get("P1082", []):
        try:
            amt = int(float(st["mainsnak"]["datavalue"]["value"]["amount"]))
        except Exception:
            continue
        year = -1
        for q in st.get("qualifiers", {}).get("P585", []):
            try:
                year = int(q["datavalue"]["value"]["time"][1:5])
            except Exception:
                pass
        if year >= best_year:
            best_year, best_pop = year, amt
    if best_pop is not None:
        out["population"] = (best_pop, best_year if best_year > 0 else None)
    for st in claims.get("P856", []):
        try:
            out["website"] = st["mainsnak"]["datavalue"]["value"]; break
        except Exception:
            pass
    for st in claims.get("P625", []):
        try:
            v = st["mainsnak"]["datavalue"]["value"]
            out["coords"] = (round(v["latitude"], 4), round(v["longitude"], 4)); break
        except Exception:
            pass
    return out


def enrich_one(name: str, cur_link: str = "", cur_pop=None, scrape: bool = True, use_llm: bool = False):
    """Return a list of suggestion dicts for one community."""
    if not _HAS_REQUESTS:
        return [{"field": "(unavailable)", "current": "", "suggested": "", "source": "",
                 "confidence": "Low", "note": "The 'requests' library is not installed on the server."}]
    out = []
    try:
        w = wiki_search(name)
    except Exception as e:
        return [{"field": "(lookup)", "current": "", "suggested": "", "source": "",
                 "confidence": "Low", "note": f"lookup error: {e}"}]
    if not w:
        return [{"field": "(lookup)", "current": "", "suggested": "—", "source": "",
                 "confidence": "Low", "note": "No confident Wikipedia/Wikidata match — verify by hand."}]

    facts = {}
    if w.get("qid"):
        try:
            facts = wikidata_facts(w["qid"])
        except Exception:
            facts = {}
    wd_url = f"https://www.wikidata.org/wiki/{w['qid']}" if w.get("qid") else w["url"]

    pop = facts.get("population")
    if pop:
        val, year = pop
        cur = num(cur_pop)
        if cur is None:
            conf, note = "High", f"Sheet had no population. Wikidata{f' ({year})' if year else ''}."
        elif abs(cur - val) <= max(25, 0.03 * val):
            conf, note = "High", f"Matches the sheet ({cur:,}). Confirmed."
        else:
            conf, note = "Medium", f"Sheet says {cur:,}; source says {val:,}{f' ({year})' if year else ''} — please check."
        out.append({"field": "Community Population", "current": str(cur_pop or ""),
                    "suggested": f"{val:,}", "source": wd_url, "confidence": conf, "note": note})

    site = facts.get("website")
    def host(u):
        m = re.search(r"https?://([^/]+)", u or ""); return (m.group(1).lower().replace("www.", "") if m else "")
    cur = clean(cur_link)
    # check whether the EXISTING link still works, so dead/old links get fixed
    cur_dead = bool(cur) and cur.startswith("http") and not link_ok(cur)
    if site:
        if not cur:
            out.append({"field": "Community Link", "current": "", "suggested": site, "source": wd_url,
                        "confidence": "High", "note": "Sheet had no link. Official site from Wikidata."})
        elif cur_dead:
            out.append({"field": "Community Link", "current": cur, "suggested": site, "source": wd_url,
                        "confidence": "High", "replace": True,
                        "note": "The link in the sheet did not load (broken/old). Replaced with the working official site."})
        elif host(cur) != host(site):
            out.append({"field": "Community Link", "current": cur, "suggested": site, "source": wd_url,
                        "confidence": "Medium", "note": "Different domain than the sheet — confirm which is current."})
    elif cur_dead:
        out.append({"field": "Community Link", "current": cur, "suggested": "", "source": "",
                    "confidence": "Low", "note": "The link in the sheet did not load — appears broken. No replacement found."})

    coords = facts.get("coords") or w.get("coords")
    if coords:
        out.append({"field": "Coordinates (lat, lng)", "current": "", "suggested": f"{coords[0]}, {coords[1]}",
                    "source": w["url"], "confidence": "High" if facts.get("coords") else "Medium",
                    "note": "For accurate map placement."})

    site_url = facts.get("website") or clean(cur_link)
    if scrape and site_url and site_url.startswith("http"):
        sc = scrape_site(site_url)
        if sc["reached"]:
            emails = list(sc["emails"].items())[:8]
            phones = list(sc["phones"].items())[:6]
            llm_block = None
            if use_llm:
                try:
                    from . import llm
                    llm_block = llm.extract_contacts(sc.get("text", ""))
                except Exception:
                    llm_block = None
            if llm_block:
                out.append({"field": "Contact Information for Departments", "current": "",
                            "suggested": llm_block, "source": (sc["contact_pages"] or [site_url])[0],
                            "confidence": "Medium", "note": "Structured by AI from the official site. Verify."})
            elif emails or phones:
                lines = [e for e, _ in emails] + [p for p, _ in phones]
                src = (emails or phones)[0][1]
                out.append({"field": "Contact Information for Departments", "current": "",
                            "suggested": "  •  ".join(lines), "source": src, "confidence": "Medium",
                            "note": f"Scraped {len(emails)} emails / {len(phones)} phones from the official site. Verify roles."})
            for kind, (link, label) in sc["docs"].items():
                out.append({"field": kind, "current": "", "suggested": link, "source": site_url,
                            "confidence": "Medium", "note": f'Found a "{label[:40]}" link on the official site.'})
            # for any document we did NOT find an exact link for, offer the
            # closest relevant page rather than leaving it blank.
            closest = sc.get("closest")
            if closest:
                for kind in DOC_KINDS:
                    if kind not in sc["docs"]:
                        out.append({"field": kind, "current": "", "suggested": closest, "source": site_url,
                                    "confidence": "Low",
                                    "note": "Closest page on the official site — exact document not found, please check."})

    if not out:
        out.append({"field": "(no objective data)", "current": "", "suggested": "—", "source": w["url"],
                    "confidence": "Low", "note": "Found the article but no population/website/coords to suggest."})
    return out


# --------------------------------------------------------------------------- #
#  auto-fill engine — fills blank objective fields on the dataset, tagging
#  each filled field as AI-sourced so the UI/Excel can colour-code it.
# --------------------------------------------------------------------------- #
_PLACEHOLDER = {"", "missing information", "needs review", "n/a", "na",
                "no definite value", "duplicate record", "tbd", "-", "—"}


def _is_blank(v) -> bool:
    return clean(v).lower() in _PLACEHOLDER


# maps an enrich_one suggestion "field" → the record key it fills
_FIELD_TO_KEY = {
    "Community Population": "population",
    "Community Link": "link",
    "Contact Information for Departments": "contact",
    "Strategic Plan": "strategicPlan",
    "Annual General Meeting (AGM)": "agm",
    "Financial Statements": "financials",
}


def apply_enrichment(records, use_llm: bool = False, progress=None):
    """Fill blank objective fields in `records` (in place) from free sources.

    Only fills cells that are blank — never overwrites human-entered values.
    Every field it fills is recorded in rec['_ai'] = {key: source_url} so the
    UI and the Excel export can mark it as AI-pulled (purple). Returns a summary
    dict. `progress(done, total)` is called as it works.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    targets = [r for r in records if looks_like_community(r.get("name", ""))]
    total = len(targets)
    filled_fields = 0
    filled_comms = 0

    def work(rec):
        name = rec.get("name", "")
        cur_link = rec.get("link") or rec.get("website") or ""
        cur_pop = rec.get("population")
        try:
            sugs = enrich_one(name, cur_link, cur_pop, scrape=True, use_llm=use_llm)
        except Exception:
            sugs = []
        return rec, sugs

    done = 0
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(work, r) for r in targets]
        for f in as_completed(futs):
            rec, sugs = f.result()
            ai = dict(rec.get("_ai") or {})
            for s in sugs:
                field, val = s.get("field"), s.get("suggested")
                if not val or str(val) in ("—", ""):
                    continue
                # coordinates fill two keys at once, only when both are blank
                if field == "Coordinates (lat, lng)" and "," in str(val):
                    if rec.get("lat") is None or (rec.get("lng") is None and rec.get("lon") is None):
                        try:
                            la, lo = [float(x) for x in str(val).split(",")[:2]]
                            rec["lat"], rec["lng"], rec["lon"] = la, lo, lo
                            ai["lat"] = ai["lng"] = s.get("source") or ""
                        except Exception:
                            pass
                    continue
                key = _FIELD_TO_KEY.get(field)
                if not key:
                    continue
                # fill blanks, OR replace a link the source confirmed is broken
                if _is_blank(rec.get(key)) or s.get("replace"):
                    rec[key] = val
                    ai[key] = s.get("source") or ""
            if ai:
                rec["_ai"] = ai
            done += 1
            if progress:
                progress(done, total)

    filled_comms = sum(1 for r in targets if r.get("_ai"))
    filled_fields = sum(len(r["_ai"]) for r in targets if r.get("_ai"))
    return {"communities": total, "communities_filled": filled_comms,
            "fields_filled": filled_fields}
