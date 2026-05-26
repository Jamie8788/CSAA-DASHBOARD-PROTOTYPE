# Tools

Backend utilities for processing the Mino Bimaadiziwin master sheet.

## `process_sheet.py` (v2)

Converts a master Excel workbook **or CSV** into `communities-data.js` for the dashboard.

### Setup

```bash
pip install openpyxl     # only needed for .xlsx; CSV needs nothing
```

### Use

```bash
# From the project root — Excel
python tools/process_sheet.py path/to/master-sheet.xlsx

# CSV (UTF-8, comma- / tab- / semicolon-delimited; delimiter is auto-sniffed)
python tools/process_sheet.py path/to/master-sheet.csv

# Pick a specific worksheet
python tools/process_sheet.py master.xlsx --sheet "Updated Master"

# Custom output path
python tools/process_sheet.py master.xlsx --out communities-data.js

# Quiet mode (no diagnostics)
python tools/process_sheet.py master.xlsx --quiet
```

### What's new in v2

* **CSV support** — the script auto-detects `.csv` and sniffs the delimiter.
* **Header-driven columns** — the script scans the first 10 rows for a header
  that matches words like `name`, `physical health`, `contact`, `AGM`,
  `population`, `survivors`, `youth`, `direction`, `latitude`, etc. and maps
  whichever column wins to a canonical field.
* **Missing columns are tolerated** — if your sheet lacks a column (say,
  `Financials` was dropped this year) the script prints a notice and leaves
  that field blank for every record.
* **Reordered columns work** — the column order in the sheet no longer has
  to match the legacy layout.
* **Explicit lat/lon / direction / type columns** are honoured if present;
  otherwise they're inferred from section context (as before).
* **Diagnostics** — at the end of the run you get a quality summary:
  records with no contact info, records with no narrative content, how
  many duplicate rows were merged, how many junk rows were skipped, etc.
* Coordinates from the previous `communities-data.js` are still carried
  forward by normalized name.

### When to run

Every time the master sheet changes:

```bash
python tools/process_sheet.py path/to/updated-master.xlsx
```

Then refresh the dashboard in the browser — it will load the new data automatically.

### Alternative: in-browser upload

If you don't want to run Python, you can upload the new `.xlsx` directly in the dashboard:

1. Sign in as Editor (password `mino2025`).
2. Click **Upload Excel** in the admin toolbar.
3. Pick the `.xlsx` — the parser runs in the browser and replaces the dataset.

The browser parser does the same dedup + classification as the Python script. The Python script is preferred when you want to commit the canonical dataset to the repo or when you have a `.csv` rather than `.xlsx`.
