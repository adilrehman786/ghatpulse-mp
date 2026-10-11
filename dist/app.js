var GP;
(function (GP) {
    GP.CONFIG = {
        comparators: { BOD: { limit: 3, weight: 40, label: '> 3 mg/L', rule: 'BOD > 3 mg/L', description: 'Challenge-provided comparator; confirm BOD sampling and analytical-method comparability before regulatory interpretation.' }, 'Dissolved oxygen': { limit: 5, weight: 40, label: '< 5 mg/L', rule: 'DO < 5 mg/L', description: 'Challenge-provided Class B comparator.' }, pH: { min: 6.5, max: 8.5, weight: 20, label: 'outside 6.5–8.5', rule: 'pH < 6.5 or > 8.5', description: 'Challenge-provided Class B range comparator.' } },
        reports: { '2023': 'https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf', '2024': 'https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf', '2025': 'https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf' },
        official: 'https://raw.githubusercontent.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/main/track-2-visarjan-ghat-watch/data/bhopal_ghats_2023_2025.csv',
        source: 'https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/PROBLEM-STATEMENT.md',
        dataDictionary: 'https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/data/DATA_DICTIONARY.md',
        criteria: 'https://raw.githubusercontent.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/main/track-2-visarjan-ghat-watch/data/cpcb_water_quality_criteria.csv'
    };
    GP.SITE_NAMES = ['Bairagarh (Sant Hirdaram) kund', 'Khatlapura ghat', 'Prempura ghat', 'Rani Kamlapati ghat / Kamla Park kund', 'Hathaikheda dam / kund', 'Malikhedi kund', 'Shahpura lake ghat'];
    GP.PARAMS = ['pH', 'Dissolved oxygen', 'BOD', 'COD', 'Total solids', 'Dissolved solids', 'Suspended solids', 'Turbidity', 'Conductivity', 'Chromium', 'Lead', 'Zinc', 'Copper'];
    GP.FOCUS = ['Dissolved oxygen', 'BOD', 'pH'];
    function textShort(s) { return s.replace(' (Sant Hirdaram)', '').replace(' / Kamla Park kund', ' / Kamla Park').replace(' dam / kund', ' kund').replace(' lake ghat', ' ghat'); }
    GP.textShort = textShort;
    function fmt(n, d = 1) { return n === null || n === undefined || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n); }
    GP.fmt = fmt;
    function reportUrl(o) { const base = GP.CONFIG.reports[o.row.year]; return base ? base + (/^\d+$/.test(o.row.source_page.trim()) ? '#page=' + encodeURIComponent(o.row.source_page.trim()) : '') : null; }
    GP.reportUrl = reportUrl;
})(GP || (GP = {}));
var GP;
(function (GP) {
    GP.REQUIRED = ['year', 'festival', 'site', 'water_body', 'phase', 'parameter', 'value', 'unit_assumed', 'flag', 'value_as_printed', 'parameter_as_printed', 'site_as_printed', 'site_match_confidence', 'source_page'];
    function csvRows(csv) {
        // RFC-4180: quoted fields, escaped quotes, CRLF, embedded newlines.
        const rows = [];
        let row = [], cell = '', inQuotes = false;
        const errors = [];
        if (csv.charCodeAt(0) === 0xFEFF)
            csv = csv.slice(1);
        for (let i = 0; i < csv.length; i++) {
            const c = csv[i];
            if (inQuotes) {
                if (c === '"' && csv[i + 1] === '"') {
                    cell += '"';
                    i++;
                }
                else if (c === '"') {
                    inQuotes = false;
                }
                else {
                    cell += c;
                }
            }
            else if (c === '"' && cell === '') {
                inQuotes = true;
            }
            else if (c === ',') {
                row.push(cell);
                cell = '';
            }
            else if (c === '\n') {
                row.push(cell.replace(/\r$/, ''));
                rows.push(row);
                row = [];
                cell = '';
            }
            else {
                cell += c;
            }
        }
        if (inQuotes)
            errors.push('Unclosed quotation mark at end of CSV.');
        if (cell !== '' || row.length) {
            row.push(cell.replace(/\r$/, ''));
            rows.push(row);
        }
        return { rows, errors };
    }
    GP.csvRows = csvRows;
    function classify(row) {
        const v = (row.value || '').trim(), flag = (row.flag || '').trim().toLowerCase(), printed = (row.value_as_printed || '').trim().toLowerCase();
        if (['bdl', 'nd', 'below detection limit', 'not detected'].includes(flag) || ['bdl', 'nd'].includes(printed))
            return { kind: 'BDL', numeric: null };
        if (['not sampled', '*', '**'].includes(flag) || ['not sampled', '*', '**', '_', '-'].includes(printed) || (!v && !flag && !printed))
            return { kind: 'not sampled', numeric: null };
        if (v !== '' && /^(?:\d+(?:\.\d*)?|\.\d+|\-\d+(?:\.\d*)?)(?:[Ee][+-]?\d+)?$/.test(v)) {
            const n = Number(v);
            if (Number.isFinite(n))
                return { kind: 'numerical', numeric: n };
        }
        return { kind: 'other', numeric: null };
    }
    GP.classify = classify;
    function parseCSV(csv) {
        const { rows, errors } = csvRows(csv);
        const headers = (rows.shift() || []).map(s => s.trim());
        const missing = GP.REQUIRED.filter(h => !headers.includes(h));
        if (missing.length)
            throw new Error('CSV missing required columns: ' + missing.join(', '));
        const warnings = [...errors], records = [];
        let invalid = 0;
        rows.forEach((cells, i) => {
            if (cells.every(v => v.trim() === ''))
                return;
            if (cells.length !== headers.length) {
                invalid++;
                if (warnings.length < 22)
                    warnings.push(`CSV line ${i + 2}: expected ${headers.length} fields, found ${cells.length}.`);
                return;
            }
            const row = {};
            headers.forEach((head, j) => row[head] = cells[j] || '');
            if (!row.site.trim() || !row.parameter.trim() || !/^(2023|2024|2025)$/.test(row.year.trim())) {
                invalid++;
                if (warnings.length < 22)
                    warnings.push(`CSV line ${i + 2}: invalid site, parameter or year.`);
                return;
            }
            const classification = classify(row);
            if (classification.kind === 'other' && warnings.length < 22)
                warnings.push(`CSV line ${i + 2}: unrecognised value / flag, excluded from numerical comparisons.`);
            records.push({ id: i + 2, row, ...classification });
        });
        if (invalid && warnings.length < 22)
            warnings.push(`${invalid} malformed row(s) skipped without coercion.`);
        return { records, warnings, headers, invalid };
    }
    GP.parseCSV = parseCSV;
    function datasetKPIs(records) {
        const numerical = records.filter(o => o.kind === 'numerical');
        const doRows = numerical.filter(o => o.row.parameter === 'Dissolved oxygen');
        const bodRows = numerical.filter(o => o.row.parameter === 'BOD');
        return { total: records.length, numerical: numerical.length, doCount: doRows.filter(o => o.numeric < 5).length, doValid: doRows.length, bodCount: bodRows.filter(o => o.numeric > 3).length, bodValid: bodRows.length, bdl: records.filter(o => o.kind === 'BDL').length, missing: records.filter(o => o.kind === 'not sampled').length, other: records.filter(o => o.kind === 'other').length };
    }
    GP.datasetKPIs = datasetKPIs;
    function matches(o, criteria) { return Object.keys(criteria).every(k => !criteria[k] || criteria[k] === 'all' || (k === 'kind' ? o.kind === criteria[k] : o.row[k] === criteria[k])); }
    GP.matches = matches;
    GP.EXPECTED = { total: 1524, numerical: 1289, doCount: 42, doValid: 116, bodCount: 100, bodValid: 112, bdl: 174, missing: 61 };
    function validateCounts(k) { return Object.keys(GP.EXPECTED).map(key => ({ key, expected: GP.EXPECTED[key], actual: k[key], pass: GP.EXPECTED[key] === k[key] })); }
    GP.validateCounts = validateCounts;
})(GP || (GP = {}));
var GP;
(function (GP) {
    function isExceedance(o) {
        if (o.kind !== 'numerical' || o.numeric === null)
            return null;
        if (o.row.parameter === 'BOD')
            return o.numeric > GP.CONFIG.comparators.BOD.limit;
        if (o.row.parameter === 'Dissolved oxygen')
            return o.numeric < GP.CONFIG.comparators['Dissolved oxygen'].limit;
        if (o.row.parameter === 'pH')
            return o.numeric < GP.CONFIG.comparators.pH.min || o.numeric > GP.CONFIG.comparators.pH.max;
        return null;
    }
    GP.isExceedance = isExceedance;
    function comparison(o) {
        if (!GP.FOCUS.includes(o.row.parameter))
            return 'No Class B comparator in this tool';
        if (o.kind !== 'numerical')
            return 'Not comparable · ' + (o.kind === 'BDL' ? 'below detection limit' : o.kind);
        const comp = o.row.parameter === 'BOD' ? GP.CONFIG.comparators.BOD.rule : o.row.parameter === 'pH' ? GP.CONFIG.comparators.pH.rule : GP.CONFIG.comparators['Dissolved oxygen'].rule;
        return isExceedance(o) ? 'Outside · ' + comp : 'Within comparator · ' + comp;
    }
    GP.comparison = comparison;
    function calculateSite(rows, site) {
        const local = rows.filter(o => o.row.site === site);
        const rates = GP.FOCUS.map((param) => {
            const p = local.filter(o => o.row.parameter === param), valid = p.filter(o => o.kind === 'numerical');
            const exceeded = valid.filter(o => isExceedance(o) === true).length;
            return { param: param, valid: valid.length, exceeded, rate: valid.length ? exceeded / valid.length : null, missing: p.filter(o => o.kind === 'not sampled').length, bdl: p.filter(o => o.kind === 'BDL').length };
        });
        const weighted = rates.filter(r => r.rate !== null);
        const weightSum = weighted.reduce((n, r) => n + GP.CONFIG.comparators[r.param].weight, 0);
        const score = weightSum > 0 ? 100 * weighted.reduce((n, r) => n + r.rate * GP.CONFIG.comparators[r.param].weight, 0) / weightSum : null;
        const valid = rates.reduce((n, r) => n + r.valid, 0), missing = local.filter(o => o.kind === 'not sampled').length, bdl = local.filter(o => o.kind === 'BDL').length;
        const medium = local.some(o => o.row.site_match_confidence === 'medium');
        const absent = rates.filter(r => r.valid === 0).map(r => r.param);
        const warnings = [];
        if (missing)
            warnings.push(`${missing} not-sampled records`);
        if (bdl)
            warnings.push(`${bdl} BDL observations (not zero)`);
        if (absent.length)
            warnings.push('no numerical ' + absent.join(', '));
        if (medium)
            warnings.push('medium-confidence site identity');
        if (local.length && valid < 9)
            warnings.push('limited numerical comparator coverage');
        const rationale = rates.map(r => r.valid ? `${r.param === 'Dissolved oxygen' ? 'DO' : r.param} ${r.exceeded}/${r.valid}` : `${r.param === 'Dissolved oxygen' ? 'DO' : r.param} n/a`).join(' · ');
        return { site, score, valid, total: local.length, missing, bdl, medium, rates, coverageWarning: warnings.join(' · ') || 'Review sampling coverage and original reports', rationale };
    }
    GP.calculateSite = calculateSite;
    function rankSites(rows, sites = GP.SITE_NAMES) {
        return sites.map(site => calculateSite(rows, site)).sort((a, b) => {
            if (a.score === null && b.score !== null)
                return 1;
            if (a.score !== null && b.score === null)
                return -1;
            if (a.score !== null && b.score !== null && Math.abs(a.score - b.score) > 1e-9)
                return b.score - a.score;
            if (a.valid !== b.valid)
                return b.valid - a.valid;
            return a.site.localeCompare(b.site, 'en');
        });
    }
    GP.rankSites = rankSites;
    function notable(rows, site, limit = 3) {
        return rows.filter(o => o.row.site === site && isExceedance(o) === true).sort((a, b) => {
            const importance = (x) => x.row.parameter === 'Dissolved oxygen' ? 100 * ((5 - (x.numeric || 0)) / 5) : x.row.parameter === 'BOD' ? 100 * (((x.numeric || 0) - 3) / 3) : 100;
            return importance(b) - importance(a) || b.row.year.localeCompare(a.row.year) || a.id - b.id;
        }).slice(0, limit);
    }
    GP.notable = notable;
    function suggestedActions(score) {
        const result = ['Request updated DO, BOD and pH sampling with documented time, phase, lab method and chain of custody.'];
        if (score.rates.find(r => r.param === 'Dissolved oxygen')?.exceeded)
            result.push('Prioritise field verification of the historical low-DO observations; do not infer current oxygen levels.');
        if (score.rates.find(r => r.param === 'BOD')?.exceeded)
            result.push('Ask the laboratory to confirm BOD methodology before making regulatory interpretations.');
        if (score.missing || score.rates.some(r => r.valid === 0))
            result.push('Fill phase and parameter sampling gaps before comparing sites as equivalent.');
        if (score.medium)
            result.push('Resolve whether Kamla Park kund and Lower Lake ghat represent the same sampling location.');
        result.push('Verify key entries and page references against the MPPCB PDFs before operational use.');
        return result;
    }
    GP.suggestedActions = suggestedActions;
})(GP || (GP = {}));
var GP;
(function (GP) {
    function makeCSV(rows) {
        const headers = [...GP.REQUIRED, ...Array.from(new Set(rows.flatMap(o => Object.keys(o.row)))).filter(h => !GP.REQUIRED.includes(h))];
        const esc = (s) => /[,\r\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        return '\uFEFF' + headers.join(',') + '\r\n' + rows.map(o => headers.map(key => esc(o.row[key] || '')).join(',')).join('\r\n');
    }
    GP.makeCSV = makeCSV;
    function saveBlob(data, name) { const url = URL.createObjectURL(data), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }
    GP.saveBlob = saveBlob;
    function makeBrief(rows, site, lang) {
        const score = GP.calculateSite(rows, site), top = GP.notable(rows, site, 3);
        const focus = score.rates.map(r => {
            const p = r.param === 'Dissolved oxygen' ? 'DO' : r.param;
            return `${p}: ${r.valid ? `${r.exceeded}/${r.valid}` : 'unavailable'} (${r.valid} ${lang === 'hi' ? 'संख्यात्मक रीडिंग' : 'numerical readings'})`;
        }).join('; ');
        const details = top.map(o => `${o.row.year} ${o.row.festival} / ${o.row.phase}: ${o.row.parameter} ${o.row.value_as_printed || o.row.value} ${o.row.unit_assumed || ''} (${GP.comparison(o)}; ${lang === 'hi' ? 'रिपोर्ट पृष्ठ' : 'report page'} ${o.row.source_page || 'unknown'})`).join('\n') || (lang === 'hi' ? 'दिए गए फ़िल्टर में कोई तुलनात्मक विचलन नहीं मिला।' : 'No comparative exceedance in the selected evidence.');
        const src = [...new Set(rows.filter(o => o.row.site === site).map(o => `${o.row.year} MPPCB report, page ${o.row.source_page || 'unknown'}`))].slice(0, 8).join('; ');
        if (lang === 'hi') {
            const translations = {
                'Request updated DO, BOD and pH sampling with documented time, phase, lab method and chain of custody.': 'दर्ज समय, चरण, लैब विधि और अभिरक्षा विवरण के साथ DO, BOD और pH के नए नमूने लें।',
                'Prioritise field verification of the historical low-DO observations; do not infer current oxygen levels.': 'ऐतिहासिक कम DO रीडिंग की स्थल पर जाँच करें; वर्तमान DO का अनुमान न लगाएँ।',
                'Ask the laboratory to confirm BOD methodology before making regulatory interpretations.': 'नियामक व्याख्या से पहले प्रयोगशाला से BOD विधि सत्यापित करें।',
                'Fill phase and parameter sampling gaps before comparing sites as equivalent.': 'घाटों की तुलना करने से पहले चरण एवं पैरामीटर के सैंपलिंग अंतराल भरें।',
                'Resolve whether Kamla Park kund and Lower Lake ghat represent the same sampling location.': 'जाँचें कि कमला पार्क कुंड और लोअर लेक घाट एक ही नमूना स्थल हैं या अलग।',
                'Verify key entries and page references against the MPPCB PDFs before operational use.': 'संचालन निर्णय से पहले मूल MPPCB PDF और पृष्ठों से रीडिंग मिलाएँ।'
            };
            const actions = GP.suggestedActions(score).map((a, i) => `${i + 1}. ${translations[a] || a}`).join('\n');
            return `घाटपल्स एमपी | ऐतिहासिक निर्णय संक्षेप
घाट: ${site}
अवधि: 2023–2025 | 2026 का लाइव डेटा नहीं

ऐतिहासिक प्राथमिकता संकेत: ${score.score === null ? 'उपलब्ध नहीं' : GP.fmt(score.score, 1) + '/100'}। केवल उदाहरणात्मक सूचकांक; आधिकारिक जोखिम, सुरक्षा या कानूनी निष्कर्ष नहीं।

आधार: ${focus}। DO/BOD/pH की ${score.valid} संख्यात्मक रीडिंग; कुल ${score.total} रिकॉर्ड।

मुख्य स्रोत रीडिंग:
${details}

सीमाएँ: ${score.coverageWarning}। BDL का अर्थ परीक्षण सीमा से नीचे है, शून्य नहीं। बिना नमूने के रिकॉर्ड साफ जल के प्रमाण नहीं हैं। स्थान का मिलान ${score.medium ? 'मध्यम भरोसे का है; पहचान जाँचें' : 'उच्च भरोसे के रूप में दर्ज है; मूल स्रोत जाँचें'}। ऐतिहासिक डेटा वर्तमान पानी की स्थिति, स्वास्थ्य प्रभाव, कानूनी अनुपालन या विसर्जन अनुमति स्थापित नहीं करता। BOD >3 mg/L केवल चुनौती-प्रदत्त तुलनात्मक मान है; लैब विधि एवं सैंपलिंग तुलनीय होने की पुष्टि जरूरी है।

सुझाई गई अगली जाँच:
${actions}

स्रोत संदर्भ: ${src || 'पृष्ठ उपलब्ध नहीं'}। मूल MPPCB रिपोर्ट 2023–2025; पृष्ठ CSV से लिए गए हैं, स्वतंत्र रूप से सत्यापित नहीं।

GHATPULSE MP — ऐतिहासिक प्रोटोटाइप; कोई लाइव सरकारी एकीकरण नहीं।`;
        }
        return `GHATPULSE MP | HISTORICAL DECISION BRIEF\nGhat: ${site}\nCoverage: 2023–2025 | No live 2026 readings\n\nPRIORITY SIGNAL\n${score.score === null ? 'Index unavailable' : GP.fmt(score.score, 1) + '/100'} — illustrative Historical Exceedance Index, not an official risk, safety or regulatory assessment.\n\nMEASUREMENT SUPPORT\n${focus}.\n${score.valid} numeric DO/BOD/pH readings across ${score.total} recorded observations.\n\nSELECTED SOURCE EVIDENCE\n${details}\n\nEVIDENCE LIMITATIONS\n${score.coverageWarning}. BDL means below detection limit, not zero. Unsampled records are not evidence of clean water. Site matching: ${score.medium ? 'medium confidence; verify potentially distinct locations' : 'marked high confidence; still verify original site labels'}. Historical results cannot establish present conditions, health outcomes, legal compliance or immersion approval. The BOD >3 mg/L rule is a challenge-provided comparator subject to confirmation of sampling and method comparability.\n\nRECOMMENDED CHECKS\n${GP.suggestedActions(score).map((x, i) => `${i + 1}. ${x}`).join('\n')}\n\nSOURCE REFERENCES\n${src || 'No source page provided'}\nMPPCB original reports for 2023, 2024 and 2025; printed references are reported from CSV and not independently page-verified.\n\nHistorical prototype. No live government integrations.`;
    }
    GP.makeBrief = makeBrief;
    // Small, dependency-free Latin text PDF. Hindi uses browser Print to PDF for correct Devanagari shaping.
    function englishPDF(title, body) {
        const safe = (s) => s.replace(/[–—−]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[…]/g, '...').replace(/[·•]/g, ';').replace(/×/g, 'x').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[^\x20-\x7e]/g, '?');
        const lines = [];
        body.split('\n').forEach(par => { if (!par.trim()) {
            lines.push(' ');
            return;
        } let rest = par.replace(/\s+/g, ' ').trim(); while (rest.length > 91) {
            let at = rest.lastIndexOf(' ', 91);
            if (at < 20)
                at = 91;
            lines.push(rest.slice(0, at));
            rest = rest.slice(at).trim();
        } lines.push(rest); });
        const pages = [];
        for (let i = 0; i < lines.length; i += 53)
            pages.push(lines.slice(i, i + 53));
        if (!pages.length)
            pages.push(['No content']);
        const objects = [];
        const add = (s) => { objects.push(s); return objects.length; };
        const catalog = add(''), pagesIndex = add(''), font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
        const kids = [];
        pages.forEach((p, page) => {
            const ops = ['BT /F1 10 Tf 45 775 Td 14 TL'];
            p.forEach((s, i) => { ops.push((i ? 'T* ' : '') + '(' + safe(s) + ') Tj'); });
            ops.push('ET');
            const stream = ops.join('\n');
            const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
            const pageId = add(`<< /Type /Page /Parent ${pagesIndex} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
            kids.push(pageId);
        });
        objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesIndex} 0 R >>`;
        objects[pagesIndex - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
        let pdf = '%PDF-1.4\n';
        const starts = [0];
        objects.forEach((obj, i) => { starts.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; });
        const xref = pdf.length;
        pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        for (let i = 1; i < starts.length; i++)
            pdf += String(starts[i]).padStart(10, '0') + ' 00000 n \n';
        pdf += `trailer\n<< /Root ${catalog} 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF`;
        return new Blob([pdf], { type: 'application/pdf' });
    }
    GP.englishPDF = englishPDF;
})(GP || (GP = {}));
var GP;
(function (GP) {
    const h = (type, props, ...children) => React.createElement(type, props, ...children);
    const el = (tag, cls, ...children) => h(tag, { className: cls }, ...children);
    const icons = {
        grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
        waves: '<path d="M2 12c2.1 0 2.1-2 4.2-2s2.1 2 4.2 2 2.1-2 4.2-2 2.1 2 4.2 2 2.1-2 4.2-2"/><path d="M2 18c2.1 0 2.1-2 4.2-2s2.1 2 4.2 2 2.1-2 4.2-2 2.1 2 4.2 2 2.1-2 4.2-2"/><path d="M2 6c2.1 0 2.1-2 4.2-2s2.1 2 4.2 2 2.1-2 4.2-2 2.1 2 4.2 2 2.1-2 4.2-2"/>',
        list: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M9 9h12M9 15h12"/>',
        file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>',
        arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
        down: '<path d="m6 9 6 6 6-6"/>',
        check: '<path d="m5 12 4 4L19 6"/>',
        alert: '<path d="M10.3 3.8 1.8 18.4A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.6L13.7 3.8a2 2 0 0 0-3.4 0z"/><path d="M12 9v4m0 4h.01"/>',
        close: '<path d="M18 6 6 18M6 6l12 12"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
        download: '<path d="M12 3v12m-4-4 4 4 4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
        external: '<path d="M14 3h7v7m0-7-9 9"/><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>',
        refresh: '<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 4v7h-7"/>',
        chevron: '<path d="m9 18 6-6-6-6"/>',
        filter: '<path d="M4 7h16M7 12h10m-7 5h4"/>',
        print: '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
        book: '<path d="M4 19.5a2.5 2.5 0 0 1 2.5-2.5H20M4 19.5V4a2 2 0 0 1 2-2h14v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
        shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
        upload: '<path d="M12 16V3m-4 4 4-4 4 4M3 17v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/>'
    };
    const icon = (name, size = 18) => h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, dangerouslySetInnerHTML: { __html: icons[name] || icons.info } });
    const btn = (text, click, variant = 'secondary', name) => h('button', { type: 'button', className: 'btn ' + variant, onClick: click }, name ? icon(name, 16) : null, text);
    const link = (text, url, cls = 'inline-link') => h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', className: cls }, text, icon('external', 13));
    const notice = (headline, body, cls = 'soft') => el('div', 'notice ' + cls, icon(cls === 'warn' ? 'alert' : 'info', 18), el('div', '', h('strong', null, headline), h('p', null, body)));
    const field = (label, value, options, onChange, cls = '') => h('label', { className: 'field ' + cls }, h('span', null, label), h('select', { value, onChange: (e) => onChange(e.target.value) }, ...(cls === 'site-selector' ? [] : [h('option', { value: 'all' }, 'All')]), ...options.map(o => h('option', { value: o, key: o }, o))));
    const chip = (s, cls = '') => h('span', { className: 'chip ' + cls }, s);
    const ratio = (num, den) => den ? `${num}/${den}` : '— / 0';
    const siteInitials = (s) => s.split(/[ /()]+/).filter(Boolean).slice(0, 2).map(a => a[0]).join('').toUpperCase();
    const abbr = (p) => p === 'Dissolved oxygen' ? 'DO' : p;
    const unit = (p) => p === 'pH' ? 'pH units' : 'mg/L';
    const fmtVal = (o) => o.row.value_as_printed || o.row.value || (o.kind === 'not sampled' ? '—' : o.kind);
    function htmlStatus(o) { const ex = GP.isExceedance(o); return chip(o.kind === 'BDL' ? 'BDL' : o.kind === 'not sampled' ? 'Not sampled' : o.kind === 'other' ? 'Unrecognised' : ex === true ? 'Outside comparator' : ex === false ? 'Within comparator' : 'Numeric', 'status ' + (o.kind !== 'numerical' ? 'muted' : ex ? 'fail' : 'pass')); }
    class App extends React.Component {
        constructor(props) {
            super(props);
            this.fileInput = null;
            this.focusReturn = null;
            this.onKeyDown = (e) => { if (!this.state.detail)
                return; if (e.key === 'Escape') {
                e.preventDefault();
                this.closeRecord();
                return;
            } if (e.key === 'Tab') {
                const dialog = document.querySelector('.drawer');
                const focusable = Array.from(dialog?.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),[tabindex="0"]') || []);
                if (!focusable.length)
                    return;
                const first = focusable[0], last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            } };
            this.importFile = async (e) => { const f = e.target.files?.[0]; if (!f)
                return; try {
                const csv = await f.text();
                const parsed = GP.parseCSV(csv);
                if (!parsed.records.length)
                    throw Error('No valid source observations');
                localStorage.setItem('ghatpulse-official-csv', csv);
                this.adopt(csv, 'Imported file · ' + f.name, false);
                this.message(`Imported ${parsed.records.length} observations.`);
            }
            catch (err) {
                this.setState({ error: 'Import failed: ' + String(err), loading: false });
            }
            finally {
                e.target.value = '';
            } };
            this.state = { section: 'overview', records: [], source: '', isFull: false, loading: true, error: '', warnings: [], selectedSite: GP.SITE_NAMES[0], tab: 'Overview', detail: null, mobile: false, year: 'all', festival: 'all', phase: 'all', parameter: 'all', search: '', filters: { site: 'all', year: 'all', festival: 'all', phase: 'all', parameter: 'all', kind: 'all', site_match_confidence: 'all' }, sortKey: 'year', sortAsc: false, page: 1, lang: 'en', thresholds: true, feedback: '', invalid: 0 };
        }
        componentDidMount() { this.load(false); document.addEventListener('keydown', this.onKeyDown); }
        componentWillUnmount() { document.removeEventListener('keydown', this.onKeyDown); }
        closeRecord() { this.setState({ detail: null }); setTimeout(() => this.focusReturn?.focus(), 10); }
        async load(force) {
            this.setState({ loading: true, error: '', feedback: force ? 'Re-reading source data…' : '' });
            const paths = force ? ['./data/bhopal_ghats_2023_2025.csv', GP.CONFIG.official, './data/verified_excerpt.csv'] : [];
            try {
                const reuseImported = force && (this.state.source.startsWith('Imported file') || this.state.source === 'Locally saved CSV');
                if (!force || reuseImported) {
                    const cached = localStorage.getItem('ghatpulse-official-csv');
                    if (cached) {
                        try {
                            this.adopt(cached, 'Locally saved CSV', false);
                            return;
                        }
                        catch (e) {
                            localStorage.removeItem('ghatpulse-official-csv');
                        }
                    }
                }
                if (!force)
                    paths.push('./data/bhopal_ghats_2023_2025.csv', GP.CONFIG.official, './data/verified_excerpt.csv');
                for (const path of paths) {
                    try {
                        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), path === GP.CONFIG.official ? 5000 : 3500);
                        let response;
                        try {
                            response = await fetch(path, { signal: controller.signal, cache: force ? 'no-store' : 'default' });
                        }
                        finally {
                            clearTimeout(timer);
                        }
                        if (!response.ok)
                            continue;
                        const csv = await response.text();
                        this.adopt(csv, path.includes('verified_excerpt') ? 'Source-transcribed excerpt · NOT full dataset' : path === GP.CONFIG.official ? 'Official source · GitHub CSV' : 'Bundled official dataset', path.includes('verified_excerpt'));
                        return;
                    }
                    catch (e) { /* Try next source; surface error only after all sources fail. */ }
                }
                throw Error('No CSV could be read. Add the official CSV in public/data or import it with the Upload CSV button.');
            }
            catch (err) {
                this.setState({ loading: false, error: String(err) });
            }
        }
        adopt(csv, source, excerpt) {
            const parsed = GP.parseCSV(csv);
            if (!parsed.records.length)
                throw Error('CSV contains no usable observations.');
            const k = GP.datasetKPIs(parsed.records);
            const isFull = !excerpt && GP.validateCounts(k).every(v => v.pass) && GP.SITE_NAMES.every(site => parsed.records.some(o => o.row.site === site));
            const warnings = [...parsed.warnings];
            if (!isFull)
                warnings.unshift('This is not a verified full 1,524-record dataset. Conclusions and KPI totals apply only to loaded records. Import or fetch the official CSV.');
            this.setState({ records: parsed.records, source, isFull, loading: false, error: '', warnings, invalid: parsed.invalid, selectedSite: GP.SITE_NAMES.includes(this.state.selectedSite) ? this.state.selectedSite : parsed.records[0].row.site, page: 1, feedback: '' });
        }
        navigate(section) { this.setState({ section, mobile: false, feedback: '', detail: null }); window.scrollTo({ top: 0, behavior: 'auto' }); }
        viewSite(site, tab = 'Overview') { this.setState({ selectedSite: site, section: 'ghat', tab, year: 'all', festival: 'all', phase: 'all', parameter: 'all', detail: null, mobile: false }); window.scrollTo(0, 0); }
        selectSite(site) { this.setState({ selectedSite: site, detail: null }); }
        viewRecord(o) { this.focusReturn = document.activeElement; this.setState({ detail: o }); setTimeout(() => { const target = document.querySelector('[data-close-drawer]'); target?.focus(); }, 10); }
        message(s) { this.setState({ feedback: s }); setTimeout(() => this.setState(st => st.feedback === s ? { feedback: '' } : {}), 3600); }
        explorerRows() {
            const { records, filters, search, sortKey, sortAsc } = this.state;
            const needle = search.trim().toLowerCase();
            return records.filter(o => GP.matches(o, filters)).filter(o => !needle || Object.values(o.row).some((v) => String(v).toLowerCase().includes(needle)) || o.kind.toLowerCase().includes(needle)).sort((a, b) => {
                let x = sortKey === 'kind' ? a.kind : sortKey === 'numeric' ? a.numeric : a.row[sortKey];
                let y = sortKey === 'kind' ? b.kind : sortKey === 'numeric' ? b.numeric : b.row[sortKey];
                let cmp = 0;
                if (sortKey === 'numeric')
                    cmp = (x === null ? -Infinity : Number(x)) - (y === null ? -Infinity : Number(y));
                else if (sortKey === 'year' || sortKey === 'source_page')
                    cmp = Number(x) - Number(y);
                else
                    cmp = String(x).localeCompare(String(y));
                return (sortAsc ? cmp : -cmp) || a.id - b.id;
            });
        }
        ghatRows() { const { records, selectedSite, year, festival, phase, parameter } = this.state; return records.filter(o => o.row.site === selectedSite && (!year || year === 'all' || o.row.year === year) && (!festival || festival === 'all' || o.row.festival === festival) && (!phase || phase === 'all' || o.row.phase === phase) && (!parameter || parameter === 'all' || o.row.parameter === parameter)); }
        filtersBar(detail = false) { const set = (key, v) => this.setState({ [key]: v }); return el('div', 'filters-bar', field('Year', this.state.year, ['2023', '2024', '2025'], v => set('year', v)), field('Festival', this.state.festival, ['Ganesh', 'Durga'], v => set('festival', v)), field('Phase', this.state.phase, ['pre', 'during', 'after'], v => set('phase', v)), detail ? field('Parameter', this.state.parameter, GP.PARAMS, v => set('parameter', v)) : null, btn('Reset', () => this.setState({ year: 'all', festival: 'all', phase: 'all', parameter: 'all' }), 'ghost', 'refresh')); }
        sectionHeader(eyebrow, title, subtitle, actions) { return el('div', 'section-header', el('div', '', el('div', 'eyebrow', eyebrow), h('h1', null, title), h('p', null, subtitle)), actions || null); }
        navButton(key, name, ico) { const active = this.state.section === key; return h('button', { className: 'nav-item' + (active ? ' active' : ''), type: 'button', onClick: () => this.navigate(key), 'aria-current': active ? 'page' : undefined }, icon(ico, 18), h('span', null, name), active ? icon('chevron', 14) : null); }
        sidebar() {
            return h('aside', { className: 'sidebar' + (this.state.mobile ? ' open' : ''), id: 'main-nav' }, el('div', 'brand-wrap', h('div', { className: 'brand-emblem' }, icon('waves', 26)), el('div', '', h('div', { className: 'brand-title' }, 'GHATPULSE', h('span', null, ' MP')), h('div', { className: 'brand-subtitle' }, 'ENVIRONMENTAL INTELLIGENCE'))), el('div', 'nav-label', 'WORKSPACE'), h('nav', { 'aria-label': 'Primary navigation' }, this.navButton('overview', 'Overview', 'grid'), this.navButton('ghat', 'Ghat Intelligence', 'waves'), this.navButton('explorer', 'Evidence Explorer', 'list'), this.navButton('brief', 'Decision Brief', 'file'), this.navButton('method', 'Methodology & Data', 'book')), el('div', 'side-spacer'), el('div', 'sidebar-info', el('div', 'live-dot-row', h('span', { className: 'small-dot' }), 'HISTORICAL RECORDS'), h('p', null, '2023 — 2025'), h('div', { className: 'thin-line' }), el('div', 'side-note', icon('shield', 18), h('span', null, 'Independent evidence review. No real-time monitoring or government connection.'))), el('div', 'sidebar-footer', 'BHOPAL', el('div', 'foot-small', ' Visarjan Ghat Watch')));
        }
        header() {
            return el('header', 'topbar', el('div', 'topbar-left', h('button', { className: 'mobile-menu', onClick: () => this.setState({ mobile: !this.state.mobile }), 'aria-label': this.state.mobile ? 'Close navigation' : 'Open navigation', 'aria-expanded': this.state.mobile, 'aria-controls': 'main-nav' }, icon(this.state.mobile ? 'close' : 'menu', 21)), el('div', 'crumb', 'BHOPAL', h('span', null, '/'), this.state.section === 'overview' ? 'Overview' : { ghat: 'Ghat intelligence', explorer: 'Evidence explorer', brief: 'Decision brief', method: 'Methodology & data' }[this.state.section])), el('div', 'topbar-actions', chip(this.state.isFull ? 'Full historical dataset' : 'Partial data · verification needed', 'source-chip ' + (this.state.isFull ? 'good' : 'warn')), h('label', { className: 'btn secondary top-upload', title: 'Import the official CSV file', tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.fileInput?.click();
                } } }, icon('upload', 16), h('span', null, 'Import CSV'), h('input', { type: 'file', accept: '.csv,text/csv', ref: (r) => this.fileInput = r, onChange: this.importFile, style: { display: 'none' } })), h('button', { className: 'icon-button', onClick: () => this.load(true), title: 'Re-fetch the latest published historical CSV or fallback excerpt', 'aria-label': 'Reload source CSV' }, icon('refresh', 19))));
        }
        loading() { return el('div', 'loading-box', h('div', { className: 'spinner', 'aria-hidden': true }), h('h2', null, 'Reading the historical record'), h('p', null, 'Loading the original CSV, checking fields, and calculating evidence-supported signals.')); }
        overview() {
            const all = this.state.records, k = GP.datasetKPIs(all), ranking = GP.rankSites(all), top = ranking[0];
            const numbers = [['Total source records', GP.fmt(k.total, 0), 'database', 'All observations'], ['Numerical readings', GP.fmt(k.numerical, 0), 'activity', 'Measured values only'], ['Low DO readings', ratio(k.doCount, k.doValid), 'waves', 'Below 5 mg/L · valid DO'], ['Elevated BOD', ratio(k.bodCount, k.bodValid), 'alert', 'Above 3 mg/L · valid BOD'], ['Sampling gaps', GP.fmt(k.missing, 0), 'filter', `${k.bdl} BDL · kept separate`]];
            const years = ['2023', '2024', '2025'].map(year => { const r = all.filter(o => o.row.year === year), doLow = r.filter(o => o.row.parameter === 'Dissolved oxygen' && GP.isExceedance(o) === true).length, bod = r.filter(o => o.row.parameter === 'BOD' && GP.isExceedance(o) === true).length; return { year, doLow, bod, total: r.length }; });
            return el('div', 'page', el('div', 'intro-panel', el('div', 'intro-copy', el('div', 'intro-tags', chip('2023–2025  /  HISTORICAL EVIDENCE', 'invert'), chip('NO LIVE 2026 READINGS', 'invert dim')), h('h1', null, 'Understand the risk signals', h('br'), h('em', null, 'before the next immersion.')), h('p', null, 'Explore historical water-test observations, trace each signal to its report, and prioritise updated sampling or inspection — without mistaking old data for current conditions.'), el('div', 'intro-actions', btn('Explore ghat intelligence', () => this.viewSite(top?.site || GP.SITE_NAMES[0]), 'primary', 'arrow'), link('View source methodology', GP.CONFIG.source, 'light-link'))), el('div', 'intro-side', el('div', 'eyebrow light', 'THE EVIDENCE PATH'), el('div', 'path-item', el('b', 'number', '01'), el('div', '', h('strong', null, 'Identify'), h('p', null, 'Compare historical exceedance rates.'))), el('div', 'path-item', el('b', 'number', '02'), el('div', '', h('strong', null, 'Verify'), h('p', null, 'Open original printed values and pages.'))), el('div', 'path-item', el('b', 'number', '03'), el('div', '', h('strong', null, 'Act carefully'), h('p', null, 'Produce a qualified sampling brief.'))))), !this.state.isFull ? notice('Partial source loaded — rankings are provisional', 'The full 1,524-row CSV was not available in this environment. These totals and ranks apply ONLY to the verified excerpt currently loaded. Import the official CSV to calculate full-dataset results.', 'warn') : notice('Full historical pack loaded', 'These are published 2023–2025 records, not live sampling. Exact page links use source metadata; PDF pages have not been independently verified.', 'soft'), el('div', 'metric-grid', ...numbers.map(([label, value, ic, help]) => el('div', 'metric-card', el('div', 'metric-head', h('span', null, label), icon(ic, 17)), h('div', { className: 'metric-value' }, value), h('div', { className: 'metric-help' }, help)))), el('div', 'content-grid', el('section', 'panel ranking-panel', el('div', 'panel-head', el('div', '', el('div', 'eyebrow', 'HISTORICAL PRIORITY'), h('h2', null, 'Where should we investigate first?'), h('p', null, 'Illustrative index / 100, ranked by measured exceedance rates.')), btn('Open evidence table', () => this.navigate('explorer'), 'ghost', 'arrow')), el('div', 'rank-caption', h('span', null, 'GHAT / SUPPORT'), h('span', null, 'INDEX'), h('span', null, 'ACTION')), ...ranking.map((r, i) => h('button', { type: 'button', key: r.site, className: 'rank-row', onClick: () => this.viewSite(r.site, 'Source Evidence') }, el('div', 'rank-ident', el('span', 'rank-number', String(i + 1).padStart(2, '0')), el('div', 'rank-circle', siteInitials(r.site)), el('div', 'rank-name', h('strong', null, GP.textShort(r.site)), h('span', null, `${r.valid} comparator values · ${r.total} records`, r.medium ? ' · site match: medium' : ''), h('small', null, r.rationale), h('small', { className: 'coverage-mini' }, r.coverageWarning))), el('div', 'rank-score', h('strong', null, r.score === null ? 'N/A' : GP.fmt(r.score, 1)), h('span', { className: 'bar-track' }, h('span', { className: 'bar-fill', style: { width: `${r.score || 0}%` } }))), h('span', { className: 'row-action' }, 'View evidence', icon('arrow', 15))))), el('aside', 'right-stack', el('section', 'panel insight-panel', el('div', 'eyebrow', 'DECISION NOTE'), h('h2', null, 'Evidence, not assumptions.'), h('p', null, 'The index is only a screening aid. A high score is a reason to verify and resample — not proof that a site is unsafe today.'), el('div', 'mini-rule'), ...['BDL is not zero', 'No sample is not clean', 'Site names may need verification'].map(t => el('div', 'check-row', icon('check', 15), t)), btn('Prepare a decision brief', () => this.navigate('brief'), 'primary full', 'file')), el('section', 'panel chart-panel', el('div', 'eyebrow', 'BY REPORT YEAR'), h('h3', null, 'Historical comparisons'), h('p', null, 'Counts outside challenge comparators'), ...years.map(({ year, doLow, bod, total }) => el('div', 'year-compare', el('div', 'year-top', h('b', null, year), h('span', null, `${total} observations`)), el('div', 'year-bar', h('div', { style: { width: `${bod ? Math.max(2, bod / Math.max(1, k.bodCount) * 100) : 0}%` }, className: 'year-bar-bod' }), h('div', { style: { width: `${doLow ? Math.max(2, doLow / Math.max(1, k.doCount) * 100) : 0}%` }, className: 'year-bar-do' })), el('div', 'year-legend', `BOD ${bod}`, `DO ${doLow}`))), el('div', 'legend', el('span', 'legend-dot bod'), 'BOD above 3', el('span', 'legend-dot do'), 'DO below 5')))));
        }
        chart(rows, param) {
            const relevant = rows.filter(o => o.row.parameter === param).sort((a, b) => a.row.year.localeCompare(b.row.year) || a.row.festival.localeCompare(b.row.festival) || ['pre', 'during', 'after'].indexOf(a.row.phase) - ['pre', 'during', 'after'].indexOf(b.row.phase));
            const vals = relevant.filter(o => o.numeric !== null).map(o => o.numeric);
            const threshold = param === 'BOD' ? 3 : param === 'Dissolved oxygen' ? 5 : null;
            const thresholds = param === 'pH' ? [6.5, 8.5] : threshold === null ? [] : [threshold];
            const xMax = Math.max(5, relevant.length - 1), vmax = Math.max(...vals, ...thresholds, 1), ymax = Math.max(vmax * 1.2, 10), w = Math.max(700, Math.min(1450, relevant.length * 55 + 70)), height = 235, pad = { l: 44, r: 20, t: 22, b: 55 };
            const x = (i) => pad.l + i * (w - pad.l - pad.r) / xMax, y = (v) => pad.t + (height - pad.t - pad.b) * (1 - v / ymax);
            const points = relevant.map((o, i) => ({ o, x: x(i), y: o.numeric === null ? null : y(o.numeric) }));
            return el('div', 'chart-scroll', h('svg', { className: 'trend-svg', width: w, height, viewBox: `0 0 ${w} ${height}`, role: 'img', 'aria-label': `${param} historic chart; each point includes original year, festival, phase, report page and numeric reading. Missing results shown with crosses.` }, ...[0, .25, .5, .75, 1].map(frac => h('g', { key: 'grid' + frac }, h('line', { x1: pad.l, y1: y(ymax * frac), x2: w - pad.r, y2: y(ymax * frac), stroke: '#e6eef0', strokeWidth: 1 }), h('text', { x: pad.l - 10, y: y(ymax * frac) + 4, textAnchor: 'end', fontSize: 11, fill: '#7b8995' }, GP.fmt(ymax * frac, 1)))), this.state.thresholds ? thresholds.map(t => h('g', { key: t }, h('line', { x1: pad.l, y1: y(t), x2: w - pad.r, y2: y(t), stroke: '#c16c53', strokeWidth: 1.7, strokeDasharray: '6 6' }), h('text', { x: w - pad.r - 4, y: y(t) - 7, textAnchor: 'end', fill: '#a95342', fontSize: 11 }, 'Comparator ' + t + (param === 'pH' ? '' : ' mg/L')))) : null, ...points.map(({ o, x: px, y: py }, i) => h('g', { key: o.id }, py !== null && i > 0 && points[i - 1].y !== null ? h('line', { x1: points[i - 1].x, y1: points[i - 1].y, x2: px, y2: py, stroke: '#167e86', strokeWidth: 2.2 }) : null, py !== null ? h('circle', { cx: px, cy: py, r: 5.3, fill: GP.isExceedance(o) ? '#c96552' : '#17888b', stroke: '#fff', strokeWidth: 2, tabIndex: 0, role: 'img', 'aria-label': `${o.row.year} ${o.row.festival} ${o.row.phase}: ${fmtVal(o)} ${unit(param)}, source page ${o.row.source_page}` }, h('title', null, `${o.row.year} · ${o.row.festival} · ${o.row.phase}\n${param}: ${fmtVal(o)} ${unit(param)}\nPage ${o.row.source_page} · ${GP.comparison(o)}`)) : h('g', null, h('line', { x1: px - 5, x2: px + 5, y1: height - pad.b - 13, y2: height - pad.b - 3, stroke: '#98a3aa', strokeWidth: 2 }), h('line', { x1: px + 5, x2: px - 5, y1: height - pad.b - 13, y2: height - pad.b - 3, stroke: '#98a3aa', strokeWidth: 2 }), h('title', null, `${o.row.year} ${o.row.festival} ${o.row.phase}: ${o.kind}`)), h('text', { x: px, y: height - pad.b + 18, textAnchor: 'middle', fontSize: 10, fill: '#596a76' }, o.row.year), h('text', { x: px, y: height - pad.b + 32, textAnchor: 'middle', fontSize: 10, fill: '#84909b' }, `${o.row.festival.slice(0, 1)} / ${o.row.phase.slice(0, 3)}`))), h('text', { x: pad.l + 4, y: 13, fontSize: 11, fill: '#60737e' }, unit(param))));
        }
        evidenceRows(rows, limit = 12) {
            const shown = [...rows].sort((a, b) => b.row.year.localeCompare(a.row.year) || a.row.festival.localeCompare(b.row.festival) || a.id - b.id).slice(0, limit);
            return shown.length ? el('div', 'evidence-list', ...shown.map(o => h('button', { key: o.id, type: 'button', className: 'evidence-row', onClick: () => this.viewRecord(o) }, el('span', 'evidence-parameter', abbr(o.row.parameter), h('small', null, `${o.row.year} · ${o.row.festival} / ${o.row.phase}`)), el('span', 'evidence-value', fmtVal(o), h('small', null, o.row.unit_assumed || 'pH')), htmlStatus(o), h('span', { className: 'page-ref' }, 'p. ' + (o.row.source_page || '—'), icon('chevron', 16))))) : notice('No observations in this selection', 'Broaden filters, or inspect missing phases in the full historical dataset.');
        }
        ghat() {
            const rows = this.ghatRows(), score = GP.calculateSite(rows, this.state.selectedSite);
            const worst = GP.notable(rows, this.state.selectedSite, 3);
            const summary = el('div', 'ghat-summary', el('div', 'ghat-main-stat', el('div', 'eyebrow', 'HISTORICAL EXCEEDANCE INDEX'), el('div', 'giant-score', score.score === null ? 'N/A' : GP.fmt(score.score, 1), h('span', null, '/ 100')), h('p', null, 'Illustrative historical prioritisation only — not a live status, regulatory decision, or prediction.'), el('div', 'summary-tags', chip(`${score.valid} comparator readings`), chip(`${rows.length} records in selection`), chip(score.medium ? 'Medium site match' : 'Source-marked high match', 'amber'))), el('div', 'ghat-summary-side', h('h3', null, 'Why this index?'), h('p', null, score.rationale), h('p', null, score.coverageWarning), el('div', 'mini-rule'), el('div', 'summary-actions', btn('Open evidence', () => this.setState({ tab: 'Source Evidence' }), 'secondary', 'list'), btn('Create brief', () => this.navigate('brief'), 'primary', 'arrow'))));
            const parameters = el('div', 'parameter-grid', ...score.rates.map(r => el('div', 'parameter-card', el('div', 'p-head', h('span', null, abbr(r.param)), chip(r.valid ? `${r.valid} valid` : 'Unavailable', r.valid ? '' : 'amber')), h('strong', null, r.valid ? `${r.exceeded} / ${r.valid}` : '—'), h('p', null, r.valid ? `${GP.fmt((r.rate || 0) * 100, 0)}% outside comparator` : 'No numerical readings for this selection'), h('small', null, r.param === 'BOD' ? '> 3 mg/L' : r.param === 'Dissolved oxygen' ? '< 5 mg/L' : 'outside 6.5–8.5'), r.missing || r.bdl ? h('div', { className: 'coverage-indicator' }, `${r.missing} unsampled · ${r.bdl} BDL`) : null)));
            const tabs = h('div', { className: 'segment-tabs', role: 'tablist', 'aria-label': 'Ghat detail sections' }, ...['Overview', 'Historical Trends', 'Source Evidence', 'Recommended Checks'].map(t => h('button', { type: 'button', role: 'tab', 'aria-selected': this.state.tab === t, className: this.state.tab === t ? 'active' : '', onClick: () => this.setState({ tab: t }) }, t)));
            const overviewTab = el('div', 'detail-columns', el('section', 'panel padded', el('div', 'eyebrow', 'MOST NOTABLE RECORDS'), h('h2', null, 'Three observations to verify'), h('p', null, 'Selected from measured comparator exceedances; click for exact source values.'), worst.length ? this.evidenceRows(worst, 3) : notice('No recorded exceedances', 'None in this filter selection; does not imply current water quality.')), el('section', 'panel padded', el('div', 'eyebrow', 'EVIDENCE COMPLETENESS'), h('h2', null, 'What we know — and do not'), ...[['Total observations', rows.length], ['Numerical comparator values', score.valid], ['BDL observations', score.bdl], ['Not sampled', score.missing], ['Site match confidence', score.medium ? 'Medium' : 'High']].map(([name, value]) => el('div', 'fact-row', h('span', null, name), h('strong', null, value))), notice('Practical next step', 'Confirm sampling location and obtain updated DO / BOD / pH readings with source documentation.')));
            const trendCharts = GP.FOCUS.map(param => el('div', 'single-chart', el('div', 'chart-head', h('h3', null, abbr(param)), h('p', null, param === 'pH' ? 'Challenge range: 6.5 to 8.5' : 'Challenge comparator: ' + (param === 'BOD' ? '> 3' : '< 5') + ' mg/L')), this.chart(rows, param), el('div', 'chart-hint', icon('info', 14), 'Hover or focus a point for exact reading, phase, festival and source page.')));
            const trendTab = el('div', 'trends-panel', el('section', 'panel chart-detail', el('div', 'panel-head', el('div', '', h('h2', null, 'Historical parameters'), h('p', null, 'Exact observations; no interpolation. Crosses represent missing or BDL values.')), h('label', { className: 'toggle' }, h('input', { type: 'checkbox', checked: this.state.thresholds, onChange: (e) => this.setState({ thresholds: e.target.checked }) }), 'Show comparison lines')), ...trendCharts), el('section', 'panel padded', h('h3', null, 'Missing observations'), this.evidenceRows(rows.filter(o => o.kind !== 'numerical'), 10)));
            const sourceTab = el('section', 'panel padded', el('div', 'panel-head', el('div', '', h('h2', null, 'Source-linked observations'), h('p', null, `${rows.length} records after filters. Printed values and page references preserved.`)), btn('Search all evidence', () => { this.setState({ filters: { ...this.state.filters, site: this.state.selectedSite }, page: 1 }); this.navigate('explorer'); }, 'secondary', 'arrow')), this.evidenceRows(rows, 200));
            const checkTab = el('div', 'detail-columns', el('section', 'panel padded', el('div', 'eyebrow', 'RECOMMENDED NEXT ACTION'), h('h2', null, 'Verify before operations'), ...GP.suggestedActions(score).map((action, i) => el('div', 'action-item', el('span', 'step-no', String(i + 1).padStart(2, '0')), h('p', null, action))), btn('Build a shareable brief', () => this.navigate('brief'), 'primary', 'file')), el('section', 'panel padded', el('div', 'eyebrow', 'SOURCE CONFIDENCE'), h('h2', null, 'Caveats that must travel with the data'), h('p', null, score.coverageWarning), h('p', null, 'Page numbers come from CSV; page jumps are not independently verified.'), ...Object.entries(GP.CONFIG.reports).map(([year, url]) => el('div', 'source-list-row', h('span', null, `${year} MPPCB report`), link('Open PDF', url)))));
            const tabContent = this.state.tab === 'Overview' ? overviewTab : this.state.tab === 'Historical Trends' ? trendTab : this.state.tab === 'Source Evidence' ? sourceTab : checkTab;
            return el('div', 'page', this.sectionHeader('SITE-SPECIFIC EVIDENCE', 'Ghat Intelligence', 'Trace historical signals to individual observations, with evidence limitations visible.', field('Selected ghat', this.state.selectedSite, GP.SITE_NAMES, v => this.selectSite(v), 'site-selector')), this.filtersBar(true), summary, parameters, tabs, tabContent);
        }
        explorer() {
            const filtered = this.explorerRows(), perPage = 15, pages = Math.max(1, Math.ceil(filtered.length / perPage)), page = Math.min(this.state.page, pages), shown = filtered.slice((page - 1) * perPage, page * perPage);
            const f = this.state.filters, change = (key, value) => this.setState({ filters: { ...this.state.filters, [key]: value }, page: 1 });
            const sort = (key) => this.setState({ sortKey: key, sortAsc: key === this.state.sortKey ? !this.state.sortAsc : true, page: 1 });
            const head = (label, key) => h('th', { scope: 'col' }, h('button', { type: 'button', className: 'sort-head', onClick: () => sort(key), 'aria-label': `Sort by ${label}` }, label, icon('down', 12)));
            const reset = () => this.setState({ filters: { site: 'all', year: 'all', festival: 'all', phase: 'all', parameter: 'all', kind: 'all', site_match_confidence: 'all' }, search: '', page: 1 });
            const filterBar = el('section', 'panel explorer-filters', el('div', 'search-wrap', icon('search', 19), h('input', { type: 'search', placeholder: 'Search site, value, printed text, page…', value: this.state.search, 'aria-label': 'Search all source fields', onChange: (e) => this.setState({ search: e.target.value, page: 1 }) })), el('div', 'explorer-filter-grid', field('Ghat', f.site, GP.SITE_NAMES, v => change('site', v)), field('Year', f.year, ['2023', '2024', '2025'], v => change('year', v)), field('Festival', f.festival, ['Ganesh', 'Durga'], v => change('festival', v)), field('Phase', f.phase, ['pre', 'during', 'after'], v => change('phase', v)), field('Parameter', f.parameter, GP.PARAMS, v => change('parameter', v)), field('Record type', f.kind, ['numerical', 'BDL', 'not sampled', 'other'], v => change('kind', v)), field('Site confidence', f.site_match_confidence, ['high', 'medium', 'low'], v => change('site_match_confidence', v))), el('div', 'filters-foot', h('span', null, icon('filter', 15), `${filtered.length} matching observations · ${this.state.records.length} loaded`), btn('Reset filters', reset, 'ghost', 'refresh')));
            const colHeaders = h('thead', null, h('tr', null, head('Ghat', 'site'), head('Year', 'year'), head('Festival', 'festival'), head('Phase', 'phase'), head('Parameter', 'parameter'), head('Reported', 'numeric'), h('th', null, 'Unit'), h('th', null, 'Comparison'), head('Status', 'kind'), head('Page', 'source_page'), h('th', null, 'Details')));
            const rowNodes = shown.map(o => h('tr', { key: o.id, onClick: () => this.viewRecord(o), tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter')
                    this.viewRecord(o); }, 'aria-label': `Inspect ${o.row.site} ${o.row.parameter} ${o.row.year}` }, h('td', { className: 'cell-site' }, GP.textShort(o.row.site)), h('td', null, o.row.year), h('td', null, o.row.festival), h('td', null, o.row.phase), h('td', null, o.row.parameter), h('td', { className: 'cell-value' }, fmtVal(o)), h('td', null, o.row.unit_assumed || '—'), h('td', { className: 'cell-rule' }, GP.FOCUS.includes(o.row.parameter) ? (o.kind === 'numerical' ? (GP.isExceedance(o) ? 'Outside' : 'Within') : 'Not comparable') : 'No comparator'), h('td', null, htmlStatus(o)), h('td', null, o.row.source_page || '—'), h('td', null, h('button', { type: 'button', className: 'tiny-link', onClick: (e) => { e.stopPropagation(); this.viewRecord(o); } }, 'Inspect', icon('chevron', 13)))));
            const bottom = filtered.length ? el('div', 'table-footer', h('span', null, `Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, filtered.length)} of ${filtered.length} observations`), el('div', 'pagination', btn('Previous', () => this.setState({ page: Math.max(1, page - 1) }), 'ghost'), h('span', null, `Page ${page} / ${pages}`), btn('Next', () => this.setState({ page: Math.min(pages, page + 1) }), 'ghost'))) : el('div', 'empty-state', icon('search', 34), h('h3', null, 'No matching observations'), h('p', null, 'Try a broader year, site, parameter, or record status.'), btn('Clear filters', reset, 'secondary', 'refresh'));
            return el('div', 'page', this.sectionHeader('AUDITABLE HISTORICAL OBSERVATIONS', 'Evidence Explorer', 'Search original fields, inspect context, and export exactly the filtered records.', btn('Export filtered CSV', () => { GP.saveBlob(new Blob([GP.makeCSV(filtered)], { type: 'text/csv;charset=utf-8' }), 'ghatpulse-filtered-evidence.csv'); this.message(`${filtered.length} records exported.`); }, 'primary', 'download')), filterBar, el('section', 'panel table-panel', el('div', 'table-scroll', h('table', { className: 'data-table' }, colHeaders, h('tbody', null, ...rowNodes))), bottom));
        }
        async copyText(text) { try {
            await navigator.clipboard.writeText(text);
            this.message('Brief copied to clipboard.');
        }
        catch (err) {
            try {
                const area = document.createElement('textarea');
                area.value = text;
                area.style.position = 'fixed';
                document.body.append(area);
                area.focus();
                area.select();
                const ok = document.execCommand('copy');
                area.remove();
                if (!ok)
                    throw Error('Clipboard unavailable');
                this.message('Brief copied to clipboard.');
            }
            catch (e) {
                this.message('Clipboard blocked; select and copy the brief manually.');
            }
        } }
        printBrief() { this.message('Opening browser print · choose Save as PDF if needed.'); setTimeout(() => window.print(), 150); }
        downloadPDF(text) { try {
            if (this.state.lang === 'hi') {
                this.printBrief();
                return;
            }
            const blob = GP.englishPDF(this.state.selectedSite, text);
            if (blob.size < 300)
                throw Error('PDF incomplete');
            GP.saveBlob(blob, 'ghatpulse-' + this.state.selectedSite.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf');
            this.message('English PDF downloaded.');
        }
        catch (e) {
            this.message('PDF export unavailable. Use Print / Save as PDF.');
        } }
        brief() {
            const { records, selectedSite, lang } = this.state;
            const r = GP.calculateSite(records, selectedSite), text = GP.makeBrief(records, selectedSite, lang);
            return el('div', 'page', this.sectionHeader('TURN OBSERVATIONS INTO AN ACTION', 'Decision Brief', 'A bilingual, source-grounded note for requesting verification — not a safety certificate.'), el('div', 'brief-layout', el('section', 'panel brief-controls', el('div', 'eyebrow', 'BUILD YOUR BRIEF'), h('h2', null, 'Brief configuration'), h('label', { className: 'field' }, h('span', null, 'Ghat / location'), h('select', { value: selectedSite, onChange: (e) => this.selectSite(e.target.value) }, ...GP.SITE_NAMES.map(s => h('option', { value: s }, s)))), h('div', { className: 'field-label' }, 'Language'), el('div', 'language-switch', h('button', { className: lang === 'en' ? 'active' : '', onClick: () => this.setState({ lang: 'en' }), 'aria-pressed': lang === 'en' }, 'English'), h('button', { className: lang === 'hi' ? 'active' : '', onClick: () => this.setState({ lang: 'hi' }), 'aria-pressed': lang === 'hi' }, 'हिन्दी')), el('div', 'mini-rule'), el('div', 'brief-facts', el('div', 'fact-row', h('span', null, 'Historical index'), h('strong', null, r.score === null ? 'N/A' : GP.fmt(r.score, 1) + '/100')), el('div', 'fact-row', h('span', null, 'Comparator readings'), h('strong', null, r.valid)), el('div', 'fact-row', h('span', null, 'Confidence flag'), h('strong', null, r.medium ? 'Medium match' : 'Source: high')), el('div', 'fact-row', h('span', null, 'Evidence entries'), h('strong', null, r.total))), notice('Language is deterministic', 'English and Hindi are generated from the same calculated readings, source pages and uncertainty warnings.'), el('div', 'brief-control-actions', btn('Copy brief', () => this.copyText(text), 'primary full', 'copy'), btn(lang === 'en' ? 'Download PDF' : 'Save Hindi as PDF', () => this.downloadPDF(text), 'secondary full', 'download'), btn('Print / Save as PDF', () => this.printBrief(), 'ghost full', 'print'))), el('section', 'brief-document', el('div', 'document-header', el('div', 'mini-brand', icon('waves', 21), ' GHATPULSE', h('span', null, ' MP')), chip('HISTORICAL / NON-OPERATIONAL', 'amber')), el('div', 'doc-title-block', el('div', 'eyebrow', 'EVIDENCE DECISION BRIEF'), h('h2', null, selectedSite), h('p', null, 'Compiled from reported source observations, 2023–2025')), h('pre', { className: 'brief-text', lang }, text), el('div', 'doc-footer', 'Generated locally · No live connections · Verify original report pages before use'))));
        }
        method() {
            const k = GP.datasetKPIs(this.state.records), validation = GP.validateCounts(k);
            return el('div', 'page', this.sectionHeader('EXPLAINABILITY & SOURCE PROVENANCE', 'Methodology & Data', 'A transparent record of what is compared, what is excluded, and what remains uncertain.', btn('Reload & recalculate', () => this.load(true), 'secondary', 'refresh')), el('div', 'detail-columns', el('section', 'panel padded', el('div', 'eyebrow', 'TRANSPARENT FORMULA'), h('h2', null, 'Historical Exceedance Index'), el('div', 'formula', '40 × BOD rate + 40 × low-DO rate + 20 × out-of-range pH rate'), h('p', null, 'Rates = numerical observations outside the challenge comparator divided by valid numerical readings for that parameter. Index is 0–100; active weights are renormalised if any parameter lacks numerical values. Ties resolve by higher comparator-reading count, then alphabetical site name.'), el('div', 'rule-box', ...GP.FOCUS.map(param => el('div', 'rule-line', el('span', '', h('b', null, abbr(param)), h('small', null, GP.CONFIG.comparators[param].weight + ' weight')), h('strong', null, param === 'BOD' ? '> 3 mg/L' : param === 'Dissolved oxygen' ? '< 5 mg/L' : '< 6.5 / > 8.5')))), notice('Not a regulatory compliance determination', 'BOD >3 mg/L is a challenge-provided comparison value; its applicability depends on matching the analytical method and sampling conditions. pH and DO are likewise historical comparison markers.')), el('section', 'panel padded', el('div', 'eyebrow', 'INPUT CONTRACT'), h('h2', null, 'Record meaning & exclusions'), ...[['Numerical', 'Only a strict finite numeric value participates in rates and trends. Actual 0 is valid if printed as a number.'], ['BDL / ND', 'Below detection / not detected — preserved as a separate kind; never 0, not counted as a within-limit sample.'], ['Not sampled', 'Blank, “not sampled”, *, **, underscore or dash — missing, neither compliant nor exceeded.'], ['Other / malformed', 'Unrecognised numeric strings are excluded; malformed CSV rows are skipped and logged, not silently replaced.'], ['Source authenticity', 'Original printed value, reported site, units assumed, confidence, festival/phase/year and reported PDF page are all retained.']].map(([a, b]) => el('div', 'definition', h('strong', null, a), h('p', null, b))))), el('div', 'detail-columns', el('section', 'panel padded', el('div', 'eyebrow', 'CURRENTLY LOADED FILE'), h('h2', null, 'Data integrity check'), el('p', 'subtle', this.state.source), el('div', 'validation-head', h('span', null, 'Official full-pack benchmarks'), chip(this.state.isFull ? 'File size matches' : 'Partial / nonmatching', 'amber')), ...validation.map(row => el('div', 'fact-row', h('span', null, row.key), h('strong', { className: row.pass ? 'pass-text' : 'warn-text' }, `${GP.fmt(row.actual, 0)} / ${GP.fmt(row.expected, 0)}`, row.pass ? ' ✓' : ' —'))), h('p', { className: 'footnote' }, 'Benchmark comparison is only a validation check and never substitutes missing data. Matching a count does not independently verify each source observation.'), this.state.warnings.length ? el('div', 'warning-list', ...this.state.warnings.slice(0, 6).map(w => h('p', null, icon('alert', 14), ' ', w))) : null), el('section', 'panel padded', el('div', 'eyebrow', 'PRIMARY SOURCES'), h('h2', null, 'Original report references'), ...Object.entries(GP.CONFIG.reports).map(([yr, url]) => el('div', 'source-list-row', el('div', '', h('strong', null, `MPPCB ${yr}`), h('p', null, 'Ganesh / Durga immersion report')), link('View PDF', url))), el('div', 'source-list-row', h('span', null, 'CPCB Class B comparison criteria'), link('Official criteria', GP.CONFIG.criteria)), el('div', 'source-list-row', h('span', null, 'Data dictionary'), link('Open dictionary', GP.CONFIG.dataDictionary)), el('div', 'source-list-row', h('span', null, 'Track 2 challenge brief'), link('Open statement', GP.CONFIG.source)))), el('section', 'panel padded limitations', el('div', 'eyebrow', 'KNOWN LIMITATIONS'), h('h2', null, 'What this tool cannot determine'), h('p', null, 'No live or 2026 measurement feed. No sensors, coordinates, maps, dispatch, approvals, or government systems. These records cannot establish current conditions, health effects, causality, legal compliance or permission to immerse idols.'), h('p', null, 'The seven-ghat file was compiled from MPPCB PDFs. The unit_assumed field carries convention-based units because the source tables do not print them. The 2023–2025 sample times and water-body conditions are not normalised for hydrology or analytical methods.'), h('p', null, 'Rani Kamlapati ghat / Kamla Park kund may represent two locations. Site mapping confidence is retained as medium, and rankings should not obscure that uncertainty.'), h('p', null, 'Source page links append #page=N as a convenience. Embedded printed source_page numbers are not independently verified in this prototype.'), h('p', null, 'A score with low sample counts can look extreme. Read raw counts and coverage warnings alongside it. Updated sampling and source verification should precede operational planning.')));
        }
        drawer() {
            const o = this.state.detail;
            if (!o)
                return null;
            const r = o.row, src = GP.reportUrl(o);
            return h('div', { className: 'drawer-overlay', onClick: () => this.closeRecord() }, h('section', { className: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'record-title', onClick: (e) => e.stopPropagation() }, el('div', 'drawer-top', el('div', '', el('div', 'eyebrow', 'SOURCE OBSERVATION'), h('h2', { id: 'record-title' }, r.parameter)), h('button', { 'data-close-drawer': true, type: 'button', className: 'icon-button close-drawer', onClick: () => this.closeRecord(), 'aria-label': 'Close observation details' }, icon('close', 22))), el('div', 'drawer-scroll', el('div', 'record-number', el('div', 'eyebrow', 'REPORTED VALUE'), h('strong', null, fmtVal(o), h('small', null, r.unit_assumed || 'pH')), htmlStatus(o)), h('h3', null, 'Observation context'), ...[['Ghat standard name', r.site], ['Site as printed', r.site_as_printed], ['Water body', r.water_body], ['Site match confidence', r.site_match_confidence], ['Year', r.year], ['Festival', r.festival], ['Phase', r.phase], ['Parameter normalised', r.parameter], ['Parameter as printed', r.parameter_as_printed], ['Original printed value', r.value_as_printed || '(blank)'], ['Raw numeric field', r.value || '(blank)'], ['Assumed unit', r.unit_assumed || '(unitless)'], ['Original flag', r.flag || '(none)'], ['Record type', o.kind], ['Source page as listed', r.source_page || '(not supplied)']].map(([a, b]) => el('div', 'detail-fact', h('span', null, a), h('strong', null, b))), el('div', 'drawer-note', h('h3', null, 'Comparison rule'), h('p', null, GP.comparison(o)), o.row.parameter === 'BOD' ? h('p', null, GP.CONFIG.comparators.BOD.description) : null, o.kind === 'BDL' ? h('p', null, 'BDL was not measured as zero; there is no numeric threshold comparison.') : null, o.kind === 'not sampled' ? h('p', null, 'This phase/parameter was not sampled. Missing data is never a clean-water result.') : null, o.row.site_match_confidence === 'medium' ? h('p', null, 'Site name may combine distinct locations. Verify before site-specific action.') : null), el('div', 'drawer-note', h('h3', null, 'Source and verification'), h('p', null, `Reported MPPCB ${r.year} document · CSV source_page ${r.source_page || 'unknown'}. Page jump is attempted but NOT independently verified.`), src ? link('Open original report (page hint)', src) : h('p', null, 'No report URL available.'))), el('div', 'drawer-actions', btn('View ghat summary', () => this.viewSite(r.site, 'Overview'), 'primary', 'arrow'), btn('Close', () => this.closeRecord(), 'secondary', 'close'))));
        }
        render() { return el('div', 'root-frame', el('div', 'app-shell', this.sidebar(), this.state.mobile ? h('button', { className: 'mobile-shade', 'aria-label': 'Close navigation overlay', onClick: () => this.setState({ mobile: false }) }) : null, el('div', 'main-shell', this.header(), h('main', { className: 'main-content', id: 'main-content' }, this.state.loading ? this.loading() : this.state.error ? el('div', 'error-box', icon('alert', 27), h('h2', null, 'Unable to read source data'), h('p', null, this.state.error), btn('Retry loading', () => this.load(true), 'primary', 'refresh'), h('p', null, 'The app needs the official CSV or the bundled source excerpt; no invented data will be shown.')) : this.state.section === 'overview' ? this.overview() : this.state.section === 'ghat' ? this.ghat() : this.state.section === 'explorer' ? this.explorer() : this.state.section === 'brief' ? this.brief() : this.method()), el('footer', 'main-footer', h('span', null, 'GHATPULSE MP · Bhopal Impact Lab 2026'), h('span', null, 'Historical decision support · Not live water monitoring')))), this.state.feedback ? el('div', 'toast', icon('info', 17), this.state.feedback) : null, this.drawer(), h('div', { className: 'print-only' }, h('pre', null, GP.makeBrief(this.state.records, this.state.selectedSite, this.state.lang)))); }
    }
    ReactDOM.render(h(App, null), document.getElementById('root'));
})(GP || (GP = {}));
