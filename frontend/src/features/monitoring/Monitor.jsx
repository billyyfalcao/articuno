import { useEffect, useRef, useState } from 'react';
import { request, deliveryLabel } from './api';
import { Badge, Surface, IconButton, Icon, CameraIllustration, eventName, fmtTime } from './components/Visuals';
import { Empty } from './Dashboard';

export function Monitor({resources,refresh,mode,initialFilename}) {
  const cameras=resources.cameras.data?.cameras||[],status=resources.status.data;
  const events=[...(resources.events.data?.items||[])].reverse();
  const [cameraId,setCameraId]=useState(''),[plate,setPlate]=useState(''),[sessionId,setSessionId]=useState('');
  const camera=cameras.find(c=>c.camera_id===cameraId)||cameras[0];
  const [filename,setFilename]=useState(initialFilename||''),[sample,setSample]=useState(30);
  const [media,setMedia]=useState(null),[mediaName,setMediaName]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false),[result,setResult]=useState(null),[latest,setLatest]=useState(null);
  const operation=useRef(null),inFlight=useRef(false);
  useEffect(()=>{if(initialFilename)setFilename(v=>v||initialFilename);},[initialFilename]);
  useEffect(()=>()=>{if(media)URL.revokeObjectURL(media);},[media]);
  const disabled=busy||mode==='demo';
  async function action(work){if(inFlight.current)return;inFlight.current=true;setBusy(true);setMessage('');setFailed(false);try{await work();}catch(e){setFailed(true);setMessage(e.message);}finally{inFlight.current=false;setBusy(false);refresh();}}
  function chooseFile(e){const file=e.target.files?.[0];if(!file)return;setMedia(URL.createObjectURL(file));setMediaName(file.name);setFilename(file.name);}
  function start(){action(async()=>{const data=await request('/api/vision/analyze/start',{method:'POST',body:{filename,sample_every:Number(sample)}});setResult(data);setMessage('Processamento solicitado ao FastAPI. A prévia é independente.');});}
  function stop(){action(async()=>{const data=await request('/api/vision/analyze/stop',{method:'POST',body:{}});setResult(data);setMessage('Parada solicitada ao FastAPI.');});}
  function register(e){e.preventDefault();action(async()=>{
    if(!camera)throw new Error('Nenhuma câmera configurada disponível.');
    operation.current ||= crypto.randomUUID();
    const normalizedPlate=plate.trim().toUpperCase()||null;
    const data=await request('/api/vision/events/simulate',{method:'POST',body:{...camera,operation_id:operation.current,plate:normalizedPlate,session_id:camera.event_type==='ENTRY'||normalizedPlate?null:sessionId.trim()||null,source:'ASSISTED'}});
    setLatest(data);setResult(data);operation.current=null;setMessage('Evento registrado localmente — ainda não enviado ao Java.');
  });}
  function send(item){action(async()=>{
    const id=item.event.event_id;
    const data=await request('/api/vision/events/'+id+'/send',{method:'POST',body:{}});
    let receipt;
    try {receipt=await request('/api/core/receipts/'+id);}catch {/* A failed transport may have no Java receipt. */}
    setLatest(data);setResult({python:data,...(receipt?{java:receipt}:{})});
    const applied=receipt?.receipt?.status==='APPLIED';
    if(applied&&receipt.receipt.session_id)setSessionId(receipt.receipt.session_id);
    setFailed(data.delivery!=='HTTP_ACKNOWLEDGED');
    setMessage(applied?'Evento aceito e aplicado pelo Java. Sessão: '+receipt.receipt.session_id:
      `${deliveryLabel(data)}${data.transport_result?.http_status?' · HTTP '+data.transport_result.http_status:''}${receipt?.receipt?.error?' · '+receipt.receipt.error:''}. Reenvios preservam o event_id.`);
  });}
  function inspect(item){action(async()=>{
    const data=await request('/api/vision/events/'+item.event.event_id);
    let receipt;
    if(data.delivery!=='NOT_SENT')try{receipt=await request('/api/core/receipts/'+item.event.event_id);}catch{}
    setResult({python:data,...(receipt?{java:receipt}:{})});
    setMessage('Consulta do evento existente. '+deliveryLabel(data)+'. Nenhum reenvio solicitado.');
  });}
  const running=['running','stopping'].includes(status?.state);
  return <div className="page-content"><div className="monitor-top">
    <Surface title="Visão da câmera" icon="camera" action={<Badge tone={running?'success':'muted'}>{status?.state||'Status indisponível'}</Badge>}>
      <div className="video-screen">{media?<video controls playsInline src={media} className="video-tag" aria-label="Prévia local MP4"/>:<CameraIllustration/>}<div className="video-label"><Icon name="camera" size={14}/> Prévia local · {camera?.camera_id||'—'}</div>{!media&&<span className="illustration-tag">Ilustração do protótipo, não OCR real</span>}</div>
      <div className="media-actions"><label className="file-input"><Icon name="upload" size={16}/> Escolher MP4 para prévia<input type="file" accept="video/mp4,.mp4" onChange={chooseFile}/></label><span className="media-desc">{mediaName||'Nenhum vídeo local selecionado'}</span></div>
      <p className="player-help">A prévia não faz upload. O arquivo também precisa existir na pasta de vídeos do servidor. Prévia e processamento não têm sincronização de frames.</p>
      <div className="video-settings"><label>Arquivo no servidor<input value={filename} onChange={e=>setFilename(e.target.value)} placeholder="nome-do-video.mp4"/></label><label>Intervalo de frames<input type="number" min="1" max="10000" value={sample} onChange={e=>setSample(e.target.value)}/></label></div>
      <div className="video-controls"><IconButton icon="play" kind="primary" disabled={disabled||running||!filename||!status} onClick={start}>Iniciar análise</IconButton><IconButton icon="square" disabled={disabled||!running} onClick={stop}>Parar análise</IconButton></div>
      <div className="mini-status" data-testid="video-status"><div><span>Estado real</span><strong>{status?.state||'—'}</strong></div><div><span>Frames lidos / amostrados</span><strong>{status?`${status.frames_read} / ${status.frames_sampled}`:'—'}</strong></div></div>{status?.error&&<div className="alertbar error">{status.error}</div>}
    </Surface>
    <Surface title="Evento assistido" icon="car" action={<Badge tone="yellow">OCR experimental</Badge>}>
      <div className="notice"><Icon name="info"/><span>Operação manual identificada como ASSISTED. O OCR real ainda não está integrado nem validado. Nenhuma placa é extraída automaticamente.</span></div>
      <form className="sim-form" onSubmit={register}><label>Câmera lógica<select value={camera?.camera_id||''} onChange={e=>setCameraId(e.target.value)} disabled={disabled||!cameras.length}><option value="" disabled>Selecione</option>{cameras.map(c=><option key={c.camera_id} value={c.camera_id}>{c.camera_id} · {eventName(c.event_type)}</option>)}</select></label>
        <div className="field-row"><label>Tipo de evento<input readOnly value={camera?eventName(camera.event_type):'—'}/></label><label>Placa (opcional)<input value={plate} onChange={e=>setPlate(e.target.value)} placeholder="ABC1D23 ou sem placa" maxLength="7"/></label></div>
        {camera?.event_type==='PASSAGE'&&<div className="foot-note">Transição configurada: {camera.origin_sector} → {camera.destination_sector}</div>}
        <label>Session ID conhecido (sem placa)<input value={sessionId} onChange={e=>setSessionId(e.target.value)} placeholder="Obtido no recibo Java" disabled={camera?.event_type==='ENTRY'||!!plate.trim()}/></label>
        {camera?.event_type==='EXIT'&&<div className="notice">Saída bloqueada até autorização do JV-06.</div>}
        <IconButton type="submit" icon="play" kind="primary" disabled={disabled||!camera||camera.event_type==='EXIT'}>Registrar evento assistido</IconButton>
      </form>
      {latest&&<IconButton icon="arrow" kind="primary" disabled={disabled} onClick={()=>send(latest)}>Enviar último evento ao Java</IconButton>}
      {message&&<div role="status" className={'action-result '+(failed?'action-error':'')}>{message}</div>}
      {result&&<details className="details" open><summary>Resposta real da API</summary><pre>{JSON.stringify(result,null,2)}</pre></details>}
      <div className="mini-status"><div><span>Fonte</span><strong>{mode==='demo'?'Contingência visual':'ASSISTED · entrada manual'}</strong></div><div><span>Envio</span><strong>Operação explícita, mesmo event_id</strong></div></div>
    </Surface>
  </div>
  <Surface title="Câmeras do estacionamento" icon="camera"><div className="camera-grid">{cameras.map(c=><button key={c.camera_id} className={'camera-tile '+(camera?.camera_id===c.camera_id?'selected':'')} onClick={()=>setCameraId(c.camera_id)}><Icon name="camera" size={28}/><div><strong>{c.camera_id}</strong><small>{eventName(c.event_type)} · câmera lógica</small></div><Badge tone="success">Configurada</Badge></button>)}</div>{!cameras.length&&<Empty resource={resources.cameras} noun="câmera"/>}</Surface>
  <Surface title="Eventos recentes" icon="list" action={<Badge>{resources.events.data?.total??'—'} eventos locais</Badge>}><div className="table-scroll"><table><thead><tr><th>Horário / placa</th><th>Câmera / evento</th><th>Origem</th><th>Resultado</th><th>Ações</th></tr></thead><tbody>{events.map(item=><tr key={item.event.event_id}><td>{fmtTime(item.event.detected_at)}<br/><strong>{item.event.plate||'Sem placa'}</strong></td><td>{item.event.camera_id}<br/>{eventName(item.event.event_type)}</td><td><Badge>{item.event.source}</Badge></td><td>{deliveryLabel(item)}{item.transport_result?.http_status&&<small className="block">HTTP {item.transport_result.http_status}</small>}</td><td><IconButton disabled={disabled} onClick={()=>inspect(item)}>Ver resultado</IconButton><IconButton disabled={disabled} onClick={()=>send(item)}>{item.delivery==='NOT_SENT'?'Enviar':'Reenviar mesmo evento'}</IconButton><small className="event-id">{item.event.event_id}</small></td></tr>)}</tbody></table>{!events.length&&<Empty resource={resources.events} noun="evento"/>}</div></Surface>
  <div className="foot-note"><Icon name="info" size={15}/> Histórico local Python, últimas 100 operações. Não é uma lista de detecções OCR.</div>
  </div>;
}
