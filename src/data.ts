namespace GP {
 export const REQUIRED=['year','festival','site','water_body','phase','parameter','value','unit_assumed','flag','value_as_printed','parameter_as_printed','site_as_printed','site_match_confidence','source_page'];
 export type ParseResult={records:Observation[];warnings:string[];headers:string[];invalid:number};
 export function csvRows(csv:string):{rows:string[][];errors:string[]} {
  // RFC-4180: quoted fields, escaped quotes, CRLF, embedded newlines.
  const rows:string[][]=[];let row:string[]=[],cell='',inQuotes=false;const errors:string[]=[];
  if(csv.charCodeAt(0)===0xFEFF)csv=csv.slice(1);
  for(let i=0;i<csv.length;i++){const c=csv[i];if(inQuotes){if(c==='"' && csv[i+1]==='"'){cell+='"';i++} else if(c==='"'){inQuotes=false} else{cell+=c}}else if(c==='"'&&cell===''){inQuotes=true}else if(c===','){row.push(cell);cell=''}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell=''}else{cell+=c}}
  if(inQuotes)errors.push('Unclosed quotation mark at end of CSV.');
  if(cell!==''||row.length){row.push(cell.replace(/\r$/,''));rows.push(row)}
  return {rows,errors};
 }
 export function classify(row:SourceRow):{kind:RecordKind;numeric:number|null}{
  const v=(row.value||'').trim(),flag=(row.flag||'').trim().toLowerCase(),printed=(row.value_as_printed||'').trim().toLowerCase();
  if(['bdl','nd','below detection limit','not detected'].includes(flag)||['bdl','nd'].includes(printed))return {kind:'BDL',numeric:null};
  if(['not sampled','*','**'].includes(flag)||['not sampled','*','**','_','-'].includes(printed)||(!v&&!flag&&!printed))return {kind:'not sampled',numeric:null};
  if(v!=='' && /^(?:\d+(?:\.\d*)?|\.\d+|\-\d+(?:\.\d*)?)(?:[Ee][+-]?\d+)?$/.test(v)){
   const n=Number(v);if(Number.isFinite(n))return {kind:'numerical',numeric:n};
  }
  return {kind:'other',numeric:null};
 }
 export function parseCSV(csv:string):ParseResult{
  const {rows,errors}=csvRows(csv);const headers=(rows.shift()||[]).map(s=>s.trim());
  const missing=REQUIRED.filter(h=>!headers.includes(h));if(missing.length)throw new Error('CSV missing required columns: '+missing.join(', '));
  const warnings=[...errors],records:Observation[]=[];let invalid=0;
  rows.forEach((cells,i)=>{
   if(cells.every(v=>v.trim()===''))return;
   if(cells.length!==headers.length){invalid++;if(warnings.length<22)warnings.push(`CSV line ${i+2}: expected ${headers.length} fields, found ${cells.length}.`);return}
   const row={} as SourceRow;headers.forEach((head,j)=>row[head]=cells[j]||'');
   if(!row.site.trim()||!row.parameter.trim()||!/^(2023|2024|2025)$/.test(row.year.trim())){invalid++;if(warnings.length<22)warnings.push(`CSV line ${i+2}: invalid site, parameter or year.`);return}
   const classification=classify(row);if(classification.kind==='other'&&warnings.length<22)warnings.push(`CSV line ${i+2}: unrecognised value / flag, excluded from numerical comparisons.`);
   records.push({id:i+2,row,...classification});
  });
  if(invalid&&warnings.length<22)warnings.push(`${invalid} malformed row(s) skipped without coercion.`);
  return {records,warnings,headers,invalid};
 }
 export function datasetKPIs(records:Observation[]){
  const numerical=records.filter(o=>o.kind==='numerical');const doRows=numerical.filter(o=>o.row.parameter==='Dissolved oxygen');const bodRows=numerical.filter(o=>o.row.parameter==='BOD');
  return {total:records.length,numerical:numerical.length,doCount:doRows.filter(o=>(o.numeric as number)<5).length,doValid:doRows.length,bodCount:bodRows.filter(o=>(o.numeric as number)>3).length,bodValid:bodRows.length,bdl:records.filter(o=>o.kind==='BDL').length,missing:records.filter(o=>o.kind==='not sampled').length,other:records.filter(o=>o.kind==='other').length};
 }
 export function matches(o:Observation,criteria:{[key:string]:string}){return Object.keys(criteria).every(k=>!criteria[k]||criteria[k]==='all'||(k==='kind'?o.kind===criteria[k]:(o.row as any)[k]===criteria[k]));}
 export const EXPECTED={total:1524,numerical:1289,doCount:42,doValid:116,bodCount:100,bodValid:112,bdl:174,missing:61};
 export function validateCounts(k:ReturnType<typeof datasetKPIs>) {return Object.keys(EXPECTED).map(key=>({key,expected:(EXPECTED as any)[key],actual:(k as any)[key],pass:(EXPECTED as any)[key]===(k as any)[key]}));}
}
