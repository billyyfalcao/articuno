import { useEffect, useState } from 'react';

export async function request(path, {body,signal,...options}={}) {
  const response=await fetch(path,{...options,signal:signal||AbortSignal.timeout(20000),headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok){
    if(data.error==='upstream_unavailable')throw new Error(`Serviço ${data.service} indisponível (HTTP ${response.status}). Confira os serviços locais.`);
    const detail=typeof data.detail==='string'?data.detail:typeof data.error==='string'?data.error:JSON.stringify(data.detail||data);
    throw new Error(`HTTP ${response.status}: ${data.service?data.service+' — ':''}${detail}`);
  }
  return data;
}
export function useResource(path, enabled, revision) {
  const [state,setState]=useState({data:null,error:'',loading:true,at:null});
  useEffect(()=>{
    let cancelled=false,timer;
    const controller=new AbortController();
    setState({data:null,error:'',loading:enabled,at:null});
    async function poll(){
      try{
        let data=await request(path,{signal:controller.signal});
        if(path.startsWith('/api/vision/events?')&&data.total>100)data=await request('/api/vision/events?limit=100&offset='+(data.total-100),{signal:controller.signal});
        if(!cancelled)setState({data,error:'',loading:false,at:new Date()});
      }catch(error){if(!cancelled)setState({data:null,error:error.message,loading:false,at:null});}
      if(!cancelled)timer=setTimeout(poll,2500);
    }
    if(enabled)poll();
    return ()=>{cancelled=true;clearTimeout(timer);controller.abort();};
  },[path,enabled,revision]);
  return state;
}
export const sectorsFrom = data => (data?.items||[]).map(s=>({id:s.sector_id,capacity:s.capacity,occupied:s.occupied_estimated}));
export const deliveryLabel = item => ({NOT_SENT:'Não enviado',HTTP_ACKNOWLEDGED:'Aceito via HTTP',FAILED:'Rejeitado / falha',UNCERTAIN:'Resultado incerto'})[item.delivery]||item.delivery;
export const demo = {
  dashboard:{total_capacity:40,occupied_estimated:1,free_estimated:39,active_sessions:1,estimated:true},
  sectors:{items:[{sector_id:'A',capacity:20,occupied_estimated:1},{sector_id:'B',capacity:20,occupied_estimated:0}]},
  sessions:{items:[{session_id:'EXEMPLO-LOCAL',plate:'DEMO',sector_id:'A',status:'ACTIVE',entered_at:null}]},
  events:{items:[],total:0},cameras:{cameras:[]},status:{state:'Demonstração visual',frames_read:0,frames_sampled:0},
};
