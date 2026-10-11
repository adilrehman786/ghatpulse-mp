// Run where internet is available. Saves source bytes with no data transformations.
import { writeFile, mkdir } from 'node:fs/promises';
const url='https://raw.githubusercontent.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/main/track-2-visarjan-ghat-watch/data/bhopal_ghats_2023_2025.csv';
const resp=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!resp.ok)throw new Error(`${resp.status} ${resp.statusText}`);
const content=await resp.text();if(!content.startsWith('year,festival,site,')||content.split(/\r?\n/).filter(Boolean).length!==1525)throw Error('Unexpected source schema or line count: download not saved');
await mkdir('public/data',{recursive:true});await writeFile('public/data/bhopal_ghats_2023_2025.csv',content,'utf8');console.log('Saved official full 1,524-row CSV to public/data; source bytes preserved.');
