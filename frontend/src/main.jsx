import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Badge, Icon, Totem } from './features/monitoring/components/Visuals';
import { Dashboard } from './features/monitoring/Dashboard';
import { Monitor } from './features/monitoring/Monitor';
import { useResource, sectorsFrom, demo } from './features/monitoring/api';
import './styles.css';
import './integration.css';

function App(){
  const [path,setPath]=useState(window.location.pathname),[mode,setMode]=useState('real'),[revision,setRevision]=useState(0),[settings,setSettings]=useState(false);
  useEffect(()=>{const changed=()=>setPath(window.location.pathname);window.addEventListener('popstate',changed);return()=>window.removeEventListener('popstate',changed);},[]);
  function navigate(target){window.history.pushState({},'',target);setPath(target);window.scrollTo(0,0);}
  const refresh=()=>setRevision(n=>n+1),real=mode==='real';
  const resources={dashboard:useResource('/api/core/dashboard',real,revision),sectors:useResource('/api/core/sectors',real,revision),sessions:useResource('/api/core/sessions?limit=50',real,revision),events:useResource('/api/vision/events?limit=100',real,revision),cameras:useResource('/api/vision/cameras',real,revision),status:useResource('/api/vision/status',real,revision)};
  const config=useResource('/api/config',real,0),health=useResource('/api/vision/health',real,revision);
  const data=real?resources:Object.fromEntries(Object.entries(demo).map(([key,value])=>[key,{data:value,loading:false,error:''}]));
  const labels={dashboard:'Indicadores Java',sectors:'Setores Java',sessions:'Sessões Java',events:'Eventos Python',cameras:'Câmeras Python',status:'Vídeo Python'};
  const errors=real?Object.entries(resources).filter(([,v])=>v.error).map(([k,v])=>labels[k]+': '+v.error):[];
  const loading=real&&Object.values(resources).some(r=>r.loading);
  const kiosk=path==='/totem/entrada',monitor=path==='/admin/cameras';
  const nav=<><button className={!kiosk&&!monitor?'nav-active':''} onClick={()=>navigate('/admin')}><Icon name="dashboard"/>Dashboard</button><button className={monitor?'nav-active':''} onClick={()=>navigate('/admin/cameras')}><Icon name="camera"/>Câmeras</button><button onClick={()=>navigate('/totem/entrada')}><Icon name="map"/>Totem de entrada</button><button onClick={()=>setSettings(true)}><Icon name="cog"/>Configurações</button></>;
  return <div className={'app '+(kiosk?'kiosk-mode':'')}>
    {!kiosk&&<aside className="sidebar"><div className="sidebar-brand"><span className="brand-logo">P</span><strong>ARTICUNO</strong><small>ESTACIONAMENTO INTELIGENTE</small></div><div className="side-line"/><nav aria-label="Navegação principal">{nav}</nav><div className="sidebar-bottom"><div className="side-status"><span className="pulse"/>{real?'APIs reais':'Contingência visual'}</div><span>Articuno · MVP Hackathon</span></div></aside>}
    <div className="main-area">{kiosk?<nav className="kiosk-back" aria-label="Navegação principal">{nav}</nav>:<header className="topbar"><div><h1>{monitor?'Monitoramento de Câmeras':'Painel Administrativo'}</h1><p>Gestão e monitoramento inteligente de estacionamento</p></div><div className="topbar-right"><Badge tone={!real?'yellow':errors.length?'red':'success'}>{!real?'DADOS SIMULADOS':errors.length?'API INDISPONÍVEL':loading?'CONECTANDO':'APIs REAIS'}</Badge><button className="icon-only" aria-label="Configurações" onClick={()=>setSettings(true)}><Icon name="cog"/></button></div></header>}
    {!real&&<div className="demo-banner" role="status"><Icon name="info"/><strong>Contingência — DADOS SIMULADOS.</strong> Visualização de exemplo, sem consultar ou alterar os backends. Ações desabilitadas.</div>}
    {errors.length>0&&<div className="connection-errors" role="alert">{errors.map(e=><div className="alertbar error" key={e}><Icon name="alert"/>{e}</div>)}<button className="text-link" onClick={refresh}>Tentar novamente</button></div>}
    {!kiosk&&real&&<div className="service-strip"><span>Java: {resources.dashboard.error?'indisponível':resources.dashboard.data?'conectado':'carregando'}</span><span>Python: {health.error?'indisponível':health.data?'conectado':'carregando'}</span><span>Atualização automática • 2,5 s</span></div>}
    {kiosk?<Totem sectors={sectorsFrom(data.sectors.data)} mode={mode} onRefresh={refresh} unavailable={!data.sectors.data} apiError={data.sectors.loading?'Carregando setores…':data.sectors.error}/>:monitor?<Monitor key={mode} resources={data} refresh={refresh} mode={mode} initialFilename={config.data?.video_filename}/>:<Dashboard resources={data} refresh={refresh} navigate={navigate}/>}
    </div>
    {settings&&<div className="modal-backdrop"><div className="settings-panel" role="dialog" aria-modal="true" aria-label="Configurações"><div className="settings-top"><div><h2>Modo de operação</h2><p>APIs reais por padrão. Contingência sempre identificada.</p></div><button className="icon-only" onClick={()=>setSettings(false)} aria-label="Fechar"><Icon name="x"/></button></div><div className="mode-select"><button className={real?'active':''} onClick={()=>{setMode('real');setSettings(false);}}><Icon name="server"/>APIs reais</button><button className={!real?'active':''} onClick={()=>{setMode('demo');setSettings(false);}}><Icon name="play"/>Contingência visual</button></div><div className="settings-notice"><Icon name="shield"/>URLs e credenciais são configuradas apenas no servidor. A chave interna nunca é enviada ao navegador. OCR, tickets e pagamentos permanecem pendentes.</div></div></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
