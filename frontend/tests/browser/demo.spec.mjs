import { test,expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync,mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve('..');
const screenshots=resolve(root,'.demo/screenshots');
mkdirSync(screenshots,{recursive:true});
const service=(action,name)=>execFileSync(process.execPath,[resolve(root,'scripts/demo.mjs'),action,name],{cwd:root,windowsHide:true,timeout:60000,stdio:'pipe'});
const get=async(request,path)=>{const r=await request.get(path);expect(r.ok()).toBeTruthy();return r.json();};

test('real browser: ENTRY, PASSAGE, retry, outage, MP4 and responsive views',async({page,context,request})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const secret=JSON.parse(readFileSync(resolve(root,'.demo/runtime.json'),'utf8')).internalKey;
  const exposed=[];page.on('request',r=>{if(JSON.stringify(r.headers()).includes(secret)||r.url().includes(secret))exposed.push(r.url());});
  const before=await get(request,'/api/core/dashboard');
  const sectorsBefore=await get(request,'/api/core/sectors');
  const plate='MVP'+String(Date.now()%10000).padStart(4,'0');
  await page.goto('/admin');
  await expect(page.getByRole('heading',{name:'Painel Administrativo',exact:true})).toBeVisible();
  await expect(page.locator('.kpi').filter({hasText:'Vagas totais'}).locator('.kpi-value')).toHaveText(String(before.total_capacity));
  await page.screenshot({path:resolve(screenshots,'01-dashboard.png'),fullPage:true});
  const totem=await context.newPage();await totem.goto('/totem/entrada');
  await expect(totem.locator('.totem-stat').first().locator('strong')).toHaveText(String(before.free_estimated));
  await page.getByRole('button',{name:'Câmeras',exact:true}).click();
  await expect(page.getByLabel('Câmera lógica')).toHaveValue('CAM_ENTRADA');
  await page.getByLabel('Placa (opcional)').fill(plate);
  const created=page.waitForResponse(r=>r.url().endsWith('/events/simulate')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Registrar evento assistido',exact:true}).click();
  const entry=await (await created).json();expect(entry.event.source).toBe('ASSISTED');expect(entry.delivery).toBe('NOT_SENT');
  await page.getByRole('button',{name:'Enviar último evento ao Java',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Evento aceito e aplicado pelo Java'})).toBeVisible();
  const entryReceipt=await get(request,'/api/core/receipts/'+entry.event.event_id);
  expect(entryReceipt.receipt.status).toBe('APPLIED');
  const sessionId=entryReceipt.receipt.session_id;
  await expect(totem.locator('.totem-stat').first().locator('strong')).toHaveText(String(before.free_estimated-1));
  await page.getByRole('button',{name:'Dashboard',exact:true}).click();
  await expect(page.locator('.kpi').filter({hasText:'Sessões ativas'}).locator('.kpi-value')).toHaveText(String(before.active_sessions+1));
  await expect(page.getByRole('row').filter({hasText:plate})).toContainText('Setor A');
  await page.getByRole('button',{name:'Câmeras',exact:true}).click();
  // Another car's receipt must not contaminate the passage identified by plate.
  await page.getByLabel('Placa (opcional)').fill('REG'+plate.slice(3));
  await page.getByRole('button',{name:'Registrar evento assistido',exact:true}).click();
  await page.getByRole('button',{name:'Enviar último evento ao Java',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Evento aceito e aplicado pelo Java'})).toBeVisible();
  await page.getByLabel('Câmera lógica').selectOption('CAM_A_B');
  await page.getByLabel('Placa (opcional)').fill(plate);
  const passageCreated=page.waitForResponse(r=>r.url().endsWith('/events/simulate')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Registrar evento assistido',exact:true}).click();
  const passage=await (await passageCreated).json();expect(passage.event.event_type).toBe('PASSAGE');expect(passage.event.session_id).toBeNull();
  await page.getByRole('button',{name:'Enviar último evento ao Java',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Evento aceito e aplicado pelo Java'})).toBeVisible();
  const receipt=await get(request,'/api/core/receipts/'+passage.event.event_id);
  expect(receipt.receipt.session_id).toBe(sessionId);expect(receipt.receipt.sector_id).toBe('B');
  const sectorsAfter=await get(request,'/api/core/sectors');
  expect(sectorsAfter.items.find(s=>s.sector_id==='A').occupied_estimated).toBe(sectorsBefore.items.find(s=>s.sector_id==='A').occupied_estimated+1);
  expect(sectorsAfter.items.find(s=>s.sector_id==='B').occupied_estimated).toBe(sectorsBefore.items.find(s=>s.sector_id==='B').occupied_estimated+1);
  await expect(totem.locator('.heatmap-zone').filter({hasText:'Setor B'})).toContainText((sectorsBefore.items.find(s=>s.sector_id==='B').free_estimated-1)+' vagas livres');
  await page.getByRole('button',{name:'Enviar último evento ao Java',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Evento aceito e aplicado pelo Java'})).toBeVisible();
  expect(await get(request,'/api/core/sectors')).toEqual(sectorsAfter);
  expect((await get(request,'/api/core/dashboard')).active_sessions).toBe(before.active_sessions+2);
  await page.screenshot({path:resolve(screenshots,'02-monitoramento.png'),fullPage:true});
  await totem.screenshot({path:resolve(screenshots,'03-totem.png'),fullPage:true});

  // Actual JVM interruption, not a mocked browser response. Always restore it.
  try{
    service('stop','java');
    await expect(totem.getByRole('alert')).toContainText('Serviço java indisponível');
    await expect(totem.locator('.totem-stat').first().locator('strong')).toHaveText('—');
    expect((await request.get('/api/core/sectors')).status()).toBe(502);
    expect((await request.get('/api/vision/cameras')).status()).toBe(200);
  }finally{service('start','java');}
  await expect(totem.locator('.totem-stat').first().locator('strong')).toHaveText(String(before.free_estimated-2));
  expect((await get(request,'/api/core/dashboard')).active_sessions).toBe(before.active_sessions+2);

  const config=await get(request,'/api/config');expect(config.video_filename).toMatch(/\.mp4$/i);
  await page.locator('input[type=file]').setInputFiles(resolve(root,'backend/parking-vision-python/videos',config.video_filename));
  await expect.poll(()=>page.locator('video').evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1);
  await page.locator('video').evaluate(async v=>{v.muted=true;await v.play();});
  await expect.poll(()=>page.locator('video').evaluate(v=>v.currentTime)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Iniciar análise',exact:true}).click();
  await expect.poll(async()=> (await get(request,'/api/vision/status')).state,{timeout:45000}).toBe('completed');
  const video=await get(request,'/api/vision/status');expect(video.frames_read).toBeGreaterThan(0);expect(video.frames_sampled).toBeGreaterThan(0);
  await expect(page.getByTestId('video-status')).toContainText(String(video.frames_read));
  await page.setViewportSize({width:390,height:844});
  for(const path of ['/admin','/admin/cameras','/totem/entrada']){
    await page.goto(path);await expect(page.locator('.connection-errors')).toHaveCount(0);
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:resolve(screenshots,'mobile-'+path.split('/').pop()+'.png'),fullPage:true});
  }
  await page.goto('/admin/cameras');
  await page.getByRole('button',{name:'Configurações',exact:true}).first().click();
  await page.getByRole('button',{name:'Contingência visual',exact:true}).click();
  await expect(page.locator('.demo-banner')).toContainText('DADOS SIMULADOS');
  await expect(page.getByRole('button',{name:'Registrar evento assistido',exact:true})).toBeDisabled();
  expect(exposed).toEqual([]);expect(errors).toEqual([]);
  console.log(JSON.stringify({entry:entry.event.event_id,passage:passage.event.event_id,session:sessionId,frames_read:video.frames_read,frames_sampled:video.frames_sampled,occupancy_before:before.occupied_estimated,occupancy_after:before.occupied_estimated+2}));
});

test('manual session without plate, read-only result, rejected passage and video stop',async({page,request,baseURL})=>{
  await page.goto('/admin/cameras');
  await expect(page.getByLabel('Câmera lógica')).toHaveValue('CAM_ENTRADA');
  await expect(page.getByLabel('Placa (opcional)')).toBeEmpty();
  const response=page.waitForResponse(r=>r.url().endsWith('/events/simulate')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Registrar evento assistido',exact:true}).click();
  const entry=await(await response).json();expect(entry.event.plate).toBeNull();
  await page.getByRole('button',{name:'Enviar último evento ao Java',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Evento aceito e aplicado pelo Java'})).toBeVisible();
  const sessionId=(await get(request,'/api/core/receipts/'+entry.event.event_id)).receipt.session_id;
  await page.getByLabel('Câmera lógica').selectOption('CAM_A_B');
  await expect(page.getByLabel('Session ID conhecido (sem placa)')).toHaveValue(sessionId);
  const passageResponse=page.waitForResponse(r=>r.url().endsWith('/events/simulate')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Registrar evento assistido',exact:true}).click();
  const passage=await(await passageResponse).json();expect(passage.event.session_id).toBe(sessionId);
  await page.getByRole('button',{name:'Enviar último evento ao Java',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Evento aceito e aplicado pelo Java'})).toBeVisible();
  const count=(await get(request,'/api/core/dashboard')).active_sessions;
  const sent=[];page.on('request',r=>{if(r.url().endsWith('/send'))sent.push(r.url());});
  const row=page.getByRole('row').filter({hasText:passage.event.event_id});
  await row.getByRole('button',{name:'Ver resultado',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Nenhum reenvio solicitado');expect(sent).toEqual([]);

  // Java is real: create a passage for an unknown vehicle and show its rejection.
  await page.getByLabel('Placa (opcional)').fill('ERR'+String(Date.now()%10000).padStart(4,'0'));
  await page.getByRole('button',{name:'Registrar evento assistido',exact:true}).click();
  await page.getByRole('button',{name:'Enviar último evento ao Java',exact:true}).click();
  await expect(page.locator('.action-error')).toContainText('Rejeitado / falha');
  expect((await get(request,'/api/core/dashboard')).active_sessions).toBe(count);
  await page.getByLabel('Câmera lógica').selectOption('CAM_SAIDA');
  await expect(page.getByRole('button',{name:'Registrar evento assistido',exact:true})).toBeDisabled();
  const exit=await request.post('/api/vision/events/simulate',{headers:{Origin:baseURL},data:{operation_id:crypto.randomUUID(),camera_id:'CAM_SAIDA',event_type:'EXIT',session_id:sessionId,source:'ASSISTED'}});
  expect(exit.status()).toBe(200);
  const exitEvent=await exit.json();
  const denied=await(await request.post('/api/vision/events/'+exitEvent.event.event_id+'/send',{headers:{Origin:baseURL},data:{}})).json();
  expect(denied.transport_result.http_status).toBe(403);
  expect((await get(request,'/api/core/dashboard')).active_sessions).toBe(count);

  await page.getByRole('button',{name:'Iniciar análise',exact:true}).click();
  await expect(page.getByRole('button',{name:'Parar análise',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Parar análise',exact:true}).click();
  await expect.poll(async()=> (await get(request,'/api/vision/status')).state).toBe('stopped');
  expect((await request.get('/api/vision/health')).status()).toBe(200);
  console.log(JSON.stringify({manual_entry:entry.event.event_id,manual_session:sessionId,exit_http:denied.transport_result.http_status,video_stop:'stopped'}));
});
