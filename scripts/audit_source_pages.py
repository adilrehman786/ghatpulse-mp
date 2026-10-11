#!/usr/bin/env python3
"""GHATPULSE MP source-page audit: prepare, review, and enforce manual verification.

Crucially: text extraction, report presence, candidate page numbers, and even a PDF
link NEVER mark a source page or individual observation as verified. Only explicit
human review, consistent page mapping, intact source hashes, and per-row checks can.

Dependency: pip install pymupdf
"""
from __future__ import annotations

import argparse
import csv
from collections import Counter, defaultdict
from datetime import datetime
import hashlib
import json
from pathlib import Path
import sys
import shutil

PDFS = {"2023": "2023.pdf", "2024": "2024.pdf", "2025": "2025.pdf"}
REQUIRED = [
    "year", "festival", "site", "water_body", "phase", "parameter", "value",
    "unit_assumed", "flag", "value_as_printed", "parameter_as_printed",
    "site_as_printed", "site_match_confidence", "source_page",
]
PAGE_FIELDS = [
    "year", "source_page", "referencing_rows", "pdf_page_1based", "page_basis",
    "printed_page_seen", "page_status", "reviewer", "reviewed_utc",
    "visual_check", "notes",
]
ROW_REVIEW_FIELDS = [
    "row_status", "site_text_matches", "parameter_text_matches",
    "phase_column_matches", "value_or_flag_matches", "reviewer", "reviewed_utc",
    "notes",
]
STATUSES = {"unchecked", "verified", "mismatch", "unreadable"}


def fitz_module():
    try:
        import fitz
        return fitz
    except ImportError as exc:
        raise SystemExit("Install the PDF reader first: python -m pip install pymupdf") from exc


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def row_id(row: dict) -> str:
    raw = json.dumps(row, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def read_source(path: Path, allow_subset=False):
    if not path.is_file():
        raise ValueError(f"CSV missing: {path}; run npm run fetch:data first")
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames or []
        missing = [col for col in REQUIRED if col not in fields]
        if missing:
            raise ValueError(f"Missing source columns: {missing}")
        rows = list(reader)
    if len(rows) != 1524 and not allow_subset:
        raise ValueError(f"Expected the FULL 1,524-row source CSV, got {len(rows)}. Refusing to audit an excerpt. (--allow-subset for a dry run only)")
    for n, r in enumerate(rows, 2):
        if r.get(None) is not None:
            raise ValueError(f"CSV line {n} has excess delimiters/fields")
        if not r.get("year") in PDFS:
            raise ValueError(f"CSV line {n}: unrecognized year {r.get('year')!r}")
    return fields, rows


def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, fields, rows):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def report_files(pdf_dir: Path):
    fitz = fitz_module()
    reports = {}
    for year, name in PDFS.items():
        path = pdf_dir / name
        if not path.is_file():
            raise ValueError(f"Source PDF missing: {path}. Download the actual {year} MPPCB report; no fallback PDF is accepted.")
        try:
            doc = fitz.open(path)
            n = len(doc)
            doc.close()
            if not n:
                raise ValueError("PDF contains no pages")
        except Exception as exc:
            raise ValueError(f"Unreadable PDF {path}: {exc}") from exc
        reports[year] = {"file": name, "sha256": digest(path), "pdf_pages": n}
    return reports


def reviewed_at(s):
    if not s:
        return False
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.tzinfo is not None and dt.utcoffset() is not None
    except ValueError:
        return False


def page_review(page: dict, total_pages: int):
    """Only checks the *recorded audit trail*, not the truth of a human claim."""
    if page.get("page_status", "").strip() != "verified":
        return False, "Page has no explicit verified review"
    if page.get("visual_check", "").strip().lower() != "yes":
        return False, "No visual inspection affirmed"
    if not page.get("reviewer", "").strip() or not reviewed_at(page.get("reviewed_utc", "")):
        return False, "Missing reviewer or timezone-aware review timestamp"
    try:
        pdf_page = int(page.get("pdf_page_1based", ""))
        source_page = int(page.get("source_page", ""))
    except ValueError:
        return False, "Page mapping is not numeric"
    if not 1 <= pdf_page <= total_pages:
        return False, "PDF page outside actual report"
    basis = page.get("page_basis", "").strip().lower()
    if basis == "physical":
        if source_page != pdf_page:
            return False, "Physical-page mapping contradicts CSV source_page"
    elif basis == "printed":
        if str(source_page) != page.get("printed_page_seen", "").strip():
            return False, "Printed-page number does not match CSV source_page"
    else:
        return False, "page_basis must be 'physical' or 'printed'"
    if not page.get("notes", "").strip():
        return False, "Describe the table/report evidence in notes"
    return True, "verified_by_manual_review"


