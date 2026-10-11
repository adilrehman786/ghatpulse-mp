# GHATPULSE MP — reproducible PDF source-page audit

**Goal:** Independently check all 1,524 source CSV observations against the original 2023/2024/2025 MPPCB report *page images*, with evidence of what was checked and what remains unverified. This is a manual visual source-transcription audit assisted by a deterministic script. **The script does not automatically verify any PDF page or observation.**

> As distributed, no report page has been independently verified by this audit. The program requires the complete official CSV and actual PDFs before it will initialize the formal 1,524-row audit. Never equate a PDF URL, text-search hit, valid physical page number, unit assumption, or browser `#page=` fragment with verification.

## 1. Prepare inputs (Windows PowerShell; run at the GHATPULSE project root)

You need Python 3.10+, Node.js for the project CSV downloader, and an internet connection. The source CSV and the three PDF files must remain unchanged throughout the review.

```powershell
# From the unzipped ghatpulse-mp project directory
npm run fetch:data
py -m pip install pymupdf
New-Item -ItemType Directory -Force source-pdfs | Out-Null

Invoke-WebRequest 'https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf' -OutFile 'source-pdfs/2023.pdf'
Invoke-WebRequest 'https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf' -OutFile 'source-pdfs/2024.pdf'
Invoke-WebRequest 'https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf' -OutFile 'source-pdfs/2025.pdf'

Get-FileHash 'public/data/bhopal_ghats_2023_2025.csv' -Algorithm SHA256
Get-FileHash 'source-pdfs/*.pdf' -Algorithm SHA256
```

If MPPCB blocks downloading, manually download the **same specific original reports** via your browser or the event organizer's official challenge resources, name them `2023.pdf`, `2024.pdf`, `2025.pdf`, and save them in `source-pdfs`. Check each file opens as a genuine PDF—not a server error HTML page. The audit script opens the documents and rejects missing/bad PDFs; it never substitutes another report.

For macOS/Linux replace `py` with `python3` and use `mkdir -p source-pdfs` and `curl -fL --retry 2 '<URL>' -o source-pdfs/<year>.pdf` for each URL.

## 2. Initialize locked, unverified audit files

```powershell
py scripts/audit_source_pages.py init
```

The script refuses to begin with fewer than **1,524 rows** (unless you deliberately use `--allow-subset` for a dry run), and refuses to overwrite an existing audit by default. Outputs are:

- `source-audit/manifest.json`: input CSV hash and individual PDF SHA256 hashes, page counts, initialization time.
- `source-audit/page_reviews.csv`: one unverified item for each distinct `(year, source_page)` reference, with a referenced-row count. The page groups reduce redundant navigation, but **do not replace checking each observation**.
- `source-audit/observation_reviews.csv`: all 1,524 immutable source rows, each initially `row_status=unchecked`.

The guaranteed initial status is **zero verified pages and zero verified observations**. Do not use `--force` to rerun initialization: it overwrites manual work. If any source bytes change, create a new audit folder or reinitialize only after explicitly archiving the old ledger.

## 3. Identify the correct physical PDF page for each source-page group

Open `source-audit/page_reviews.csv` in a spreadsheet editor (keep CSV column headers unchanged). Work group by group, e.g., one group might be `(2025, 28)`—**28 is an unverified source claim**, not necessarily a PDF viewer page.

```powershell
# Optional navigation aid. Hits can be false positives/negatives.
py scripts/audit_source_pages.py locate --year 2025 --term 'Khatlapura'

# Render 1-based PHYSICAL/viewer PDF page 28 of the 2025 report.
py scripts/audit_source_pages.py render --year 2025 --page 28 --out 'source-audit/2025-physical-page-028.png'
```

Visually locate the relevant report table and compare the `source_page` with BOTH: (a) the **1-based PDF viewer/physical page** and (b) any **page number printed on the report page**. Report front matter can make these different. Inspect adjacent pages when necessary. If the table occupies two pages, verify which page actually contains each claimed row/column. A similar number elsewhere is not proof.

For a page group genuinely matched by visual inspection, fill `page_reviews.csv`:

- `pdf_page_1based`: physical PDF viewer page where the table appears.
- `page_basis`: `physical` only when the source `source_page` **equals** the physical page; or `printed` only when the source number **equals the visible printed page number**.
- `printed_page_seen`: page label seen on paper if there is one; mandatory when `page_basis=printed`.
- `page_status`: `verified` *only after* checking page identity and the report/table context; otherwise `unchecked`, `mismatch`, or `unreadable`.
- `visual_check`: `yes` only after actually rendering/viewing the PDF page.
- `reviewer`, `reviewed_utc` (for example `2026-10-11T08:45:00Z`), `notes`: describe specific report table, festival, site, and page mapping.

