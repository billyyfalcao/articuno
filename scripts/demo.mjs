import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, readdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
import net from 'node:net';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dir=join(root,'.demo');
mkdirSync(dir,{recursive:true});
const stateFile=join(dir,'processes.json'),configFile=join(dir,'runtime.json');
const read=(file,fallback)=>existsSync(file)?JSON.parse(readFileSync(file,'utf8')):fallback;
const save=(file,value)=>writeFileSync(file,JSON.stringify(value,null,2)+'\n',{mode:0o600});
let state=read(stateFile,{});
function owns(item){
  if(!item||!Number.isInteger(item.pid)||!/^[0-9a-f-]{36}$/.test(item.marker))return false;
  try{
    if(process.platform==='win32'){
      const command=execFileSync('powershell.exe',['-NoProfile','-Command',`(Get-CimInstance Win32_Process -Filter "ProcessId = ${item.pid}").CommandLine`],{encoding:'utf8',windowsHide:true});
      return command.includes(item.marker)&&command.includes(root);
    }
    return execFileSync('ps',['-p',String(item.pid),'-o','args='],{encoding:'utf8'}).includes(item.marker);
  }catch{return false;}
}
function stop(name){const item=state[name];if(owns(item)){process.kill(item.pid);console.log(name+': stopped own process');}else if(item)console.log(name+': already stopped or PID no longer belongs to demo');delete state[name];save(stateFile,state);}
async function free(port){await new Promise((done,fail)=>{const server=net.createServer();server.once('error',()=>fail(new Error('Port '+port+' is occupied; no existing process was stopped.')));server.listen(port,'127.0.0.1',()=>server.close(done));});}
async function healthy(port,child){const until=Date.now()+45000;while(Date.now()<until){if(child.exitCode!==null)throw new Error('A demo process exited; check .demo logs.');try{const r=await fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(600)});if(r.ok&&(await r.json()).status==='ok')return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error('Demo health timeout; check .demo logs.');}
async function start(names){
  let config=read(configFile,null);
  if(!config){config={internalKey:randomBytes(32).toString('hex'),username:'articuno',password:randomBytes(18).toString('base64url')};save(configFile,config);}
  const ports={java:Number(process.env.CORE_PORT||config.javaPort||8080),python:Number(process.env.PYTHON_PORT||config.pythonPort||8000),frontend:Number(process.env.FRONTEND_PORT||config.frontendPort||5173)};
  if(Object.values(ports).some(p=>!Number.isInteger(p)||p<1||p>65535)||new Set(Object.values(ports)).size!==3)throw new Error('Configure three different valid ports.');
  config={...config,javaPort:ports.java,pythonPort:ports.python,frontendPort:ports.frontend,publicOrigin:process.env.PUBLIC_ORIGIN??config.publicOrigin??''};
  save(configFile,config);save(join(dir,'access.json'),{username:config.username,password:config.password,local_url:`http://localhost:${ports.frontend}`});
  const core=join(root,'backend/parking-core-java'),vision=join(root,'backend/parking-vision-python'),frontend=join(root,'frontend');
  const jdk=process.env.ARTICUNO_JAVA_HOME||join(homedir(),'.jdks/ms-21.0.7');
  const java=join(jdk,'bin',process.platform==='win32'?'java.exe':'java');
  const python=join(vision,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
  const jar=join(core,'target/parking-core-java-0.1.0-SNAPSHOT.jar');
  for(const path of [java,python,jar,join(frontend,'dist/index.html')])if(!existsSync(path))throw new Error('Missing local prerequisite: '+path);
  const videoDirectory=join(vision,'videos');
  const video=process.env.VIDEO_FILENAME||(existsSync(videoDirectory)?readdirSync(videoDirectory):[]).find(name=>name.toLowerCase().endsWith('.mp4'))||'';
  const env={...process.env,JAVA_HOME:jdk,CORE_PORT:String(ports.java),CORE_BIND_ADDRESS:'127.0.0.1',CORE_DB_PATH:join(dir,'parking.db'),CORE_LAYOUT_PATH:join(core,'parking.example.json'),
    INTERNAL_API_KEY:config.internalKey,JAVA_API_BASE_URL:`http://127.0.0.1:${ports.java}`,PYTHON_API_BASE_URL:`http://127.0.0.1:${ports.python}`,
    JAVA_EVENTS_ENDPOINT:'/api/v1/internal/vision-events',JAVA_IDEMPOTENCY_CONFIRMED:'true',JAVA_TIMEOUT:'2',JAVA_MAX_RETRIES:'2',JAVA_RETRY_DELAY:'0.2',
    CAMERA_CONFIG:join(vision,'cameras.example.json'),VIDEO_ROOT:join(vision,'videos'),CORS_ORIGINS:'[]',
    FRONTEND_PORT:String(ports.frontend),DEMO_USERNAME:config.username,DEMO_PASSWORD:config.password,PUBLIC_ORIGIN:config.publicOrigin,VIDEO_FILENAME:video};
  const created=[];
  try{
    for(const name of names){
      if(owns(state[name])){console.log(name+': already running');continue;}
      await free(ports[name]);
      const marker=randomUUID();
      const bootstrap=`import uvicorn; from app.main import create_app; from app.config import Settings; uvicorn.run(create_app(Settings(_env_file=None)),host='127.0.0.1',port=${ports.python},log_level='warning') # ${marker} ${root.replaceAll('\\','/')}`;
      const command=name==='java'?java:name==='python'?python:process.execPath;
      const args=name==='java'?[`-Darticuno.demo.instance=${marker}`,'-jar',jar]:name==='python'?['-c',bootstrap]:[join(frontend,'server.mjs'),'--instance',marker];
      const cwd=name==='java'?core:name==='python'?vision:frontend;
      const out=openSync(join(dir,name+'.log'),'a');
      const child=spawn(command,args,{cwd,env,detached:true,windowsHide:true,stdio:['ignore',out,out]});closeSync(out);
      child.on('error',()=>{});
      state[name]={pid:child.pid,marker};save(stateFile,state);created.push({name,child});
      await healthy(ports[name],child);child.unref();console.log(name+': ready on loopback port '+ports[name]);
    }
    console.log(`Local URL: http://localhost:${ports.frontend}`);
    console.log('Private access credentials: .demo/access.json (do not publish).');
    console.log('Stop: node scripts/demo.mjs stop');
  }catch(error){for(const {name,child} of created){if(child.exitCode===null)try{child.kill();}catch{}delete state[name];}save(stateFile,state);throw error;}
}
const [action='start',service]=process.argv.slice(2);
const names=service?[service]:['java','python','frontend'];
if(names.some(name=>!['java','python','frontend'].includes(name)))throw new Error('Unknown service.');
try {if(action==='start')await start(names);else if(action==='stop')for(const name of names.toReversed())stop(name);else throw new Error('Use start or stop, optionally java/python/frontend.');}
catch(error){console.error(error.message);process.exitCode=1;}
