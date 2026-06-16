"""Google Sheets API ingestion — preserves EVERY in-cell link.

Why this exists: when Google Sheets exports to .xlsx it keeps only the FIRST
link inside a multi-link cell and silently drops the rest. The Sheets API, by
contrast, returns each cell's `textFormatRuns`, and every run carries its own
`format.link.uri` — so reading the live sheet recovers all links.

This module fetches the spreadsheet, builds the same row/link structures the
.xlsx path produces, and hands them to workbook.assemble_snapshot() so the
entire downstream pipeline (master parse, 85-list, Missing/Review/Correction,
cross-reference) is reused unchanged.

Auth: a Google API key works for a sheet shared as "anyone with the link can
view". Set GOOGLE_SHEETS_API_KEY + GOOGLE_SHEETS_ID (env) or the CMS settings
'sheets.apiKey' / 'sheets.spreadsheetId'.
"""
from __future__ import annotations
import re

import requests

from . import workbook

_API = "https://sheets.googleapis.com/v4/spreadsheets/{id}"
# Only the fields we need — keeps the payload small even for big sheets.
_FIELDS = ("sheets(properties(title),data(rowData(values("
           "formattedValue,hyperlink,textFormatRuns(format(link(uri)))))))")


def extract_spreadsheet_id(value: str) -> str:
    """Accept a raw ID or a full Google Sheets URL and return the ID."""
    if not value:
        return ""
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", value)
    return m.group(1) if m else value.strip()


class _FakeSheet:
    def __init__(self, rows: list[list[str]]):
        self._rows = rows

    def iter_rows(self, values_only: bool = True):
        for r in self._rows:
            yield tuple(r)


class _FakeWorkbook:
    """Mimics the slice of openpyxl that workbook.py uses: `.sheetnames` and
    `wb[title].iter_rows(values_only=True)`."""
    def __init__(self, sheets: dict[str, list[list[str]]]):
        self._sheets = sheets
        self.sheetnames = list(sheets.keys())

    def __getitem__(self, title):
        return _FakeSheet(self._sheets.get(title, []))


def _cell_links(cell: dict) -> list[str]:
    """All external http(s) links in a cell: the cell hyperlink + every
    text-run link, in order, deduped."""
    out: list[str] = []

    def add(u):
        if u and str(u).lower().startswith(("http://", "https://")) and u not in out:
            out.append(str(u).strip())

    add(cell.get("hyperlink"))
    for run in (cell.get("textFormatRuns") or []):
        link = ((run.get("format") or {}).get("link") or {}).get("uri")
        add(link)
    return out


def fetch_spreadsheet(spreadsheet_id: str, api_key: str) -> dict:
    """Return the raw Sheets API JSON (grid data + textFormatRuns)."""
    url = _API.format(id=spreadsheet_id)
    resp = requests.get(url, params={"key": api_key, "includeGridData": "true",
                                     "fields": _FIELDS}, timeout=60)
    if resp.status_code != 200:
        detail = ""
        try:
            detail = resp.json().get("error", {}).get("message", "")
        except Exception:
            detail = resp.text[:200]
        raise RuntimeError(f"Google Sheets API {resp.status_code}: {detail}")
    return resp.json()


def build_from_api(data: dict) -> tuple[_FakeWorkbook, dict]:
    """Turn the Sheets API JSON into (fake workbook, hyperlinks grid)."""
    sheets: dict[str, list[list[str]]] = {}
    hyperlinks: dict[str, dict] = {}
    for sh in (data.get("sheets") or []):
        title = (sh.get("properties") or {}).get("title") or ""
        rows: list[list[str]] = []
        grid: dict = {}
        grid_data = sh.get("data") or []
        row_data = grid_data[0].get("rowData", []) if grid_data else []
        for ri, row in enumerate(row_data):
            values = row.get("values") or []
            cells = []
            for ci, cell in enumerate(values):
                cells.append(cell.get("formattedValue") or "")
                links = _cell_links(cell)
                if links:
                    grid.setdefault(ri + 1, {})[ci] = links   # 1-based row
            rows.append(cells)
        sheets[title] = rows
        if grid:
            hyperlinks[title] = grid
    return _FakeWorkbook(sheets), hyperlinks


def ingest_gsheet(spreadsheet_id: str, api_key: str) -> dict:
    """Fetch + parse the live Google Sheet → the same snapshot dict as
    workbook.ingest_workbook(), with ALL in-cell links preserved."""
    spreadsheet_id = extract_spreadsheet_id(spreadsheet_id)
    if not spreadsheet_id or not api_key:
        raise RuntimeError("Google Sheets sync needs a spreadsheet ID and API key")
    data = fetch_spreadsheet(spreadsheet_id, api_key)
    wb, hyperlinks = build_from_api(data)
    return workbook.assemble_snapshot(wb, hyperlinks)