For a mismatch or unreadable page, keep `page_status=mismatch` / `unreadable`, record what you found and do **not** force a verified status. The script will reject a `verified` physical mapping that conflicts with the dataset's source page. If it is a printed-page mapping, the script checks the recorded printed label against the source page.

## 4. Independently check **every observation**, not merely each page

In `source-audit/observation_reviews.csv`, filter the rows by `year` + `source_page` to match the group under inspection. Verify each observation against the specific PDF table and the **correct phase column**:

1. **Site name:** compare `site_as_printed` with report site text. `site` is a normalized analyst label; whether it identifies the same location is a **separate site-matching question**. Keep `site_match_confidence` in the app, particularly the medium-confidence Kamla Park / Rani Kamlapati match.
2. **Festival and year:** confirm the report identity and correct Ganesh/Durga table.
3. **Parameter:** compare `parameter_as_printed`, including abbreviations such as `D.Oxygen`, to the actual row label.
4. **Phase:** identify `pre`, `during`, or `after` in the table's **correct column header**. Text-search proximity alone cannot establish the correct phase.
5. **Reported cell:** compare exact `value_as_printed` and `flag` to the original cell. Preserve printed `8` versus parsed `8.0`, actual numeric `0`, `BDL`, `*`, `**`, blanks and `not sampled`. The assumed `unit_assumed` is **not** independently verified by a report that prints no unit.
6. **Page mapping:** confirm the row's cell truly occurs on the page that was reviewed—not only on an adjacent or similarly named page.

Only then set the row's `row_status=verified`, and set the four row checks to `yes`: `site_text_matches`, `parameter_text_matches`, `phase_column_matches`, `value_or_flag_matches`. Record `reviewer`, a timezone-aware ISO 8601 `reviewed_utc`, and an informative `notes` value naming the table and cell location. These checks are a human attestation; the script can validate that an attestation was recorded, **not that it was truthful**. For absent sources, illegible cells, ambiguous values, or different source data, use `unchecked`, `unreadable`, or `mismatch` with notes. Never mark a whole page's observations verified without inspecting them one by one.

## 5. Check progress as often as needed; enforce full completion

```powershell
py scripts/audit_source_pages.py check
py scripts/audit_source_pages.py check --require-complete
```

`check` produces `source-audit/audit-summary.json`, `source-audit/unverified_observations.csv`, and `source-audit/verified_observations.csv`. The strict command returns **exit code 2** until each of all 1,524 observations has a consistent reviewed page, four positive row checks, an identified reviewer, and a timestamp; the summary `complete_manual_source_audit` remains false until then. Inspect `invalid_approvals` and the unverified CSV to decide what to review next. Never suppress a failure or report complete verification when the strict command fails.

You can run synthetic regression tests of the audit utility without touching the actual reports:

```powershell
py -m unittest discover -s tests -p 'test_audit_source_pages.py' -v
```

The tests demonstrate: PDF content/search presence never auto-verifies pages; incomplete approvals are rejected; a PDF hash change invalidates stale approvals; a 1-row synthetic reviewed fixture still cannot count as a complete 1,524-row audit.

## 6. Policy for showing references in GHATPULSE MP

- **No audit / unchecked / unreadable:** `Source dataset reports page N — not independently verified`. The PDF URL or `#page=N` is a navigation attempt, not substantiation.
- **Mismatched page:** `Source page mismatch: dataset page N; located PDF viewer page M (needs correction/review)`. Do not silently change the official CSV. Maintain a separate derived correction/errata layer only after re-review.
- **Human-reviewed page but unchecked observation:** `Reported page visually located; observation not verified`.
- **Human-reviewed, complete row:** `Source observation and page manually checked` with reviewer/date, correct PDF viewer page, and the CSV/PDF hashes or audit batch ID.
- **Medium site-match confidence:** show that uncertainty **even when the printed value is verified**, because transcription verification does not establish site identity.

The current app carries a `source_page` from the dataset and builds a speculative `#page=N` link. **This audit tool does not automatically modify the UI or import verification badges into it.** If you integrate its results later, only `verified_observations.csv` entries associated with the same locked CSV/PDF checksums are eligible to receive the manually checked label; all others must retain a visible unverified/uncertain label. Do not equate manually checked transcription with government approval, present-day water quality, compliance, or safety.

## Source provenance

The official challenge [data dictionary](https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/data/DATA_DICTIONARY.md) records **1,524 source rows** and describes `source_page` as the PDF page to check. It says only six tables across three years were spot-checked against text; **that is not a record-by-record page-image audit**. The dictionary reports 2023: 87 pages, 2024: 118 pages, 2025: 92 pages. The actual script reads each downloaded PDF to establish its true physical page count; do not rely solely on those published counts.

The original report URLs are supplied above. The audit records both the origin (untouched CSV and PDF SHA256) and separate reviewer decisions to make every claim reproducible and revocable.
