namespace GP {
 export function makeCSV(rows:Observation[]):string {
  const headers=[...REQUIRED,...Array.from(new Set(rows.flatMap(o=>Object.keys(o.row)))).filter(h=>!REQUIRED.includes(h))];
  const esc=(s:string)=>/[,\r\n"]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  return '\uFEFF'+headers.join(',')+'\r\n'+rows.map(o=>headers.map(key=>esc(o.row[key]||'')).join(',')).join('\r\n');
 }
 export function saveBlob(data:Blob,name:string){const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}
 export function makeBrief(rows:Observation[],site:string,lang:'en'|'hi'):string {
  const score=calculateSite(rows,site),top=notable(rows,site,3);
  const focus=score.rates.map(r=>{
   const p=r.param==='Dissolved oxygen'?'DO':r.param;
   return `${p}: ${r.valid?`${r.exceeded}/${r.valid}`:'unavailable'} (${r.valid} ${lang==='hi'?'संख्यात्मक रीडिंग':'numerical readings'})`;
  }).join('; ');
  const details=top.map(o=>`${o.row.year} ${o.row.festival} / ${o.row.phase}: ${o.row.parameter} ${o.row.value_as_printed||o.row.value} ${o.row.unit_assumed||''} (${comparison(o)}; ${lang==='hi'?'रिपोर्ट पृष्ठ':'report page'} ${o.row.source_page||'unknown'})`).join('\n')|| (lang==='hi'?'दिए गए फ़िल्टर में कोई तुलनात्मक विचलन नहीं मिला।':'No comparative exceedance in the selected evidence.');
  const src=[...new Set(rows.filter(o=>o.row.site===site).map(o=>`${o.row.year} MPPCB report, page ${o.row.source_page||'unknown'}`))].slice(0,8).join('; ');
  if(lang==='hi'){
   const translations:Record<string,string>={
    'Request updated DO, BOD and pH sampling with documented time, phase, lab method and chain of custody.':'दर्ज समय, चरण, लैब विधि और अभिरक्षा विवरण के साथ DO, BOD और pH के नए नमूने लें।',
    'Prioritise field verification of the historical low-DO observations; do not infer current oxygen levels.':'ऐतिहासिक कम DO रीडिंग की स्थल पर जाँच करें; वर्तमान DO का अनुमान न लगाएँ।',
    'Ask the laboratory to confirm BOD methodology before making regulatory interpretations.':'नियामक व्याख्या से पहले प्रयोगशाला से BOD विधि सत्यापित करें।',
    'Fill phase and parameter sampling gaps before comparing sites as equivalent.':'घाटों की तुलना करने से पहले चरण एवं पैरामीटर के सैंपलिंग अंतराल भरें।',
    'Resolve whether Kamla Park kund and Lower Lake ghat represent the same sampling location.':'जाँचें कि कमला पार्क कुंड और लोअर लेक घाट एक ही नमूना स्थल हैं या अलग।',
    'Verify key entries and page references against the MPPCB PDFs before operational use.':'संचालन निर्णय से पहले मूल MPPCB PDF और पृष्ठों से रीडिंग मिलाएँ।'
   };
   const actions=suggestedActions(score).map((a,i)=>`${i+1}. ${translations[a]||a}`).join('\n');
   return `घाटपल्स एमपी | ऐतिहासिक निर्णय संक्षेप
घाट: ${site}
अवधि: 2023–2025 | 2026 का लाइव डेटा नहीं

ऐतिहासिक प्राथमिकता संकेत: ${score.score===null?'उपलब्ध नहीं':fmt(score.score,1)+'/100'}। केवल उदाहरणात्मक सूचकांक; आधिकारिक जोखिम, सुरक्षा या कानूनी निष्कर्ष नहीं।

आधार: ${focus}। DO/BOD/pH की ${score.valid} संख्यात्मक रीडिंग; कुल ${score.total} रिकॉर्ड।

मुख्य स्रोत रीडिंग:
${details}

सीमाएँ: ${score.coverageWarning}। BDL का अर्थ परीक्षण सीमा से नीचे है, शून्य नहीं। बिना नमूने के रिकॉर्ड साफ जल के प्रमाण नहीं हैं। स्थान का मिलान ${score.medium?'मध्यम भरोसे का है; पहचान जाँचें':'उच्च भरोसे के रूप में दर्ज है; मूल स्रोत जाँचें'}। ऐतिहासिक डेटा वर्तमान पानी की स्थिति, स्वास्थ्य प्रभाव, कानूनी अनुपालन या विसर्जन अनुमति स्थापित नहीं करता। BOD >3 mg/L केवल चुनौती-प्रदत्त तुलनात्मक मान है; लैब विधि एवं सैंपलिंग तुलनीय होने की पुष्टि जरूरी है।

सुझाई गई अगली जाँच:
${actions}

स्रोत संदर्भ: ${src||'पृष्ठ उपलब्ध नहीं'}। मूल MPPCB रिपोर्ट 2023–2025; पृष्ठ CSV से लिए गए हैं, स्वतंत्र रूप से सत्यापित नहीं।

GHATPULSE MP — ऐतिहासिक प्रोटोटाइप; कोई लाइव सरकारी एकीकरण नहीं।`;
  }
  return `GHATPULSE MP | HISTORICAL DECISION BRIEF\nGhat: ${site}\nCoverage: 2023–2025 | No live 2026 readings\n\nPRIORITY SIGNAL\n${score.score===null?'Index unavailable':fmt(score.score,1)+'/100'} — illustrative Historical Exceedance Index, not an official risk, safety or regulatory assessment.\n\nMEASUREMENT SUPPORT\n${focus}.\n${score.valid} numeric DO/BOD/pH readings across ${score.total} recorded observations.\n\nSELECTED SOURCE EVIDENCE\n${details}\n\nEVIDENCE LIMITATIONS\n${score.coverageWarning}. BDL means below detection limit, not zero. Unsampled records are not evidence of clean water. Site matching: ${score.medium?'medium confidence; verify potentially distinct locations':'marked high confidence; still verify original site labels'}. Historical results cannot establish present conditions, health outcomes, legal compliance or immersion approval. The BOD >3 mg/L rule is a challenge-provided comparator subject to confirmation of sampling and method comparability.\n\nRECOMMENDED CHECKS\n${suggestedActions(score).map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\nSOURCE REFERENCES\n${src||'No source page provided'}\nMPPCB original reports for 2023, 2024 and 2025; printed references are reported from CSV and not independently page-verified.\n\nHistorical prototype. No live government integrations.`;
 }
 // Small, dependency-free Latin text PDF. Hindi uses browser Print to PDF for correct Devanagari shaping.
 export function englishPDF(title:string,body:string):Blob {
  const safe=(s:string)=>s.replace(/[–—−]/g,'-').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[…]/g,'...').replace(/[·•]/g,';').replace(/×/g,'x').replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7e]/g,'?');
  const lines:string[]=[];body.split('\n').forEach(par=>{if(!par.trim()){lines.push(' ');return}let rest=par.replace(/\s+/g,' ').trim();while(rest.length>91){let at=rest.lastIndexOf(' ',91);if(at<20)at=91;lines.push(rest.slice(0,at));rest=rest.slice(at).trim()}lines.push(rest)});
  const pages:string[][]=[];for(let i=0;i<lines.length;i+=53)pages.push(lines.slice(i,i+53));if(!pages.length)pages.push(['No content']);
  const objects:string[]=[];const add=(s:string)=>{objects.push(s);return objects.length};
  const catalog=add(''),pagesIndex=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const kids:number[]=[];
  pages.forEach((p,page)=>{
   const ops=['BT /F1 10 Tf 45 775 Td 14 TL'];p.forEach((s,i)=>{ops.push((i?'T* ':'')+'('+safe(s)+') Tj')});ops.push('ET');const stream=ops.join('\n');const content=add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
   const pageId=add(`<< /Type /Page /Parent ${pagesIndex} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);kids.push(pageId)
  });
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesIndex} 0 R >>`;objects[pagesIndex-1]=`<< /Type /Pages /Kids [${kids.map(k=>k+' 0 R').join(' ')}] /Count ${kids.length} >>`;
  let pdf='%PDF-1.4\n';const starts:number[]=[0];objects.forEach((obj,i)=>{starts.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`});const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<starts.length;i++)pdf+=String(starts[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Root ${catalog} 0 R /Size ${objects.length+1} >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf],{type:'application/pdf'});
 }
}