def init(args):
    csv_path, pdf_dir, out = Path(args.csv), Path(args.pdf_dir), Path(args.out)
    fields, rows = read_source(csv_path, args.allow_subset)
    reports = report_files(pdf_dir)
    if out.exists() and any(out.iterdir()) and not args.force:
        raise ValueError(f"Audit folder {out} already contains files. Refusing to overwrite human review. Use --force only to deliberately reset the audit.")
    if out.exists() and args.force:
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    counts = Counter((r["year"], r["source_page"].strip()) for r in rows)
    pages = []
    for (year, page), count in sorted(counts.items(), key=lambda kv: (kv[0][0], (int(kv[0][1]) if kv[0][1].isdigit() else 999999))):
        pages.append({"year": year, "source_page": page, "referencing_rows": count,
                      "pdf_page_1based": "", "page_basis": "", "printed_page_seen": "",
                      "page_status": "unchecked", "reviewer": "", "reviewed_utc": "",
                      "visual_check": "", "notes": ""})
    observations = []
    for line, r in enumerate(rows, 2):
        data = {"csv_line": str(line), "source_row_sha256": row_id(r), **r,
                **{field: ("unchecked" if field == "row_status" else "") for field in ROW_REVIEW_FIELDS}}
        observations.append(data)
    write_csv(out / "page_reviews.csv", PAGE_FIELDS, pages)
    write_csv(out / "observation_reviews.csv", ["csv_line", "source_row_sha256", *fields, *ROW_REVIEW_FIELDS], observations)
    metadata = {"schema_version": 1, "source_csv": str(csv_path), "csv_sha256": digest(csv_path),
                "row_count": len(rows), "reports": reports, "initialized_utc": datetime.now().astimezone().isoformat()}
    (out / "manifest.json").write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Initialized {len(rows)} observations across {len(pages)} distinct (year, reported page) references.")
    print(f"Verified source pages: 0; verified observations: 0. These statuses are intentionally NOT inferred.")
    print(f"Review: {out / 'page_reviews.csv'} and {out / 'observation_reviews.csv'}")
    if args.allow_subset:
        print("DRY RUN: this is not a complete 1,524-record audit.")


