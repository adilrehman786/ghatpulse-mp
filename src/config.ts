namespace GP {
 export type RecordKind = 'numerical'|'BDL'|'not sampled'|'other';
 export type Parameter = 'BOD'|'Dissolved oxygen'|'pH';
 export type SourceRow = {year:string;festival:string;site:string;water_body:string;phase:string;parameter:string;value:string;unit_assumed:string;flag:string;value_as_printed:string;parameter_as_printed:string;site_as_printed:string;site_match_confidence:string;source_page:string;[key:string]:string};
 export type Observation = {id:number;row:SourceRow;kind:RecordKind;numeric:number|null};
 export const CONFIG = {
  comparators: { BOD:{limit:3,weight:40,label:'> 3 mg/L',rule:'BOD > 3 mg/L',description:'Challenge-provided comparator; confirm BOD sampling and analytical-method comparability before regulatory interpretation.'},'Dissolved oxygen':{limit:5,weight:40,label:'< 5 mg/L',rule:'DO < 5 mg/L',description:'Challenge-provided Class B comparator.'},pH:{min:6.5,max:8.5,weight:20,label:'outside 6.5–8.5',rule:'pH < 6.5 or > 8.5',description:'Challenge-provided Class B range comparator.'}},
  reports:{'2023':'https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf','2024':'https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf','2025':'https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf'},
  official:'https://raw.githubusercontent.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/main/track-2-visarjan-ghat-watch/data/bhopal_ghats_2023_2025.csv',
  source:'https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/PROBLEM-STATEMENT.md',
  dataDictionary:'https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/data/DATA_DICTIONARY.md',
  criteria:'https://raw.githubusercontent.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/main/track-2-visarjan-ghat-watch/data/cpcb_water_quality_criteria.csv'
 } as const;
 export const SITE_NAMES=['Bairagarh (Sant Hirdaram) kund','Khatlapura ghat','Prempura ghat','Rani Kamlapati ghat / Kamla Park kund','Hathaikheda dam / kund','Malikhedi kund','Shahpura lake ghat'];
 export const PARAMS=['pH','Dissolved oxygen','BOD','COD','Total solids','Dissolved solids','Suspended solids','Turbidity','Conductivity','Chromium','Lead','Zinc','Copper'];
 export const FOCUS=['Dissolved oxygen','BOD','pH'];
 export function textShort(s:string){return s.replace(' (Sant Hirdaram)','').replace(' / Kamla Park kund',' / Kamla Park').replace(' dam / kund',' kund').replace(' lake ghat',' ghat')}
 export function fmt(n:number|null|undefined,d=1):string {return n===null||n===undefined||!Number.isFinite(n)?'—':new Intl.NumberFormat('en-IN',{maximumFractionDigits:d,minimumFractionDigits:d}).format(n)}
 export function reportUrl(o:Observation):string|null {const base=(CONFIG.reports as Record<string,string>)[o.row.year];return base?base+( /^\d+$/.test(o.row.source_page.trim())?'#page='+encodeURIComponent(o.row.source_page.trim()):''):null}
}
