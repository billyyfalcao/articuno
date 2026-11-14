// Optional HTTPS smoke test. Uses only local private files, never logs credentials.
import { chromium } from '@playwright/test';
import { readFileSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=name=>JSON.parse(readFileSync(new URL('../../.demo/'+name,import.meta.url),'utf8'));
const {url}=read('tunnel.json'),access=read('access.json');
const browser=await chromium.launch({channel:'msedge'});
try {
  const anonymous=await browser.newContext();
  assert.equal((await anonymous.request.get(url+'/admin')).status(),401);
  assert.equal((await anonymous.request.get(url+'/api/core/sectors')).status(),401);
  await anonymous.close();
  const context=await browser.newContext({httpCredentials:{username:access.username,password:access.password},viewport:{width:1440,height:1000}});
  const page=await context.newPage();const badUrls=[];
  page.on('request',r=>{if(/^https?:\/\/(localhost|127\.0\.0\.1)/.test(r.url()))badUrls.push(r.url());});
  await page.goto(url+'/admin');
  await page.getByRole('heading',{name:'Painel Administrativo',exact:true}).waitFor();
  await page.getByText('Java: conectado',{exact:true}).waitFor();
  const sectorsResponse=await context.request.get(url+'/api/core/sectors');assert.equal(sectorsResponse.status(),200);
  const sectors=await sectorsResponse.json();assert.ok(sectors.items.length);
  const events=await (await context.request.get(url+'/api/vision/events')).json();
  const accepted=events.items.find(e=>e.delivery==='HTTP_ACKNOWLEDGED');assert.ok(accepted);
  const sendUrl=url+'/api/vision/events/'+accepted.event.event_id+'/send';
  assert.equal((await context.request.post(sendUrl,{headers:{Origin:'https://invalid.example'},data:{}})).status(),403);
  assert.equal((await context.request.post(sendUrl,{headers:{Origin:url},data:{}})).status(),200);
  await page.goto(url+'/totem/entrada');
  await page.getByRole('heading',{name:'Bem-vindo ao Articuno!'}).waitFor();
  await page.locator('.heatmap-zone').first().waitFor();
  assert.deepEqual(badUrls,[]);
  await page.screenshot({path:new URL('../../.demo/screenshots/public-totem.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});
  const result={checked_at:new Date().toISOString(),url,anonymous:401,authenticated:200,cross_origin_mutation:403,same_origin_retry:200,sector_count:sectors.items.length,device:'same Windows machine, Edge through public HTTPS',other_device:'not verified by this test'};
  writeFileSync(new URL('../../.demo/public-validation.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
} finally {await browser.close();}
