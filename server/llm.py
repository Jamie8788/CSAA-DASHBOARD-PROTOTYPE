"""Optional free LLM layer (Groq).

Groq offers a free, fast OpenAI-compatible API. We use it ONLY to read messy
scraped webpage text and pull out structured contacts (name / role / email /
phone) — the facts still come from the page we scraped, so it can't invent a
community's population or anything we didn't fetch.

The key is read from the GROQ_API_KEY environment variable, or passed in
(e.g. from a CMS setting). If no key is configured, every function is a no-op
and the deterministic regex extraction is used instead.
"""
from __future__ import annotations

import os
import json
try:
    import requests
except Exception:  # pragma: no cover
    requests = None

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
# xAI ("Grok") is also OpenAI-compatible. If the configured key is an xAI key
# (they start with "xai-"), we talk to x.ai instead of Groq — so whichever of
# the two the admin pastes into the same settings box Just Works.
XAI_URL = "https://api.x.ai/v1/chat/completions"
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-3-mini")
_RUNTIME_KEY = {"key": None}   # may be set from CMS settings at runtime


def set_key(key: str | None):
    _RUNTIME_KEY["key"] = (key or "").strip() or None


def _key() -> str | None:
    return (_RUNTIME_KEY["key"]
            or (os.environ.get("GROQ_API_KEY") or "").strip()
            or (os.environ.get("GROK_API_KEY") or "").strip()      # common spelling for the xAI key
            or (os.environ.get("XAI_API_KEY") or "").strip()
            or None)


def _provider(key: str) -> tuple[str, str, str]:
    """(url, model, label) for the configured key."""
    if key.startswith("xai-"):
        return XAI_URL, XAI_MODEL, "grok"
    return GROQ_URL, GROQ_MODEL, "groq"


def provider_label() -> str | None:
    key = _key()
    return _provider(key)[2] if key else None


def available() -> bool:
    return bool(_key()) and requests is not None


def chat(system: str, user: str, max_tokens: int = 700, temperature: float = 0.0) -> str | None:
    key = _key()
    if not key:
        return None
    url, model, _label = _provider(key)
    try:
        r = requests.post(url, timeout=45,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": model, "temperature": temperature, "max_tokens": max_tokens,
                  "messages": [{"role": "system", "content": system},
                               {"role": "user", "content": user}]})
        if r.status_code != 200:
            return None
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        return None


def extract_contacts(page_text: str) -> str | None:
    """Return a clean contact block ('Name — Role · email · phone' lines) pulled
    from scraped text, or None if the LLM isn't configured / found nothing."""
    if not available() or not page_text:
        return None
    page_text = page_text[:6000]
    out = chat(
        system=("You extract real staff/department contacts from website text for a "
                "First Nations community directory. Only use what is in the text — never "
                "invent names, emails, or numbers. If nothing concrete is present, reply "
                "exactly NONE."),
        user=("From the text below, list each real contact on its own line as "
              "'Name — Role · email · phone' (omit any part not present). Skip "
              "tracking/placeholder addresses. Max 8 lines.\n\nTEXT:\n" + page_text),
    )
    if not out or out.strip().upper().startswith("NONE"):
        return None
    return out.strip()
