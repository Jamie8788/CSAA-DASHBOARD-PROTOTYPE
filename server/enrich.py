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

import requests

UA = "MinoBimaadiziwinAtlas/1.0 (community services atlas; contact: mujamil@algomau.ca)"
SESSION = requests.Session()
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
    n = (name or "").lower()
    if not n or n in {"test1", "test"}:
        return False
    bad = ["umbrella", "map of indigenous", "association of", "tribal council",
           "grand council", "board of health", "open minds", "ancfsao",
           "first 10", "(pilot)", "next 75", "additional links"]
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


def _links(base, text):
    out = []
    for m in re.finditer(r'<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', text, re.I | re.S):
        href, label = m.group(1), re.sub(r"<[^>]+>", "", m.group(2))
        if href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        out.append((html.unescape(clean(label)), urljoin(base, href)))
    return out


def scrape_site(start_url):
    found = {"emails": {}, "phones": {}, "docs": {}, "contact_pages": [], "reached": False}
    home = _fetch(start_url)
    if not home:
        return found
    found["reached"] = True

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
            time.sleep(0.05)
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


def enrich_one(name: str, cur_link: str = "", cur_pop=None, scrape: bool = True):
    """Return a list of suggestion dicts for one community."""
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
    if site:
        cur = clean(cur_link)
        if not cur:
            out.append({"field": "Community Link", "current": "", "suggested": site, "source": wd_url,
                        "confidence": "High", "note": "Sheet had no link. Official site from Wikidata."})
        elif host(cur) != host(site):
            out.append({"field": "Community Link", "current": cur, "suggested": site, "source": wd_url,
                        "confidence": "Medium", "note": "Different domain than the sheet — confirm which is current."})

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
            if emails or phones:
                lines = [e for e, _ in emails] + [p for p, _ in phones]
                src = (emails or phones)[0][1]
                out.append({"field": "Contact Information for Departments", "current": "",
                            "suggested": "  •  ".join(lines), "source": src, "confidence": "Medium",
                            "note": f"Scraped {len(emails)} emails / {len(phones)} phones from the official site. Verify roles."})
            for kind, (link, label) in sc["docs"].items():
                out.append({"field": kind, "current": "", "suggested": link, "source": site_url,
                            "confidence": "Medium", "note": f'Found a "{label[:40]}" link on the official site.'})

    if not out:
        out.append({"field": "(no objective data)", "current": "", "suggested": "—", "source": w["url"],
                    "confidence": "Low", "note": "Found the article but no population/website/coords to suggest."})
    return out