def check(args):
    csv_path, pdf_dir, out = Path(args.csv), Path(args.pdf_dir), Path(args.out)
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    fields, rows = read_source(csv_path, args.allow_subset)
    reports = report_files(pdf_dir)
    issues = []
    if manifest["csv_sha256"] != digest(csv_path) or manifest["row_count"] != len(rows):
        raise ValueError("Source CSV changed since audit initialization. Stale approvals are invalid; do not reuse them.")
    for year in PDFS:
        if reports[year]["sha256"] != manifest["reports"][year]["sha256"]:
            raise ValueError(f"{year} PDF bytes changed since audit initialization. Stale approvals invalid; inspect report revision.")
    pfields, page_rows = read_csv(out / "page_reviews.csv")
    ofields, obs_rows = read_csv(out / "observation_reviews.csv")
    if not set(PAGE_FIELDS).issubset(pfields) or not set(ROW_REVIEW_FIELDS).issubset(ofields):
        raise ValueError("Review CSV lost audit-required columns")
    page_keys = [(p["year"], p["source_page"].strip()) for p in page_rows]
    expected_keys = set((r["year"], r["source_page"].strip()) for r in rows)
    if len(set(page_keys)) != len(page_keys) or set(page_keys) != expected_keys:
        raise ValueError("Page review keys changed or are incomplete")
    if len(obs_rows) != len(rows):
        raise ValueError("Observation review row count changed; no result is trustworthy")
    pages = {(p["year"], p["source_page"].strip()): p for p in page_rows}
    validated_pages = {}
    for key, p in pages.items():
        if p["page_status"].strip() not in STATUSES:
            issues.append({"kind": "page", "key": repr(key), "issue": "Invalid page status"})
        valid, why = page_review(p, reports[key[0]]["pdf_pages"])
        validated_pages[key] = valid
        if p["page_status"].strip() == "verified" and not valid:
            issues.append({"kind": "page", "key": repr(key), "issue": why})
    by_year = defaultdict(Counter)
    verified_rows = []
    evidence_issues = []
    for source_line, (original, entry) in enumerate(zip(rows, obs_rows), 2):
        original_values = {k: entry.get(k, "") for k in fields}
        if (entry.get("csv_line") != str(source_line)
                or entry.get("source_row_sha256") != row_id(original)
                or original_values != original):
            raise ValueError(f"Observation review line {source_line} no longer matches the immutable official CSV")
        year = original["year"]
        status = entry.get("row_status", "").strip()
        if status not in STATUSES:
            issues.append({"kind": "observation", "key": str(source_line), "issue": "Invalid row status"})
            status = "invalid"
        valid = False
        if status == "verified":
            key = (year, original["source_page"].strip())
            checks = [entry.get(field, "").strip().lower() == "yes" for field in
                      ("site_text_matches", "parameter_text_matches", "phase_column_matches", "value_or_flag_matches")]
            valid = (validated_pages[key] and all(checks) and entry.get("reviewer", "").strip()
                     and reviewed_at(entry.get("reviewed_utc", "")))
            if not valid:
                issues.append({"kind": "observation", "key": str(source_line),
                               "issue": "Marked verified without a verified mapped page, four cell checks, reviewer and timestamp"})
                status = "invalid"
        by_year[year][status] += 1
        if valid:
            verified_rows.append(entry)
        else:
            evidence_issues.append({"csv_line": source_line, "year": year,
                                    "site": original["site"], "parameter": original["parameter"],
                                    "source_page": original["source_page"], "status": status})
    report = {
        "source_dataset_rows": len(rows),
        "source_file_sha256": manifest["csv_sha256"],
        "pdf_sha256": {y: reports[y]["sha256"] for y in PDFS},
        "referenced_page_groups": len(page_rows),
        "page_groups_verified_by_reviewer": sum(validated_pages.values()),
        "observations_verified_by_reviewer": len(verified_rows),
        "unverified_observations": len(rows) - len(verified_rows),
        "per_year_observation_status": dict(by_year),
        "site_match_confidence_remains_independent_of_source_transcription": True,
        "invalid_approvals": issues,
        "complete_manual_source_audit": len(verified_rows) == len(rows) and not issues and len(rows) == 1524,
        "note": "Verified means a human reviewer attested PDF-to-CSV transcription and page mapping. It is not government validation or verified site identity."
    }
    (out / "audit-summary.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    write_csv(out / "unverified_observations.csv", ["csv_line", "year", "site", "parameter", "source_page", "status"], evidence_issues)
    write_csv(out / "verified_observations.csv", ["csv_line", "source_row_sha256", *fields, *ROW_REVIEW_FIELDS], verified_rows)
    print(f"Page groups manually verified: {report['page_groups_verified_by_reviewer']}/{len(page_rows)}")
    print(f"Observations manually verified: {len(verified_rows)}/{len(rows)}")
    print(f"Unverified observations: {report['unverified_observations']} | Invalid approvals: {len(issues)}")
    for y in PDFS:
        print(f"  {y}: {dict(by_year[y])}")
    print(f"Audit summary saved: {out / 'audit-summary.json'}")
    if issues or (args.require_complete and not report["complete_manual_source_audit"]):
        raise SystemExit(2)


def locate(args):
    fitz = fitz_module()
    doc = fitz.open(Path(args.pdf_dir) / PDFS[args.year])
    needle = " ".join(args.term.casefold().split())
    found = []
    for i, p in enumerate(doc, 1):
        t = " ".join(p.get_text("text").casefold().split())
        if needle in t:
            found.append(i)
    doc.close()
    print(f"Candidate PHYSICAL PDF pages for {args.term!r} in {args.year}: {found or 'NONE'}")
    print("Text search is a navigation hint only; scanned images and formatting may cause false negatives. It does not verify source pages.")


def render(args):
    fitz = fitz_module()
    doc = fitz.open(Path(args.pdf_dir) / PDFS[args.year])
    if not 1 <= args.page <= len(doc):
        raise ValueError(f"Physical PDF page {args.page} is outside 1..{len(doc)}")
    path = Path(args.out)
    path.parent.mkdir(parents=True, exist_ok=True)
    page = doc[args.page - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(args.scale, args.scale), alpha=False)
    pix.save(path)
    doc.close()
    print(f"Rendered actual physical PDF page {args.page} from {args.year} -> {path}. NOT VERIFIED until reviewed.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)
    for command in ("init", "check"):
        p = sub.add_parser(command)
        p.add_argument("--csv", default="public/data/bhopal_ghats_2023_2025.csv")
        p.add_argument("--pdf-dir", default="source-pdfs")
        p.add_argument("--out", default="source-audit")
        p.add_argument("--allow-subset", action="store_true", help="Dry-run only; never complete audit")
        if command == "init":
            p.add_argument("--force", action="store_true", help="DESTROYS previous audit notes in output folder")
        else:
            p.add_argument("--require-complete", action="store_true", help="Fail exit code unless all 1524 observations manually verified")
    p = sub.add_parser("locate")
    p.add_argument("--pdf-dir", default="source-pdfs")
    p.add_argument("--year", choices=list(PDFS), required=True)
    p.add_argument("--term", required=True)
    p = sub.add_parser("render")
    p.add_argument("--pdf-dir", default="source-pdfs")
    p.add_argument("--year", choices=list(PDFS), required=True)
    p.add_argument("--page", type=int, required=True, help="ACTUAL physical PDF page, 1-based; not automatically equal to source_page")
    p.add_argument("--out", required=True)
    p.add_argument("--scale", type=float, default=2)
    args = ap.parse_args()
    try:
        {"init": init, "check": check, "locate": locate, "render": render}[args.command](args)
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
        print(f"AUDIT ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
