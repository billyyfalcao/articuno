import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createGateway } from '../server.mjs';

const key = 'internal-test-only-0123456789abcdef';
const password = 'access-test-only-0123456789';
async function listen(server) { await new Promise(r=>server.listen(0,'127.0.0.1',r)); return `http://127.0.0.1:${server.address().port}`; }
test('gateway authenticates, restricts routes and keeps internal key server-side', async t=>{
  let received;
  const upstream = http.createServer((req,res)=>{received={url:req.url,headers:req.headers};res.setHeader('Content-Type','application/json');res.end('{"items":[]}');});
  const base = await listen(upstream);
  const server = await createGateway({javaBase:base,pythonBase:base,internalKey:key,username:'articuno',password});
  const origin = await listen(server);
  t.after(()=>{server.closeAllConnections();server.close();upstream.closeAllConnections();upstream.close();});
  const auth={Authorization:'Basic '+Buffer.from('articuno:'+password).toString('base64')};
  assert.equal((await fetch(origin+'/api/core/sectors')).status,401);
  const result=await fetch(origin+'/api/core/sectors',{headers:auth});
  assert.equal(result.status,200);assert.deepEqual(await result.json(),{items:[]});
  assert.equal(received.headers['x-internal-api-key'],key);assert.equal(received.headers.authorization,undefined);
  assert.equal(received.url,'/api/v1/internal/sectors');
  assert.equal((await fetch(origin+'/api/v1/internal/sessions',{headers:auth})).status,404);
  assert.equal((await fetch(origin+'/server.mjs',{headers:auth})).status,404);
  assert.equal((await fetch(origin+'/.env',{headers:auth})).status,404);
  assert.equal((await fetch(origin+'/api/core/sectors?url=https://example.org',{headers:auth})).status,400);
  assert.equal((await fetch(origin+'/api/vision/events/simulate',{method:'POST',headers:{...auth,'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'})).status,403);
  const valid=await fetch(origin+'/api/vision/events/simulate',{method:'POST',headers:{...auth,'Content-Type':'application/json',Origin:origin},body:'{}'});
  assert.equal(valid.status,200);assert.equal(received.headers['x-internal-api-key'],undefined);
  assert.equal((await fetch(origin+'/api/vision/events/simulate',{method:'POST',headers:{...auth,'Content-Type':'application/json',Origin:origin},body:' '.repeat(17000)})).status,413);
  upstream.closeAllConnections();await new Promise(r=>upstream.close(r));
  const unavailable=await fetch(origin+'/api/core/sectors',{headers:auth});
  assert.equal(unavailable.status,502);assert.equal((await unavailable.text()).includes(key),false);
});
test('gateway refuses missing credentials and invalid upstream configuration',async()=>{
  await assert.rejects(()=>createGateway({javaBase:'https://example.org/private',pythonBase:'http://localhost:8000',internalKey:key,username:'articuno',password}));
  await assert.rejects(()=>createGateway({javaBase:'http://localhost:8080',pythonBase:'http://localhost:8000',internalKey:key,password:''}));
});
