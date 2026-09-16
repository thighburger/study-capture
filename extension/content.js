(() => {
  if (globalThis.__studyCapture) return;
  globalThis.__studyCapture = true;
  const docId = crypto.randomUUID();
  let cancelSelection = null, markerTimer;
  const geometry = () => ({width: innerWidth, height: innerHeight, dpr: devicePixelRatio, docId});
  const marks = document.createElement('div');
  marks.dataset.studyMarkers = '';
  marks.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none!important;';
  const markRoot = marks.attachShadow({mode:'closed'});
  markRoot.innerHTML = `<style>*{box-sizing:border-box}.rect{position:absolute;border:2px solid #087c88;box-shadow:0 0 0 1px white;display:none}.label{position:absolute;left:0;top:0;transform:translateY(-100%);background:#087c88;color:white;padding:3px 7px;font:12px system-ui;white-space:nowrap}.point{position:absolute;width:24px;height:24px;transform:translate(-50%,-50%);border:2px solid #e66b24;border-radius:50%;box-shadow:0 0 0 2px white;display:none}.point:before,.point:after{content:"";position:absolute;background:#e66b24}.point:before{width:34px;height:2px;left:-7px;top:9px}.point:after{height:34px;width:2px;left:9px;top:-7px}.point .label{background:#b84a10;left:20px;top:32px;transform:none}</style><div class="rect"><span class="label">캡처 영역</span></div><div class="point"><span class="label">자동 클릭</span></div>`;
  document.documentElement.append(marks);
  function showMarks(){clearTimeout(markerTimer);marks.style.visibility='visible';}
  function setMarks(m){
    const rect=markRoot.querySelector('.rect'),point=markRoot.querySelector('.point');
    rect.style.display=m.capture?'block':'none';point.style.display=m.click?'block':'none';
    if(m.capture)Object.assign(rect.style,{left:m.capture.x+'px',top:m.capture.y+'px',width:m.capture.width+'px',height:m.capture.height+'px'});
    if(m.click)Object.assign(point.style,{left:m.click.x+'px',top:m.click.y+'px'});
    showMarks();
  }
  chrome.runtime.onMessage.addListener((m, sender, reply) => {
    if (m.type === 'geometry') { reply(geometry()); return; }
    if (m.type === 'markers') {setMarks(m);reply({ok:true});return;}
    if (m.type === 'hideMarkers') {
      marks.style.visibility='hidden';clearTimeout(markerTimer);markerTimer=setTimeout(showMarks,3000);
      requestAnimationFrame(()=>requestAnimationFrame(()=>reply({ok:true})));return true;
    }
    if (m.type === 'showMarkers') {showMarks();reply({ok:true});return;}
    if (m.type === 'cancelSelection') { cancelSelection?.(); showMarks();reply({ok:true}); return; }
    if (m.type === 'select') {
      cancelSelection?.();
      const host = document.createElement('div');
      host.dataset.studySelection='';
      host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
      const root = host.attachShadow({mode:'closed'});
      root.innerHTML = `<style>*{box-sizing:border-box}.overlay{position:fixed;inset:0;cursor:none;touch-action:none}.hint{position:absolute;top:20px;left:50%;transform:translateX(-50%);padding:12px 18px;background:#153d53;color:white;border-radius:10px;font:14px system-ui;pointer-events:none;max-width:90%;text-align:center}.cursor{position:absolute;width:13px;height:13px;border:1px solid #e66b24;transform:translate(-50%,-50%);pointer-events:none}.box{position:absolute;border:1px solid #007e91;background:#00bfd30a;pointer-events:none}.lens{position:absolute;display:none;width:162px;background:#153d53;color:white;border:2px solid white;border-radius:10px;box-shadow:0 3px 18px #0005;overflow:hidden;pointer-events:none}.view{position:relative;width:158px;height:158px}.view:after{content:"";position:absolute;left:74px;top:74px;width:8px;height:8px;border:1px solid #ff542e;box-shadow:0 0 0 1px white}canvas{width:158px;height:158px;image-rendering:pixelated}.coords{text-align:center;font:11px/24px ui-monospace,monospace}</style><div class="overlay"><div class="hint">${m.kind === 'capture' ? '드래그로 영역 지정 · 방향키로 커서 1px 이동 · 놓으면 확정' : '자동 클릭할 위치를 한 번 클릭하세요'} · Esc 취소</div><div class="box"></div><div class="cursor"></div><div class="lens"><div class="view"><canvas width="158" height="158"></canvas></div><div class="coords"></div></div></div>`;
      document.documentElement.append(host);
      const overlay=root.querySelector('.overlay'),box=root.querySelector('.box'),lens=root.querySelector('.lens'),ctx=root.querySelector('canvas').getContext('2d');
      const snapshot=new Image();if(m.snapshot)snapshot.src=m.snapshot;
      let start, rect, done=false, dragging=false, lastPointer=null, zoom=m.zoom!==false, cursor={x:innerWidth/2,y:innerHeight/2};
      const finish=value=>{if(done)return;done=true;host.remove();document.removeEventListener('keydown',key,true);cancelSelection=null;reply({...value,zoom});};
      const key=e=>{
        if(!['Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
        e.preventDefault();e.stopImmediatePropagation();
        if(e.key==='Escape'){finish({cancelled:true});return;}
        const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
        cursor={x:Math.max(0,Math.min(innerWidth,cursor.x+dx)),y:Math.max(0,Math.min(innerHeight,cursor.y+dy))};
        paint();
      };
      cancelSelection=()=>finish({cancelled:true});document.addEventListener('keydown',key,true);
      function position(e){
        const sx=snapshot.naturalWidth/innerWidth||devicePixelRatio,sy=snapshot.naturalHeight/innerHeight||devicePixelRatio;
        return {x:Math.max(0,Math.min(innerWidth,Math.round(e.clientX*sx)/sx)),y:Math.max(0,Math.min(innerHeight,Math.round(e.clientY*sy)/sy))};
      }
      function drawRect(){Object.assign(box.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});}
      function paint(){
        const {x,y}=cursor;
        Object.assign(root.querySelector('.cursor').style,{left:x+'px',top:y+'px'});
        lens.style.display='none';
        if(zoom&&m.kind==='capture'&&snapshot.complete&&snapshot.naturalWidth){
          const px=Math.min(snapshot.naturalWidth-1,Math.round(x*snapshot.naturalWidth/innerWidth)),py=Math.min(snapshot.naturalHeight-1,Math.round(y*snapshot.naturalHeight/innerHeight));
          ctx.imageSmoothingEnabled=false;ctx.fillStyle='#fff';ctx.fillRect(0,0,158,158);
          ctx.drawImage(snapshot,0,0,snapshot.naturalWidth,snapshot.naturalHeight,78-px*8-4,78-py*8-4,snapshot.naturalWidth*8,snapshot.naturalHeight*8);
          lens.style.display='block';lens.style.left=Math.max(0,Math.min(innerWidth-162,x-81))+'px';lens.style.top=Math.max(0,Math.min(innerHeight-188,y>=205?y-205:y+24))+'px';
          root.querySelector('.coords').textContent=`${px}, ${py} px · 8×`;
        }
        if(start&&m.kind==='capture'){
          rect={x:Math.min(x,start.x),y:Math.min(y,start.y),width:Math.abs(x-start.x),height:Math.abs(y-start.y)};
          drawRect();
        }
      }
      snapshot.onload=paint;
      function move(e){
        // Mouseup/click repeat the physical coordinates; preserve keyboard
        // adjustments until the mouse actually moves again.
        if(!lastPointer||e.clientX!==lastPointer.x||e.clientY!==lastPointer.y){
          lastPointer={x:e.clientX,y:e.clientY};cursor=position(e);
        }
        paint();
      }
      overlay.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();move(e);dragging=true;start={...cursor};overlay.setPointerCapture(e.pointerId);paint();};
      overlay.onpointermove=move;
      overlay.onpointerup=e=>{if(e.button===0&&dragging){e.preventDefault();move(e);dragging=false;}};
      overlay.onclick=e=>{
        e.preventDefault();e.stopPropagation();
        if(m.kind==='click')finish({point:{...cursor},geometry:geometry()});
        else if(rect&&rect.width>0&&rect.height>0)finish({rect,geometry:geometry()});
      };
      paint();
      return true;
    }
    if (m.type === 'click') {
      try {
        const g=geometry();
        if(document.visibilityState!=='visible' || g.docId!==m.geometry.docId || g.width!==m.geometry.width || g.height!==m.geometry.height || g.dpr!==m.geometry.dpr)throw Error('페이지나 화면 크기가 바뀌었습니다. 영역을 다시 지정하세요.');
        let el=document.elementFromPoint(m.x,m.y);
        while(el?.shadowRoot?.elementFromPoint(m.x,m.y) && el.shadowRoot.elementFromPoint(m.x,m.y)!==el)el=el.shadowRoot.elementFromPoint(m.x,m.y);
        if(!el || el.closest('[disabled], [aria-disabled="true"]'))throw Error('클릭할 요소가 없거나 비활성화되어 있습니다.');
        if(el.tagName==='IFRAME')throw Error('iframe 내부 자동 클릭은 지원하지 않습니다. 자료를 새 탭에서 열어주세요.');
        for(const type of ['pointerdown','mousedown','pointerup','mouseup','click']) {
          const C=type.startsWith('pointer') ? PointerEvent : MouseEvent;
          el.dispatchEvent(new C(type,{bubbles:true,cancelable:true,composed:true,view:window,clientX:m.x,clientY:m.y,button:0,buttons:type.endsWith('down')?1:0,pointerId:1,pointerType:'mouse',isPrimary:true}));
        }
        reply({ok:true});
      }catch(e){reply({error:e.message});}
    }
  });
})();
