// Fully reproducible, dependency-free static production package.
// Vite's optional optimiser can also be used via `npm run build:vite`.
import {cpSync,copyFileSync,mkdirSync,rmSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=join(root,'release');
if(!existsSync(join(root,'dist/app.js')))throw new Error('Compiled application missing. Run npm run compile.');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const f of ['index.html','styles.css','README.md','LICENSE'])copyFileSync(join(root,f),join(out,f));
mkdirSync(join(out,'dist'));copyFileSync(join(root,'dist/app.js'),join(out,'dist/app.js'));
// Distinct from source editing: copying preserves original dataset and runtime bytes.
cpSync(join(root,'public'),out,{recursive:true,force:false,errorOnExist:false});
console.log('Static release ready at ./release/ — index.html, CSS, React runtime, compiled TypeScript and unmodified available data.');
