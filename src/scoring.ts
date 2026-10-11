namespace GP {
 export type RateInfo={param:Parameter;valid:number;exceeded:number;rate:number|null;missing:number;bdl:number};
 export type ScoreInfo={site:string;score:number|null;valid:number;total:number;missing:number;bdl:number;medium:boolean;rates:RateInfo[];coverageWarning:string;rationale:string};
 export function isExceedance(o:Observation):boolean|null {
  if(o.kind!=='numerical'||o.numeric===null)return null;
  if(o.row.parameter==='BOD')return o.numeric>CONFIG.comparators.BOD.limit;
  if(o.row.parameter==='Dissolved oxygen')return o.numeric<CONFIG.comparators['Dissolved oxygen'].limit;
  if(o.row.parameter==='pH')return o.numeric<CONFIG.comparators.pH.min||o.numeric>CONFIG.comparators.pH.max;
  return null;
 }
 export function comparison(o:Observation):string {
  if(!FOCUS.includes(o.row.parameter))return 'No Class B comparator in this tool';
  if(o.kind!=='numerical')return 'Not comparable · '+(o.kind==='BDL'?'below detection limit':o.kind);
  const comp=o.row.parameter==='BOD'?CONFIG.comparators.BOD.rule:o.row.parameter==='pH'?CONFIG.comparators.pH.rule:CONFIG.comparators['Dissolved oxygen'].rule;
  return isExceedance(o)?'Outside · '+comp:'Within comparator · '+comp;
 }
 export function calculateSite(rows:Observation[],site:string):ScoreInfo {
  const local=rows.filter(o=>o.row.site===site);
  const rates=FOCUS.map((param)=>{
   const p=local.filter(o=>o.row.parameter===param),valid=p.filter(o=>o.kind==='numerical');
   const exceeded=valid.filter(o=>isExceedance(o)===true).length;
   return {param:param as Parameter,valid:valid.length,exceeded,rate:valid.length?exceeded/valid.length:null,missing:p.filter(o=>o.kind==='not sampled').length,bdl:p.filter(o=>o.kind==='BDL').length};
  });
  const weighted=rates.filter(r=>r.rate!==null);
  const weightSum=weighted.reduce((n,r)=>n+CONFIG.comparators[r.param].weight,0);
  const score=weightSum>0?100*weighted.reduce((n,r)=>n+(r.rate as number)*CONFIG.comparators[r.param].weight,0)/weightSum:null;
  const valid=rates.reduce((n,r)=>n+r.valid,0),missing=local.filter(o=>o.kind==='not sampled').length,bdl=local.filter(o=>o.kind==='BDL').length;
  const medium=local.some(o=>o.row.site_match_confidence==='medium');
  const absent=rates.filter(r=>r.valid===0).map(r=>r.param);
  const warnings:string[]=[];
  if(missing)warnings.push(`${missing} not-sampled records`);
  if(bdl)warnings.push(`${bdl} BDL observations (not zero)`);
  if(absent.length)warnings.push('no numerical '+absent.join(', '));
  if(medium)warnings.push('medium-confidence site identity');
  if(local.length && valid<9)warnings.push('limited numerical comparator coverage');
  const rationale=rates.map(r=>r.valid?`${r.param==='Dissolved oxygen'?'DO':r.param} ${r.exceeded}/${r.valid}`:`${r.param==='Dissolved oxygen'?'DO':r.param} n/a`).join(' · ');
  return {site,score,valid,total:local.length,missing,bdl,medium,rates,coverageWarning:warnings.join(' · ')||'Review sampling coverage and original reports',rationale};
 }
 export function rankSites(rows:Observation[],sites:string[]=SITE_NAMES):ScoreInfo[] {
  return sites.map(site=>calculateSite(rows,site)).sort((a,b)=>{
   if(a.score===null&&b.score!==null)return 1;if(a.score!==null&&b.score===null)return -1;
   if(a.score!==null&&b.score!==null&&Math.abs(a.score-b.score)>1e-9)return b.score-a.score;
   if(a.valid!==b.valid)return b.valid-a.valid;
   return a.site.localeCompare(b.site,'en');
  });
 }
 export function notable(rows:Observation[],site:string,limit=3){
  return rows.filter(o=>o.row.site===site && isExceedance(o)===true).sort((a,b)=>{
   const importance=(x:Observation)=>x.row.parameter==='Dissolved oxygen'? 100*((5-(x.numeric||0))/5):x.row.parameter==='BOD'?100*(((x.numeric||0)-3)/3):100;
   return importance(b)-importance(a) || b.row.year.localeCompare(a.row.year) || a.id-b.id;
  }).slice(0,limit);
 }
 export function suggestedActions(score:ScoreInfo):string[]{
  const result=['Request updated DO, BOD and pH sampling with documented time, phase, lab method and chain of custody.'];
  if(score.rates.find(r=>r.param==='Dissolved oxygen')?.exceeded)result.push('Prioritise field verification of the historical low-DO observations; do not infer current oxygen levels.');
  if(score.rates.find(r=>r.param==='BOD')?.exceeded)result.push('Ask the laboratory to confirm BOD methodology before making regulatory interpretations.');
  if(score.missing||score.rates.some(r=>r.valid===0))result.push('Fill phase and parameter sampling gaps before comparing sites as equivalent.');
  if(score.medium)result.push('Resolve whether Kamla Park kund and Lower Lake ghat represent the same sampling location.');
  result.push('Verify key entries and page references against the MPPCB PDFs before operational use.');
  return result;
 }
}
