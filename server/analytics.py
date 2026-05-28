"""State-of-the-art data analytics for the Mino Bimaadiziwin atlas.

Powered by pandas + scikit-learn. All functions take a list of enriched
community records (see processor.enrich) and return JSON-serialisable dicts.
"""
from __future__ import annotations
import math
import re
from collections import Counter
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler


PILLAR_KEYS = ["physical", "mental", "spiritual", "emotional"]
PILLAR_FLAGS = ["hasPhysical", "hasMental", "hasSpiritual", "hasEmotional"]
EXTRA_FLAGS = ["hasYouth", "hasSurvivors", "hasConnect"]
DIRECTIONS = ["East", "South", "West", "North", "Central"]
ORG_TYPES = [
    "Community", "Health Authority", "Indigenous Organization",
    "Friendship Centre", "Child & Family Services", "Umbrella Organization",
]


def _records_to_df(records: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(records)
    if df.empty:
        return df
    # Ensure expected columns exist
    for col in PILLAR_FLAGS + EXTRA_FLAGS:
        if col not in df.columns:
            df[col] = False
    for col in ("direction", "type", "section", "name"):
        if col not in df.columns:
            df[col] = ""
    if "populationNumeric" not in df.columns:
        df["populationNumeric"] = np.nan
    return df


def _safe_int(n) -> int:
    if pd.isna(n):
        return 0
    return int(n)


def overview(records: list[dict]) -> dict:
    """Top-line KPIs: counts, coverage, completeness."""
    df = _records_to_df(records)
    if df.empty:
        return {"total": 0}

    total = len(df)
    pillars_covered = {
        k: _safe_int(df[f"has{k.capitalize()}"].sum()) for k in PILLAR_KEYS
    }
    extras_covered = {
        k.replace("has", "").lower(): _safe_int(df[k].sum()) for k in EXTRA_FLAGS
    }
    has_any_pillar = df[PILLAR_FLAGS].any(axis=1).sum()
    has_all_pillars = df[PILLAR_FLAGS].all(axis=1).sum()
    has_contact = df.get("contact", pd.Series([""] * total)).fillna("").astype(str).str.strip().str.len().gt(0).sum()
    has_geo = (df.get("lat").notna() & df.get("lon").notna()).sum() if "lat" in df.columns else 0

    pop = pd.to_numeric(df["populationNumeric"], errors="coerce")
    pop_known = int(pop.notna().sum())
    pop_total = float(pop.sum(skipna=True)) if pop_known else 0.0
    pop_median = float(pop.median(skipna=True)) if pop_known else 0.0
    pop_mean = float(pop.mean(skipna=True)) if pop_known else 0.0

    # Completeness score — fraction of useful narrative fields populated.
    narrative_cols = PILLAR_KEYS + ["youth", "survivors", "connect", "contact",
                                    "strategicPlan", "agm", "financials"]
    available = [c for c in narrative_cols if c in df.columns]
    completeness = 0.0
    if available and total:
        per_row = df[available].apply(lambda s: s.fillna("").astype(str).str.strip().str.len().gt(1).sum(), axis=1)
        completeness = float(per_row.mean() / len(available))

    return {
        "total": int(total),
        "byDirection": df["direction"].fillna("").value_counts().to_dict(),
        "byType": df["type"].fillna("").value_counts().to_dict(),
        "pillarsCovered": pillars_covered,
        "extras": extras_covered,
        "hasAnyPillar": int(has_any_pillar),
        "hasAllPillars": int(has_all_pillars),
        "hasContact": int(has_contact),
        "hasGeo": int(has_geo),
        "populationKnown": pop_known,
        "populationTotal": pop_total,
        "populationMean": round(pop_mean, 1) if pop_known else 0,
        "populationMedian": pop_median,
        "completenessScore": round(completeness, 3),
    }


def pillars_breakdown(records: list[dict]) -> dict:
    """Pillar coverage by direction and by type."""
    df = _records_to_df(records)
    if df.empty:
        return {"byDirection": {}, "byType": {}}

    def pivot(group_col: str) -> dict:
        out: dict[str, dict] = {}
        for key, sub in df.groupby(df[group_col].fillna("Unknown")):
            out[str(key)] = {
                "total": int(len(sub)),
                **{k: _safe_int(sub[f"has{k.capitalize()}"].sum()) for k in PILLAR_KEYS},
            }
        return out

    return {"byDirection": pivot("direction"), "byType": pivot("type")}


def gaps(records: list[dict]) -> dict:
    """Identify communities with the highest service gaps."""
    df = _records_to_df(records)
    if df.empty:
        return {"items": []}
    df = df.copy()
    df["gapCount"] = (~df[PILLAR_FLAGS]).sum(axis=1)
    df["pillarsCovered"] = df[PILLAR_FLAGS].sum(axis=1)
    worst = df.sort_values(["gapCount", "name"], ascending=[False, True]).head(25)
    items = []
    for _, row in worst.iterrows():
        missing = [k for k in PILLAR_KEYS if not row[f"has{k.capitalize()}"]]
        items.append({
            "id": row.get("id", ""),
            "name": row.get("name", ""),
            "direction": row.get("direction", ""),
            "type": row.get("type", ""),
            "missingPillars": missing,
            "gapCount": int(row["gapCount"]),
            "pillarsCovered": int(row["pillarsCovered"]),
        })
    return {"items": items}


def population_distribution(records: list[dict]) -> dict:
    """Histogram + percentile breakdown of community population."""
    df = _records_to_df(records)
    pop = pd.to_numeric(df.get("populationNumeric"), errors="coerce").dropna()
    if pop.empty:
        return {"buckets": [], "percentiles": {}}
    bins = [0, 100, 500, 1000, 2500, 5000, 10000, 50_000, math.inf]
    labels = ["<100", "100-499", "500-999", "1k-2.5k", "2.5k-5k",
              "5k-10k", "10k-50k", "50k+"]
    cats = pd.cut(pop, bins=bins, labels=labels, right=False, include_lowest=True)
    buckets = cats.value_counts().reindex(labels, fill_value=0).to_dict()
    pct = pop.quantile([0.25, 0.5, 0.75, 0.9])
    return {
        "buckets": [{"label": k, "count": int(v)} for k, v in buckets.items()],
        "percentiles": {f"p{int(p * 100)}": float(v) for p, v in pct.items()},
        "min": float(pop.min()),
        "max": float(pop.max()),
        "stddev": float(pop.std(ddof=0)),
    }


def keywords(records: list[dict], top_n: int = 25) -> dict:
    """TF-IDF top keywords per pillar — the words that distinguish each pillar."""
    df = _records_to_df(records)
    if df.empty:
        return {"perPillar": {}}
    out: dict[str, list[dict]] = {}
    for key in PILLAR_KEYS:
        if key not in df.columns:
            out[key] = []
            continue
        docs = df[key].fillna("").astype(str).tolist()
        docs = [d for d in docs if len(d.strip()) > 5]
        if len(docs) < 3:
            out[key] = []
            continue
        try:
            vec = TfidfVectorizer(
                stop_words="english",
                max_features=4000,
                ngram_range=(1, 2),
                min_df=2,
            )
            mat = vec.fit_transform(docs)
            scores = np.asarray(mat.mean(axis=0)).ravel()
            terms = np.array(vec.get_feature_names_out())
            order = scores.argsort()[::-1][:top_n]
            out[key] = [
                {"term": str(terms[i]), "score": round(float(scores[i]), 4)}
                for i in order if scores[i] > 0
            ]
        except ValueError:
            out[key] = []
    return {"perPillar": out}


def cluster_communities(records: list[dict], n_clusters: int = 5) -> dict:
    """K-means cluster communities by their service-pillar profile.

    Returns each cluster's centroid (pillar mix) and the communities in it.
    """
    df = _records_to_df(records)
    if df.empty or len(df) < n_clusters:
        return {"clusters": [], "k": 0}
    features = df[PILLAR_FLAGS + EXTRA_FLAGS].astype(int).to_numpy()
    scaler = StandardScaler(with_mean=False)
    scaled = scaler.fit_transform(features)
    k = min(n_clusters, max(2, len(df) // 8))
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(scaled)

    centroids = km.cluster_centers_
    # Convert centroids back to coverage rates per pillar+extra
    inv = scaler.inverse_transform(centroids)
    feature_names = PILLAR_FLAGS + EXTRA_FLAGS

    out = []
    for ci in range(k):
        mask = labels == ci
        members_df = df[mask]
        profile = {feature_names[fi]: round(float(inv[ci][fi]), 3)
                   for fi in range(len(feature_names))}
        out.append({
            "id": int(ci),
            "size": int(mask.sum()),
            "profile": profile,
            "sample": members_df["name"].head(8).tolist(),
            "directions": members_df["direction"].fillna("Unknown").value_counts().to_dict(),
        })
    return {"clusters": out, "k": k}


def coverage_matrix(records: list[dict]) -> dict:
    """Direction × Pillar matrix of coverage rates (0..1)."""
    df = _records_to_df(records)
    if df.empty:
        return {"matrix": {}, "directions": [], "pillars": PILLAR_KEYS}
    matrix: dict[str, dict[str, float]] = {}
    for d in DIRECTIONS:
        sub = df[df["direction"] == d]
        if len(sub) == 0:
            matrix[d] = {k: 0.0 for k in PILLAR_KEYS}
            continue
        matrix[d] = {
            k: round(float(sub[f"has{k.capitalize()}"].sum()) / len(sub), 3)
            for k in PILLAR_KEYS
        }
    return {"matrix": matrix, "directions": DIRECTIONS, "pillars": PILLAR_KEYS}


def quality_report(records: list[dict]) -> dict:
    """Per-record data quality score (0..1)."""
    df = _records_to_df(records)
    if df.empty:
        return {"items": [], "averageScore": 0}
    cols = PILLAR_KEYS + ["youth", "survivors", "contact", "strategicPlan",
                          "agm", "financials", "population"]
    cols = [c for c in cols if c in df.columns]
    scores = []
    for _, row in df.iterrows():
        filled = sum(1 for c in cols
                     if str(row.get(c, "") or "").strip()
                     and str(row.get(c, "") or "").strip().lower()
                     not in {"missing information", "needs review", "n/a", "no definite value"})
        scores.append(round(filled / len(cols), 3))
    df_out = df[["id", "name", "direction", "type"]].copy() if "id" in df.columns else df[["name", "direction", "type"]].copy()
    df_out["completeness"] = scores
    df_out = df_out.sort_values("completeness", ascending=False)
    items = df_out.to_dict(orient="records")
    return {
        "items": items,
        "averageScore": round(float(np.mean(scores)), 3),
        "medianScore": round(float(np.median(scores)), 3),
    }


def full_report(records: list[dict]) -> dict:
    """Roll-up of every analytic — what the dashboard's Analytics view consumes."""
    return {
        "overview": overview(records),
        "pillars": pillars_breakdown(records),
        "gaps": gaps(records),
        "population": population_distribution(records),
        "keywords": keywords(records),
        "clusters": cluster_communities(records),
        "coverageMatrix": coverage_matrix(records),
        "quality": quality_report(records),
    }


# ============================================================================
# State-of-the-art additions: duplicate detection, semantic search, region
# comparison, narrative search — all driven by the actual master sheet.
# ============================================================================

def _community_text(rec: dict) -> str:
    """Concatenate every narrative field on a record into one searchable blob."""
    parts = []
    for k in ("name", "section", "physical", "mental", "spiritual", "emotional",
              "youth", "survivors", "connect", "contact", "strategicPlan",
              "agm", "financials", "notes", "populationNote"):
        v = rec.get(k)
        if v:
            parts.append(str(v))
    return "\n".join(parts)


def detect_duplicate_services(records: list[dict], min_similarity: float = 0.45,
                              max_per_pillar: int = 30) -> dict:
    """Find services described in very similar terms across different communities.

    For each pillar (physical / mental / spiritual / emotional / youth /
    survivors), compute pairwise cosine similarity of the TF-IDF vectors of
    each community's narrative for that pillar. Pairs above `min_similarity`
    are surfaced as potential service overlaps the team can investigate.

    This is the "are 5 communities really running the SAME diabetes program
    or is each one different?" question.
    """
    df = _records_to_df(records)
    if df.empty:
        return {"perPillar": {}}

    pillar_keys = PILLAR_KEYS + ["youth", "survivors"]
    out: dict[str, list[dict]] = {}

    for pkey in pillar_keys:
        if pkey not in df.columns:
            out[pkey] = []
            continue
        sub = df[df[pkey].fillna("").astype(str).str.strip().str.len() > 20].copy()
        if len(sub) < 3:
            out[pkey] = []
            continue
        docs = sub[pkey].fillna("").astype(str).tolist()
        try:
            vec = TfidfVectorizer(
                stop_words="english", max_features=3000,
                ngram_range=(1, 2), min_df=1,
            )
            mat = vec.fit_transform(docs)
            sim = cosine_similarity(mat)
        except ValueError:
            out[pkey] = []
            continue

        names = sub["name"].tolist()
        directions = sub["direction"].fillna("").tolist() if "direction" in sub.columns else [""] * len(sub)
        pairs = []
        for i in range(len(docs)):
            for j in range(i + 1, len(docs)):
                s = float(sim[i, j])
                if s >= min_similarity:
                    pairs.append({
                        "communityA": names[i],
                        "directionA": directions[i],
                        "communityB": names[j],
                        "directionB": directions[j],
                        "similarity": round(s, 3),
                        "snippetA": docs[i][:200],
                        "snippetB": docs[j][:200],
                        "sameDirection": directions[i] == directions[j],
                    })
        pairs.sort(key=lambda p: p["similarity"], reverse=True)
        out[pkey] = pairs[:max_per_pillar]

    # Summary stats — how many overlaps, how many cross-direction, etc.
    summary = {
        "totalPairs": sum(len(v) for v in out.values()),
        "byPillar": {k: len(v) for k, v in out.items()},
        "crossDirection": sum(1 for v in out.values() for p in v if not p["sameDirection"]),
    }
    return {"perPillar": out, "summary": summary}


def semantic_search(records: list[dict], query: str, limit: int = 8) -> dict:
    """TF-IDF retrieval — the free "AI chatbot" backend. Always cites communities.

    Returns the top-N communities whose combined narrative is most similar to
    the user's question, along with the matching snippet that contains the
    highest-scoring terms. Pure scikit-learn; no external API calls.
    """
    df = _records_to_df(records)
    if df.empty or not query or len(query.strip()) < 2:
        return {"query": query, "results": [], "answer": ""}

    docs = [_community_text(r) for r in records]
    nonempty_idx = [i for i, d in enumerate(docs) if len(d.strip()) > 10]
    if len(nonempty_idx) < 2:
        return {"query": query, "results": [], "answer": ""}

    nonempty_docs = [docs[i] for i in nonempty_idx]
    try:
        vec = TfidfVectorizer(
            stop_words="english", max_features=8000,
            ngram_range=(1, 2), min_df=1,
        )
        mat = vec.fit_transform(nonempty_docs + [query])
        sim = cosine_similarity(mat[-1], mat[:-1]).ravel()
    except ValueError:
        return {"query": query, "results": [], "answer": ""}

    # Find best snippet per top match — sentence with most query terms.
    query_terms = set(re.findall(r"\w+", query.lower()))
    query_terms = {t for t in query_terms if len(t) >= 3}

    def best_snippet(doc: str) -> str:
        sentences = re.split(r"(?<=[.!?])\s+|\n+", doc)
        scored = []
        for s in sentences:
            s = s.strip()
            if 20 <= len(s) <= 320:
                hits = sum(1 for w in re.findall(r"\w+", s.lower()) if w in query_terms)
                if hits > 0:
                    scored.append((hits, s))
        if scored:
            scored.sort(reverse=True)
            return scored[0][1]
        return doc[:240]

    order = sim.argsort()[::-1]
    results = []
    for rank in order:
        if sim[rank] < 0.02:
            break
        if len(results) >= limit:
            break
        rec_idx = nonempty_idx[rank]
        rec = records[rec_idx]
        snippet = best_snippet(nonempty_docs[rank])
        results.append({
            "name": rec.get("name", ""),
            "direction": rec.get("direction", ""),
            "type": rec.get("type", ""),
            "score": round(float(sim[rank]), 3),
            "snippet": snippet,
            "id": rec.get("id"),
        })

    # Build a conversational summary — first sentence of the top result, with
    # citation to the community. Honest about uncertainty.
    if results:
        top = results[0]
        if top["score"] >= 0.20:
            answer = (f'Based on the master sheet, {top["name"]} '
                      f'({top["direction"] or "—"}) has the most relevant information: '
                      f'"{top["snippet"]}"')
            if len(results) > 1:
                others = ", ".join(r["name"] for r in results[1:4])
                answer += f"\n\nOther communities with related programs: {others}."
        else:
            answer = ("I found some matches but nothing very strong in the sheet. "
                      "Try rephrasing or use more specific words "
                      "(e.g. 'diabetes', 'youth mental health', 'elder care').")
    else:
        answer = ("I couldn't find a clear match in the master sheet for that question. "
                  "Try different keywords or browse the directory directly.")

    return {"query": query, "results": results, "answer": answer}


def compare_regions(records: list[dict], regions: list[str] | None = None) -> dict:
    """Side-by-side comparison: KPIs per direction (East / South / West / North).

    Useful for the team to answer questions like "are West communities better
    served for spiritual support than East?"
    """
    df = _records_to_df(records)
    if df.empty:
        return {"regions": [], "metrics": []}

    regions = regions or [d for d in DIRECTIONS if d in df["direction"].unique()]
    metrics = []
    for d in regions:
        sub = df[df["direction"] == d]
        if len(sub) == 0:
            continue
        pop = pd.to_numeric(sub.get("populationNumeric"), errors="coerce")
        metrics.append({
            "direction": d,
            "communities": int(len(sub)),
            "pillarsAvg": round(float(sub[PILLAR_FLAGS].sum(axis=1).mean()), 2),
            "physical":   _safe_int(sub["hasPhysical"].sum()),
            "mental":     _safe_int(sub["hasMental"].sum()),
            "spiritual":  _safe_int(sub["hasSpiritual"].sum()),
            "emotional":  _safe_int(sub["hasEmotional"].sum()),
            "youth":      _safe_int(sub["hasYouth"].sum()),
            "survivors":  _safe_int(sub["hasSurvivors"].sum()),
            "totalPop":   float(pop.sum(skipna=True)) if pop.notna().any() else 0,
            "medianPop":  float(pop.median(skipna=True)) if pop.notna().any() else 0,
        })
    return {"regions": regions, "metrics": metrics}


def find_peers(records: list[dict], name: str, k: int = 6) -> dict:
    """Return the K most similar communities to `name` by service narrative."""
    df = _records_to_df(records)
    if df.empty or not name:
        return {"target": name, "peers": []}

    name_l = name.strip().lower()
    matches = [i for i, r in enumerate(records)
               if str(r.get("name", "")).strip().lower() == name_l]
    if not matches:
        # Try partial match
        matches = [i for i, r in enumerate(records)
                   if name_l in str(r.get("name", "")).strip().lower()]
        if not matches:
            return {"target": name, "peers": [], "error": "Community not found"}
    target_idx = matches[0]
    target = records[target_idx]
    docs = [_community_text(r) for r in records]
    if not docs[target_idx].strip():
        return {"target": name, "peers": []}
    try:
        vec = TfidfVectorizer(
            stop_words="english", max_features=5000,
            ngram_range=(1, 2), min_df=1,
        )
        mat = vec.fit_transform(docs)
        sim = cosine_similarity(mat[target_idx], mat).ravel()
    except ValueError:
        return {"target": name, "peers": []}

    order = sim.argsort()[::-1]
    peers = []
    for j in order:
        if j == target_idx:
            continue
        if sim[j] < 0.1:
            break
        if len(peers) >= k:
            break
        r = records[j]
        peers.append({
            "name": r.get("name", ""),
            "direction": r.get("direction", ""),
            "type": r.get("type", ""),
            "score": round(float(sim[j]), 3),
            "id": r.get("id"),
            "pillars": [p for p in ("Physical", "Mental", "Spiritual", "Emotional")
                        if r.get(f"has{p}")],
        })
    return {
        "target": target.get("name", ""),
        "targetDirection": target.get("direction", ""),
        "targetType": target.get("type", ""),
        "peers": peers,
    }


def find_gaps_for(records: list[dict], name: str) -> dict:
    """For one community, list things its peers do that it doesn't.

    Compares the target's pillar coverage and presence of optional fields
    (youth, survivors, AGM, financials, strategic plan, etc.) against the
    top-5 most similar peer communities. Surfaces concrete opportunities.
    """
    peer_result = find_peers(records, name, k=8)
    if not peer_result.get("peers"):
        return {"target": name, "gaps": [], "peers": []}

    df = _records_to_df(records)
    by_name = {r.get("name", ""): r for r in records}
    target = by_name.get(peer_result["target"])
    if not target:
        return {"target": name, "gaps": [], "peers": []}

    fields = [
        ("hasPhysical",   "Physical health programming"),
        ("hasMental",     "Mental health programming"),
        ("hasSpiritual",  "Spiritual support programming"),
        ("hasEmotional",  "Emotional support programming"),
        ("hasYouth",      "Youth programming"),
        ("hasSurvivors",  "Survivor support"),
        ("hasConnect",    "Connecting generations"),
    ]
    optional_fields = [
        ("strategicPlan", "Strategic plan"),
        ("agm",           "Annual general meeting"),
        ("financials",    "Financial statements"),
    ]

    peers = [by_name[p["name"]] for p in peer_result["peers"] if p["name"] in by_name]
    gaps = []
    for key, label in fields:
        if target.get(key):
            continue
        offering_peers = [p.get("name", "") for p in peers if p.get(key)]
        if offering_peers:
            gaps.append({
                "field": key, "label": label,
                "peerCount": len(offering_peers),
                "peers": offering_peers[:5],
                "severity": "high" if len(offering_peers) >= 3 else "medium",
            })
    for key, label in optional_fields:
        if str(target.get(key, "") or "").strip():
            continue
        offering = [p.get("name", "") for p in peers
                    if str(p.get(key, "") or "").strip()]
        if offering:
            gaps.append({
                "field": key, "label": label,
                "peerCount": len(offering),
                "peers": offering[:5],
                "severity": "low",
            })

    return {
        "target": peer_result["target"],
        "targetDirection": peer_result["targetDirection"],
        "gaps": gaps,
        "peers": peer_result["peers"],
    }


def spotlight(records: list[dict], name: str) -> dict:
    """Comprehensive single-community deep-dive — every fact in one payload."""
    name_l = (name or "").strip().lower()
    target = None
    for r in records:
        if str(r.get("name", "")).strip().lower() == name_l:
            target = r
            break
    if not target:
        for r in records:
            if name_l and name_l in str(r.get("name", "")).strip().lower():
                target = r
                break
    if not target:
        return {"error": "Community not found", "query": name}

    pillars = []
    for k, label in [("physical", "Physical Health"), ("mental", "Mental Health"),
                     ("spiritual", "Spiritual Support"), ("emotional", "Emotional Support")]:
        text_val = str(target.get(k, "") or "").strip()
        pillars.append({
            "key": k, "label": label,
            "documented": bool(text_val) and text_val.lower() not in
                {"missing information", "needs review", "n/a", "no definite value"},
            "preview": text_val[:240],
            "wordCount": len(text_val.split()) if text_val else 0,
        })

    return {
        "name": target.get("name", ""),
        "direction": target.get("direction", ""),
        "type": target.get("type", ""),
        "section": target.get("section", ""),
        "population": target.get("population", "") or "",
        "link": target.get("link", "") or "",
        "pillars": pillars,
        "youth":     str(target.get("youth", "") or "")[:400],
        "survivors": str(target.get("survivors", "") or "")[:400],
        "connect":   str(target.get("connect", "") or "")[:400],
        "strategicPlan": str(target.get("strategicPlan", "") or "")[:200],
        "agm":           str(target.get("agm", "") or "")[:200],
        "financials":    str(target.get("financials", "") or "")[:200],
        "notes":         str(target.get("notes", "") or "")[:400],
        "contactPreview": str(target.get("contact", "") or "")[:400],
        "staffCount": len(target.get("staff") or []),
        "id": target.get("id"),
    }


def storytelling_facts(records: list[dict]) -> dict:
    """Plain-language facts an elder or new visitor can immediately understand.

    Used as rotating cards on the analytics dashboard. Numbers are derived
    from the live sheet; the wording is fixed (sentences in English).
    """
    df = _records_to_df(records)
    if df.empty:
        return {"facts": []}

    total = len(df)
    has_all = _safe_int(df[PILLAR_FLAGS].all(axis=1).sum())
    has_youth = _safe_int(df["hasYouth"].sum())
    has_survivors = _safe_int(df["hasSurvivors"].sum())

    pop = pd.to_numeric(df.get("populationNumeric"), errors="coerce")
    pop_total = int(pop.sum(skipna=True)) if pop.notna().any() else 0
    pop_largest = ""
    if pop.notna().any():
        idx = pop.idxmax()
        if idx in df.index:
            pop_largest = str(df.loc[idx, "name"])

    most_documented = ""
    if "completenessScore" in df.columns or True:
        # Re-use quality scoring inline (lightweight)
        cols = [c for c in PILLAR_KEYS + ["youth", "survivors", "contact",
                                          "strategicPlan", "agm", "financials"]
                if c in df.columns]
        if cols:
            scores = df[cols].apply(
                lambda r: sum(1 for c in cols if str(r.get(c, "") or "").strip()
                              and str(r.get(c, "") or "").strip().lower()
                              not in {"missing information", "needs review", "n/a"}),
                axis=1,
            )
            best_idx = scores.idxmax()
            if best_idx in df.index:
                most_documented = str(df.loc[best_idx, "name"])

    facts = [
        {"kicker": "Communities", "fact": f"{total} communities and partner organizations are documented in the atlas."},
        {"kicker": "All four pillars",
         "fact": f"{has_all} of {total} document all four service pillars "
                 f"(physical, mental, spiritual, emotional)."},
        {"kicker": "Youth", "fact": f"{has_youth} communities have documented youth programming."},
        {"kicker": "Survivors", "fact": f"{has_survivors} communities have documented survivor support."},
        {"kicker": "People served",
         "fact": f"Together these communities serve roughly {pop_total:,} people."},
    ]
    if pop_largest:
        facts.append({"kicker": "Largest", "fact": f"The largest community by reported population is {pop_largest}."})
    if most_documented:
        facts.append({"kicker": "Most documented",
                      "fact": f"{most_documented} has the most complete record on file."})
    return {"facts": facts}
