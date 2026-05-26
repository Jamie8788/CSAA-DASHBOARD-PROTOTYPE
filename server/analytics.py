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
