import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { dirname, resolve, extname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const digest=value=>createHash('sha256').update(value).digest();
const UUID='[0-9a-fA-F-]{36}';
const pages=new Set(['/','/admin','/admin/cameras','/totem/entrada']);
function baseURL(value) {
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash) throw new Error('Invalid backend origin configuration.');
  return url.origin;
}
function route(path,method) {
  if(method==='GET'&&path==='/api/core/health') return ['java','/health'];
  if(method==='GET'&&/^\/api\/core\/(sectors|sessions|dashboard)$/.test(path)) return ['java','/api/v1/internal/'+path.split('/').at(-1)];
  const receipt=path.match(new RegExp('^/api/core/receipts/('+UUID+')$'));
  if(method==='GET'&&receipt)return ['java','/api/v1/internal/vision-events/'+receipt[1]];
  if(method==='GET'&&path==='/api/vision/health')return ['python','/health'];
  if(method==='GET'&&/^\/api\/vision\/(status|cameras|events)$/.test(path))return ['python',path.replace('/api/vision/','/api/v1/vision/')];
  if(method==='POST'&&/^\/api\/vision\/(analyze\/(start|stop)|events\/simulate)$/.test(path))return ['python',path.replace('/api/vision/','/api/v1/vision/')];
  if((method==='GET'&&new RegExp('^/api/vision/events/'+UUID+'$').test(path)) ||
      (method==='POST'&&new RegExp('^/api/vision/events/'+UUID+'/send$').test(path)))return ['python',path.replace('/api/vision/','/api/v1/vision/')];
  return null;
}

export async function createGateway(config) {
  const javaBase=baseURL(config.javaBase),pythonBase=baseURL(config.pythonBase);
  if(!/^[!-~]{32,256}$/.test(config.internalKey||'')||typeof config.password!=='string'||config.password.length<12||
    !/^[a-zA-Z0-9_-]{1,40}$/.test(config.username||''))throw new Error('Configure INTERNAL_API_KEY and separate DEMO_USERNAME/DEMO_PASSWORD (12+ characters).');
  const publicOrigin=config.publicOrigin?baseURL(config.publicOrigin):null;
  if(publicOrigin&&!publicOrigin.startsWith('https://'))throw new Error('PUBLIC_ORIGIN must use HTTPS.');
  if(config.dev&&publicOrigin)throw new Error('Public access requires a built frontend, never Vite dev.');
  const expected=digest('Basic '+Buffer.from(config.username+':'+config.password).toString('base64'));
  const vite=config.dev?await (await import('vite')).createServer({root,server:{middlewareMode:true,ws:false},appType:'spa'}):null;
  const server=http.createServer(async(req,res)=>{
    const respond=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    if(!config.dev)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const port=server.address()?.port;
      const hosts=new Set([`localhost:${port}`,`127.0.0.1:${port}`]);
      if(publicOrigin)hosts.add(new URL(publicOrigin).host);
      if(!hosts.has(req.headers.host))return respond(403,{error:'host_not_allowed'});
      const localOrigin='http://'+req.headers.host;
      const url=new URL(req.url,localOrigin);
      if(req.method==='GET'&&url.pathname==='/health')return respond(200,{status:'ok'});
      if(!timingSafeEqual(expected,digest(req.headers.authorization||''))){res.setHeader('WWW-Authenticate','Basic realm="Articuno", charset="UTF-8"');return respond(401,{error:'authentication_required'});}
      if(req.method==='GET'&&url.pathname==='/api/config')return respond(200,{video_filename:config.videoFilename||''});
      const target=route(url.pathname,req.method);
      if(target){
        const allowedQueries=url.pathname==='/api/core/sessions'||url.pathname==='/api/vision/events';
        for(const [name,value] of url.searchParams){if(!allowedQueries||!['limit','offset'].includes(name)||!/^\d{1,9}$/.test(value))return respond(400,{error:'invalid_query'});}
        let body;
        if(req.method==='POST'){
          const permittedOrigin=publicOrigin&&req.headers.host===new URL(publicOrigin).host?publicOrigin:localOrigin;
          if(req.headers.origin!==permittedOrigin||req.headers['sec-fetch-site']==='cross-site')return respond(403,{error:'origin_not_allowed'});
          if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return respond(415,{error:'json_required'});
          if(Number(req.headers['content-length'])>16384){req.resume();return respond(413,{error:'payload_too_large'});}
          const chunks=[];let size=0;
          for await(const chunk of req){size+=chunk.length;if(size>16384){respond(413,{error:'payload_too_large'});return;}chunks.push(chunk);}
          body=Buffer.concat(chunks);
        }
        try {
          const headers={'Accept':'application/json'};
          if(body)headers['Content-Type']='application/json';
          if(target[0]==='java')headers['X-Internal-API-Key']=config.internalKey;
          const result=await fetch((target[0]==='java'?javaBase:pythonBase)+target[1]+url.search,
            {method:req.method,headers,body,redirect:'error',signal:AbortSignal.timeout(15000)});
          return respond(result.status,await result.json());
        }catch{return respond(502,{error:'upstream_unavailable',service:target[0]});}
      }
      if(url.pathname.startsWith('/api/'))return respond(404,{error:'route_not_found'});
      if(!['GET','HEAD'].includes(req.method))return respond(405,{error:'method_not_allowed'});
      if(vite)return vite.middlewares(req,res,()=>respond(404,{error:'route_not_found'}));
      const relative=pages.has(url.pathname)?'index.html':url.pathname.startsWith('/assets/')?url.pathname.slice(1):null;
      if(!relative)return respond(404,{error:'route_not_found'});
      const dist=resolve(root,'dist'),path=resolve(dist,relative);
      if(!path.startsWith(dist+sep))return respond(404,{error:'route_not_found'});
      try {
        const data=await readFile(path);
        const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(path)]||'application/octet-stream';
        res.writeHead(200,{'Content-Type':mime});res.end(req.method==='HEAD'?undefined:data);
      }catch{respond(404,{error:'build_or_file_not_found'});}
    }catch{if(!res.headersSent)respond(500,{error:'gateway_error'});else res.end();}
  });
  server.requestTimeout=20000;server.headersTimeout=10000;
  if(vite)server.on('close',()=>vite.close());
  return server;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try {
    const port=Number(process.env.FRONTEND_PORT||5173);
    if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid FRONTEND_PORT.');
    const server=await createGateway({javaBase:process.env.JAVA_API_BASE_URL,pythonBase:process.env.PYTHON_API_BASE_URL,
      internalKey:process.env.INTERNAL_API_KEY,username:process.env.DEMO_USERNAME||'articuno',password:process.env.DEMO_PASSWORD,
      publicOrigin:process.env.PUBLIC_ORIGIN,videoFilename:process.env.VIDEO_FILENAME,dev:process.argv.includes('--dev')});
    server.listen(port,'127.0.0.1',()=>console.log('Articuno listening on local port '+port+' (authentication required)'));
  }catch{console.error('Cannot start Articuno: check ports, backend origins, INTERNAL_API_KEY and DEMO credentials.');process.exitCode=1;}
}
