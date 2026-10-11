"""Tests for audit_source_pages.py using synthetic (not MPPCB) PDFs."""
import csv
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import fitz

SCRIPT = Path(__file__).resolve().parents[1]/'scripts'/'audit_source_pages.py'
PDFS = {'2023':'2023.pdf', '2024':'2024.pdf','2025':'2025.pdf'}
FIELDS = ['year','festival','site','water_body','phase','parameter','value','unit_assumed','flag',
          'value_as_printed','parameter_as_printed','site_as_printed','site_match_confidence','source_page']

class SourceAuditTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'source-pdfs').mkdir()
        for name in PDFS.values():
            with fitz.open() as doc:
                page=doc.new_page()
                page.insert_text((75,75), 'Example Site  - BOD - 4.4 - during')
                doc.save(self.root/'source-pdfs'/name)
        with (self.root/'test.csv').open('w', newline='', encoding='utf-8') as f:
            w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader()
            w.writerow({'year':'2025','festival':'Ganesh','site':'Example','water_body':'Test',
                        'phase':'during','parameter':'BOD','value':'4.4','unit_assumed':'mg/l',
                        'flag':'','value_as_printed':'4.4','parameter_as_printed':'BOD',
                        'site_as_printed':'Example Site','site_match_confidence':'high','source_page':'1'})
    def run_cli(self, *args):
        return subprocess.run([sys.executable,str(SCRIPT),*args,'--csv',str(self.root/'test.csv'),
                               '--pdf-dir',str(self.root/'source-pdfs'), '--out',str(self.root/'source-audit'),
                               '--allow-subset'], text=True,capture_output=True)
    def test_no_auto_verification_and_incomplete_review(self):
        init=self.run_cli('init')
        self.assertEqual(init.returncode,0,init.stderr)
        raw=self.run_cli('check')
        self.assertEqual(raw.returncode,0,raw.stderr)
        summary=json.loads((self.root/'source-audit'/'audit-summary.json').read_text())
        self.assertEqual(summary['observations_verified_by_reviewer'],0)
        self.assertFalse(summary['complete_manual_source_audit'])
        # Marking individual row verified without page verification must be rejected.
        path=self.root/'source-audit'/'observation_reviews.csv'
        with path.open(newline='',encoding='utf-8') as f:
            r=csv.DictReader(f);rows=list(r);headers=r.fieldnames
        rows[0]['row_status']='verified'
        with path.open('w',newline='',encoding='utf-8') as f:
            w=csv.DictWriter(f,fieldnames=headers);w.writeheader();w.writerows(rows)
        check=self.run_cli('check')
        self.assertEqual(check.returncode,2)
        # Changing any PDF fingerprint fails, invalidating prior reviews.
        with fitz.open() as doc:
            doc.new_page();doc.save(self.root/'source-pdfs'/'2024.pdf')
        stale=self.run_cli('check')
        self.assertEqual(stale.returncode,2)
    def test_complete_manual_record_but_not_full_source(self):
        self.assertEqual(self.run_cli('init').returncode,0)
        for fn, edits in [('page_reviews.csv',{
            'pdf_page_1based':'1','page_basis':'physical','page_status':'verified',
            'visual_check':'yes','reviewer':'test user','reviewed_utc':'2026-10-11T08:00:00Z',
            'notes':'Synthetic fixture visual inspection only'
            }),('observation_reviews.csv',{
            'row_status':'verified','site_text_matches':'yes','parameter_text_matches':'yes',
            'phase_column_matches':'yes','value_or_flag_matches':'yes',
            'reviewer':'test user','reviewed_utc':'2026-10-11T08:00:00Z',
            'notes':'Synthetic fixture check only'
            })]:
            path=self.root/'source-audit'/fn
            with path.open(newline='',encoding='utf-8') as f:
                r=csv.DictReader(f);rows=list(r);headers=r.fieldnames
            rows[0].update(edits)
            with path.open('w',newline='',encoding='utf-8') as f:
                w=csv.DictWriter(f,fieldnames=headers);w.writeheader();w.writerows(rows)
        self.assertEqual(self.run_cli('check').returncode,0)
        report=json.loads((self.root/'source-audit'/'audit-summary.json').read_text())
        self.assertEqual(report['observations_verified_by_reviewer'],1)
        self.assertFalse(report['complete_manual_source_audit'])

if __name__=='__main__':
    unittest.main()
