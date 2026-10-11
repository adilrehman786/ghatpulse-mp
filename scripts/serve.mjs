// Minimal zero-dependency local preview; Vite is preferred for development.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
const workspace=resolve(import.meta.dirname,'..');
const root=process.env.GHATPULSE_ROOT?resolve(workspace,process.env.GHATPULSE_ROOT):workspace;
const publicRoot=existsSync(resolve(root,'public'))?resolve(root,'public'):root;
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.csv':'text/csv; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url||'/',`http://${req.headers.host||'localhost'}`).pathname)}catch{res.writeHead(400).end('Invalid URL');return}
 if(pathname==='/')pathname='/index.html';
 const isPublic=pathname.startsWith('/vendor/')||pathname.startsWith('/data/');
 const base=isPublic?publicRoot:root;
 const filename=resolve(base,'.'+pathname);
 if(filename!==base&&!filename.startsWith(base+sep)){res.writeHead(403).end('Forbidden');return}
 try{const item=await stat(filename);if(!item.isFile())throw new Error('Not a file');const file=await readFile(filename);const ext=filename.slice(filename.lastIndexOf('.'));res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(file)}catch{res.writeHead(404,{'Content-Type':'text/plain'}).end('Not found')}
});
server.listen(port,'127.0.0.1',()=>console.log(`GHATPULSE MP offline preview: http://localhost:${port}/`));
