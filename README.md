# GHATPULSE MP

**Environmental Decision Intelligence**  
*See the signal. Verify the source. Act on the evidence.*

A local-first React + TypeScript prototype for **Bhopal Impact Lab 2026 · Track 2 — Visarjan Ghat Watch**. Built for a Bhopal Municipal Corporation analyst to rank historical sampling concerns, inspect individual printed observations, identify data gaps and produce a qualified decision brief. This is **not a live water-monitoring system**, regulatory compliance determination or immersion-approval tool.

## Run locally — five steps

1. Install Node.js 20.19+ and open a terminal in this folder: `cd ghatpulse-mp`.
2. Install development dependencies: `npm install`.
3. **Recommended, for the complete analysis:** `npm run fetch:data` (downloads the original 1,524-record official CSV to `public/data/bhopal_ghats_2023_2025.csv`; requires internet). Alternatively place that official CSV at the same path or click **Import CSV** in the application.
4. Run `npm run dev`.
5. Visit the local URL Vite prints (usually **http://localhost:5173/**).

**No-install offline preview alternative:** This archive already includes compiled `dist/app.js`, bundled MIT-licensed React runtime and a 72-record transcribed source excerpt. Run `npm run serve:offline` in this folder (Node.js and the already-compiled `dist/app.js` are sufficient; no Vite install is needed), then open `http://localhost:4173/`. The full dataset is *not* included in the archive; the app will first try a locally installed official CSV, then attempt the public raw GitHub URL, then use the transparent 72-record fallback. The interface **visibly warns** when only partial data are available. This fallback is not an acceptable replacement for loading the complete challenge dataset for final evaluation.

## What it does

| Section | Functional behaviour |
| --- | --- |
| Overview | Actual-file KPIs, historical index ranking of seven ghats, count-backed rationale, sample-quality warnings, source link and annual historical comparison. |
| Ghat Intelligence | Site selection; year/festival/phase/parameter filtering; DO, BOD and pH; numerical support and missing counts; source evidence; keyboard-focusable SVG trends and comparator lines; suggested checks. |
| Evidence Explorer | Source-field search, seven filters, sorting, paging, raw-field CSV export, observation drawer with printed value, original flag, reported page and PDF page hint. |
| Decision Brief | Reproducible English and Hindi texts from the **same loaded observations**, copy, English PDF download and print-to-PDF fallback for Hindi typography. |
| Methodology & Data | Explicit formula, exclusions, historical limits, source PDFs, dataset completeness checks and genuine reload/recalculate. |

The drawer and brief preserve site, year, festival, phase, reported value, assumed unit, site-match confidence and reported source page. PDF fragment links (`#page=N`) are *attempted navigation aids*; actual PDF pages are **not independently page-verified**.

## Source and data quality

- [Official Track 2 problem](https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/PROBLEM-STATEMENT.md)
- [Original 2023–2025 CSV](https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/data/bhopal_ghats_2023_2025.csv)
- [Challenge data dictionary](https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/data/DATA_DICTIONARY.md)
- [CPCB comparison-criteria file](https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/data/cpcb_water_quality_criteria.csv)
- MPPCB historic reports: [2023](https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf), [2024](https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf), [2025](https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf).

**Dataset benchmark checks:** 1,524 source records; 1,289 strictly numerical; 42/116 low-DO numerical results; 100/112 elevated-BOD numerical results; 174 BDL flags; 61 unsampled observations ("not sampled", `*`, `**`). These are **expected validation fixtures, never UI totals**: the interface computes all observed counts from the actual loaded CSV. The full-data indicator requires **all** benchmark counts to match and all seven site names to exist. Count parity alone does not authenticate the content of any individual row.

**Fallback provenance:** `public/data/verified_excerpt.csv` contains 72 rows transcribed from the public challenge source for local offline functionality. This subset includes 2025 Ganesh DO/BOD/pH for the seven ghats plus selected 2023 source entries, including explicit missing/BDL observations. It must not be used to assert full-dataset totals or full site rankings. Printed source pages are carried through but have not been independently verified against PDF page images.

### Parsing safeguards

The RFC-4180-style parser respects quoted delimiters, quoted quotes, CRLF and BOM. Required fields are checked. Malformed rows are skipped with counted warnings. The numeric parser accepts only strict finite numeric forms. Blank/`not sampled`/`*`/`**` are **not sampled**; `BDL`/`ND` are **below detection**; unknown strings are **other** and excluded. Numeric `0` is retained as an actual observation. Both BDL and not sampled are **neither exceedances nor successful comparison outcomes**. Original printed value/flag/unit metadata are not overwritten. `unit_assumed` records conventions, not independently measured units.

### Historical Exceedance Index

Defined in `src/config.ts` and implemented in separately testable `src/scoring.ts`:

```text
Index = 40 × BOD exceedance rate
      + 40 × DO below-threshold rate
      + 20 × pH out-of-range rate

BOD: strictly > 3 mg/L
DO:  strictly < 5 mg/L
pH:  strictly < 6.5 OR > 8.5
rate: flagged numerical samples / valid numerical samples
```

The weights are renormalised proportionally over **only parameters with numerical readings**, so a missing parameter is **unavailable**, not silently scored as zero. A site with no comparable numerical readings has an **unavailable index**, not `0`. Ties resolve by highest count of comparator numerical measurements, then site name alphabetically. This illustrative index is **not an official risk estimate, health/safety assessment, current-water result or legal compliance score**. BOD's `>3` comparison is challenge-provided and requires confirmation of sampling and analytical-method comparability before regulatory interpretation.

Site-match confidence is retained; the **Rani Kamlapati / Kamla Park** naming must be confirmed before location-specific operations. No geographic coordinates, sensors, real-time 2026 updates, operational alerts, dispatch, approvals, accounts or government APIs are asserted.

## Verification

```bash
npm test                  # Compile TypeScript and run 17 pure/React-tree tests
npm run build             # Compile and package a standalone static release; no Vite dependency needed
npm run build:vite        # Optional Vite-optimised release when npm dependencies are installed
npm run serve:offline     # Compile and serve working UI on port 4173; needs Node.js only
```

Optional real-browser UI smoke QA: `python3 tests/browser-smoke.py` (requires Python Playwright and a locally installed Chromium executable at `/usr/bin/chromium`; update the executable path for other machines). It injects the local bundled sources into a headless document and mocks the excerpt fetch because sandbox browser navigation was blocked.

The tests include thresholds, strict-value parsing, BDL, missing, explicit zero, multi-parameter weighting, weight renormalization, empty scores, deterministic ranking ties, malformed input, CSV round trips, bilingual brief content, PDF signature, all 35 ghat/section render combinations and UI state transitions. A file-availability check validates that the application can serve locally. A browser-based integration/screenshot QA pass must still be performed in a browser-capable environment before production release; it was not possible in the build sandbox. The sandbox could not reach GitHub to download the full CSV or install Vite packages; the dependency-free `npm run build` and browser smoke tests did pass. Deploy the contents of `release/` to any static host. To preview that exact release locally: `GHATPULSE_ROOT=release PORT=4174 node scripts/serve.mjs` (on macOS/Linux). The delivered compile and test results should not be misrepresented as a full-browser audit or full-dataset benchmark validation.

## Architecture

- `src/config.ts`: canonical source links, comparator rules, weights and types.
- `src/data.ts`: CSV parsing, record classification, filtering, KPIs and expected full-file validation.
- `src/scoring.ts`: deterministic independent comparator ranking and evidence recommendations.
- `src/exports.ts`: filtered CSV, bilingual text, clipboard/download infrastructure and a dependency-free English PDF writer.
- `src/ui.ts`: React sections and interaction state, source drawer, SVG historical trends and responsive navigation.
- `styles.css`: design system, responsive breakpoints, readable tables, focus states, reduced motion, print view.
- `dist/app.js`: precompiled classic-script browser runtime.
- `public/vendor`: offline React 16 MIT runtime; see `public/vendor/THIRD_PARTY_NOTICES.md`.
- `scripts/fetch-data.mjs`: downloads unaltered complete official source when accessible.
- `tests/engine.test.cjs`: repeatable isolated and lightweight React-tree validation.

No required API keys, backend, AI model, login, tracking analytics or database. User-selected CSV may be cached within the current browser using localStorage and is not uploaded by this application. Reload & recalculate genuinely attempts to reload the local/remote source; it does not merely reset the UI.

## License

MIT (see `LICENSE`). Third-party React runtime retains original MIT notices.
