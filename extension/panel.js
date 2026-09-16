import {connectActiveTab} from './access.js';
import {Detector} from './detector.js';
import {getPages,addPage,deletePage,clearPages} from './db.js';
const $=id=>document.getElementById(id);
let target=null, capture=null, click=null, geometry=null, running=false, busy=false, generation=0, pages=[], urls=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const status=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
function controls(){
  for(const id of ['new','capture','click','title','auto','zoom','interval','threshold'])$(id).disabled=running||busy;
  $('start').disabled=running||busy||!capture;
  $('stop').disabled=!running;
  $('export').disabled=running||busy||!pages.length;
  document.querySelectorAll('[data-delete]').forEach(b=>b.disabled=running||busy);
}
function stop(message='캡처를 중지했습니다. PDF로 저장할 수 있습니다.'){
  if(running)busy=true;generation++;running=false;controls();status(message);
}
async function render(){
  pages=await getPages();urls.forEach(URL.revokeObjectURL);urls=[];
  $('count').textContent=pages.length;
  $('pages').replaceChildren();
  if(!pages.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='아직 모은 페이지가 없습니다. 영역을 지정하고 캡처를 시작하세요.';$('pages').append(empty);}
  pages.forEach((p,i)=>{
    const row=document.createElement('article');row.className='page';
    const img=document.createElement('img');img.src=URL.createObjectURL(p.blob);urls.push(img.src);img.alt=`${i+1}번째 캡처`;img.loading='lazy';
    const text=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');
    strong.textContent=`${String(i+1).padStart(2,'0')} 페이지`;small.textContent=new Date(p.time).toLocaleTimeString('ko-KR');text.append(strong,small);
    const remove=document.createElement('button');remove.textContent='삭제';remove.dataset.delete=p.id;remove.setAttribute('aria-label',`${i+1}번째 페이지 삭제`);
    remove.onclick=()=>act(async()=>{await deletePage(p.id);await render();});row.append(img,text,remove);$('pages').append(row);
  });controls();
}
async function act(fn){if(busy||running)return;busy=true;controls();try{await fn();}catch(e){status(e.message,true);}finally{busy=false;controls();}}
async function attach(){
  const tab=await connectActiveTab(chrome);
  if(target?.id!==tab.id){if(target)await chrome.tabs.sendMessage(target.id,{type:'markers'}).catch(()=>{});capture=null;click=null;geometry=null;updateRegions();}
  target=tab;
}
function updateRegions(){
  $('capture').textContent=capture?'재지정':'영역 지정';
  $('click').textContent=click?'재지정':'위치 지정';
  $('captureInfo').textContent=capture?`${Math.round(capture.width)} × ${Math.round(capture.height)} px 선택됨`:'저장할 화면 영역을 지정하세요.';
  $('clickInfo').textContent=click?`위치 (${Math.round(click.x)}, ${Math.round(click.y)}) 클릭`:'다음 페이지 버튼 등을 지정하세요.';
}
async function syncMarkers(){
  if(target)await chrome.tabs.sendMessage(target.id,{type:'markers',capture,click});
}
let lastScreenshot=0;
async function cleanScreenshot(){
  await delay(Math.max(0,650-(performance.now()-lastScreenshot)));
  await chrome.tabs.sendMessage(target.id,{type:'hideMarkers'});
  try{
    const [active]=await chrome.tabs.query({active:true,windowId:target.windowId});
    if(active?.id!==target.id)throw Error('대상 탭에서 다시 시도하세요.');
    lastScreenshot=performance.now();
    return await chrome.tabs.captureVisibleTab(target.windowId,{format:'png'});
  }finally{await chrome.tabs.sendMessage(target.id,{type:'showMarkers'}).catch(()=>{});}
}
async function select(kind){
  await attach();
  const before=await chrome.tabs.sendMessage(target.id,{type:'geometry'});
  if(geometry&&!sameGeometry(geometry,before)){capture=null;click=null;geometry=null;await syncMarkers();updateRegions();}
  if(kind==='capture')capture=null;else click=null;
  await syncMarkers();updateRegions();
  status(kind==='capture'?'드래그 후 방향키로 영역을 1px씩 이동하고 Enter로 확정하세요. Z: 확대경, Esc: 취소.':'웹페이지에서 자동 클릭할 위치를 한 번 클릭하세요. Esc로 취소합니다.');
  const snapshot=kind==='capture'?await cleanScreenshot():undefined;
  const r=await chrome.tabs.sendMessage(target.id,{type:'select',kind,snapshot,zoom:$('zoom').checked});
  $('zoom').checked=r.zoom!==false;await chrome.storage.local.set({zoom:$('zoom').checked});
  if(r.cancelled){status('지정을 취소했습니다. 새로 지정해주세요.');return;}
  if(!sameGeometry(before,r.geometry))throw Error('화면 크기가 바뀌었습니다. 다시 지정하세요.');
  geometry=r.geometry;if(kind==='capture')capture=r.rect;else{click=r.point;$('auto').checked=true;}
  await syncMarkers();updateRegions();status('지정한 위치가 웹페이지에 표시됩니다. 준비되면 캡처를 시작하세요.');
}
function sameGeometry(a,b){return a.docId===b.docId&&a.width===b.width&&a.height===b.height&&a.dpr===b.dpr;}
async function validate(){
  const [active]=await chrome.tabs.query({active:true,windowId:target.windowId});
  if(active?.id!==target.id)throw Error('대상 탭을 벗어나 중지했습니다. 원래 탭에서 다시 시작하세요.');
  const g=await chrome.tabs.sendMessage(target.id,{type:'geometry'});
  if(!sameGeometry(geometry,g))throw Error('페이지나 화면 크기가 바뀌었습니다. 영역을 다시 지정하세요.');
  return g;
}
async function sample(){
  await validate();
  const data=await cleanScreenshot();
  await validate();
  const bitmap=await createImageBitmap(await (await fetch(data)).blob());
  const sx=bitmap.width/geometry.width,sy=bitmap.height/geometry.height;
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(capture.width*sx));canvas.height=Math.max(1,Math.round(capture.height*sy));
  canvas.getContext('2d').drawImage(bitmap,capture.x*sx,capture.y*sy,capture.width*sx,capture.height*sy,0,0,canvas.width,canvas.height);bitmap.close();
  const tiny=document.createElement('canvas');tiny.width=160;tiny.height=Math.max(16,Math.min(160,Math.round(160*canvas.height/canvas.width)));
  const ctx=tiny.getContext('2d',{willReadFrequently:true});ctx.drawImage(canvas,0,0,tiny.width,tiny.height);
  return {canvas,pixels:ctx.getImageData(0,0,tiny.width,tiny.height).data};
}
async function collect(){
  if(!capture||running||busy)return;
  if($('auto').checked&&!click){status('자동 클릭 위치을 먼저 지정하세요.',true);return;}
  await navigator.locks.request('study-capture-session',{ifAvailable:true},async lock=>{
    if(!lock){status('다른 창에서 캡처가 진행 중입니다. 그 창에서 먼저 중지하세요.',true);return;}
    running=true;const token=++generation;controls();
    const detector=new Detector(Number($('threshold').value));
    const interval=Number($('interval').value);let lastClick=0, awaitingChange=false, awaitingSince=0;
    status('화면 변경을 감지하고 있습니다. 첫 화면도 자동 저장됩니다.');
    try{
      while(running&&token===generation){
        const began=performance.now();const {canvas,pixels}=await sample();
        if(!running||token!==generation)break;
        if(detector.observe(pixels,performance.now())){
          if(pages.length>=300)throw Error('한 자료에 최대 300장까지 저장합니다. PDF 저장 후 새 자료를 만드세요.');
          const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
          if(!blob)throw Error('이미지 변환에 실패했습니다.');
          if(!running||token!==generation)break;
          await addPage({blob,width:canvas.width,height:canvas.height,time:Date.now()});
          detector.commit(pixels);awaitingChange=false;await render();status(`${pages.length}장 저장됨 · 다음 화면의 변경을 기다리고 있습니다.`);
        }
        if(!running||token!==generation)break;
        if($('auto').checked && detector.saved && !awaitingChange && performance.now()-lastClick>=interval){
          await validate();if(!running||token!==generation)break;
          const r=await chrome.tabs.sendMessage(target.id,{type:'click',x:click.x,y:click.y,geometry});
          if(r.error)throw Error(r.error);
          lastClick=performance.now();awaitingSince=lastClick;awaitingChange=true;
        }
        if(awaitingChange&&performance.now()-awaitingSince>Math.max(15000,interval*3))throw Error('클릭 후 화면 변경이 없어 중지했습니다. 마지막 페이지인지 확인하거나 변경 감도를 높여주세요.');
        await delay(Math.max(650-(performance.now()-began),0));
      }
    }catch(e){if(token===generation){stop();status(e.message+' 저장된 캡처는 유지됩니다.',true);}}
    finally{running=false;busy=false;controls();}
  });
}
$('new').onclick=()=>act(async()=>{
  if(pages.length&&!confirm('저장된 캡처를 모두 지우고 새 학습자료를 만들까요? 필요한 자료는 먼저 PDF로 저장하세요.'))return;
  await attach();await clearPages();capture=null;click=null;geometry=null;$('auto').checked=false;await syncMarkers();updateRegions();await render();status('캡처 구역과 자동 클릭 위치을 지정하세요.');
});
$('capture').onclick=()=>act(()=>select('capture'));
$('click').onclick=()=>act(()=>select('click'));
$('start').onclick=()=>collect().catch(e=>{stop();status(e.message,true);});
$('stop').onclick=()=>stop();
$('zoom').onchange=()=>chrome.storage.local.set({zoom:$('zoom').checked}).catch(e=>status(e.message,true));
$('title').onchange=()=>chrome.storage.local.set({title:$('title').value}).catch(e=>status(e.message,true));
$('export').onclick=()=>act(async()=>{
  status('PDF를 만들고 있습니다…');
  const {jsPDF}=window.jspdf;let pdf;
  for(let i=0;i<pages.length;i++){
    const p=pages[i],landscape=p.width>p.height,format='a4',orientation=landscape?'landscape':'portrait';
    if(!pdf)pdf=new jsPDF({orientation,unit:'mm',format,compress:true});else pdf.addPage(format,orientation);
    const w=pdf.internal.pageSize.getWidth(),h=pdf.internal.pageSize.getHeight();
    const scale=Math.min((w-16)/p.width,(h-22)/p.height),iw=p.width*scale,ih=p.height*scale;
    pdf.addImage(new Uint8Array(await p.blob.arrayBuffer()),'PNG',(w-iw)/2,(h-22-ih)/2+8,iw,ih,undefined,'FAST');
    pdf.setFontSize(9);pdf.setTextColor(95);pdf.text(`${i+1} / ${pages.length}`,w/2,h-6,{align:'center'});
  }
  const name=($('title').value.trim()||'학습자료').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_');
  pdf.setProperties({title:$('title').value,creator:'Study Capture'});pdf.save(`${name}.pdf`);status(`${pages.length}페이지 PDF 다운로드를 요청했습니다.`);
});
chrome.tabs.onActivated.addListener(info=>{if(running&&info.windowId===target?.windowId&&info.tabId!==target.id)stop('탭을 이동해 자동 중지했습니다.');});
chrome.tabs.onUpdated.addListener((id,change)=>{if(id===target?.id&&change.status==='loading'){if(running)stop('페이지가 이동되어 중지했습니다. 영역을 다시 지정하세요.');capture=null;click=null;geometry=null;updateRegions();controls();}});
chrome.tabs.onRemoved.addListener(id=>{if(id===target?.id){stop('대상 탭이 닫혔습니다. 캡처는 보관되어 있습니다.');target=null;capture=null;click=null;updateRegions();controls();}});
window.addEventListener('pagehide',()=>{generation++;running=false;if(target)chrome.tabs.sendMessage(target.id,{type:'cancelSelection'}).catch(()=>{});});
try{const saved=await chrome.storage.local.get(['title','zoom']);$('zoom').checked=saved.zoom!==false;if(saved.title)$('title').value=saved.title;await render();if(pages.length)status(`이전에 저장한 ${pages.length}장을 복원했습니다. PDF로 저장할 수 있습니다.`);}catch(e){status('저장소를 열 수 없습니다: '+e.message,true);}controls();
