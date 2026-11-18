import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../tests/fixtures/',import.meta.url));
const port=Number(process.env.PORT||8000);
const server=createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  const name=path==='/'?'index.html':path.replace(/^\/tests\/fixtures\//,'').replace(/^\//,'');
  if(!/^[a-z-]+\.(html|svg)$/.test(name)){res.writeHead(404);res.end('Not found');return;}
  const body=await readFile(resolve(root,name));res.writeHead(200,{'Content-Type':name.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${port} is busy. Try PORT=8001 npm run demo.`:e.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`OpenArticle test pages: http://127.0.0.1:${port}/\nOpen a test article, then click the OpenArticle toolbar icon. Press Ctrl+C to stop.`));
