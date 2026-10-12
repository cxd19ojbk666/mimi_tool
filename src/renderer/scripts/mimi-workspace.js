/* 咪咪工具共享工作台控制器：侧栏、拖动宽度和移动端导航的唯一行为源。 */
(function(global){
  'use strict';
  const clamp=value=>Math.max(220,Math.min(420,Math.round(value)));
  function mount(options={}){
    const root=document.querySelector(options.root||'#workspace');
    if(!root)throw new Error('MimiWorkspace: workspace not found');
    const read=options.read||(()=>({})),write=options.write||(()=>{});
    const defaults={left:290,right:280,...options.widths};
    const mobileMedia=options.mobileMedia||'(max-width:760px)';
    let ui=read()||{};
    const revealCleanups={left:null,right:null};
    const el=id=>document.getElementById(id);
    function persist(){write(ui)}
    function apply(){
      ui=read()||ui||{};
      const left=clamp(+ui.leftWidth||defaults.left),right=clamp(+ui.rightWidth||defaults.right);
      root.style.setProperty('--left-w',left+'px');root.style.setProperty('--right-w',right+'px');
      root.style.setProperty('--left-width',left+'px');root.style.setProperty('--right-width',right+'px');
      root.classList.toggle('hide-left',!!ui.leftHidden);root.classList.toggle('hide-right',!!ui.rightHidden);
      for(const side of ['left','right']){
        el('show'+side[0].toUpperCase()+side.slice(1))?.setAttribute('aria-hidden',String(!ui[side+'Hidden']));
        el(side+'Resizer')?.setAttribute('aria-valuenow',side==='left'?left:right);
      }
    }
    function setPanel(side,hidden){
      ui=read()||ui;
      revealCleanups[side]?.();
      const revealClass='revealing-'+side;
      if(hidden)root.classList.remove(revealClass);
      else root.classList.add(revealClass);
      ui[side+'Hidden']=hidden;apply();persist();
      if(!hidden){
        let timer=0;
        const finishReveal=event=>{
          if(event&&event.target!==root)return;
          root.removeEventListener('transitionend',finishReveal);
          clearTimeout(timer);
          root.classList.remove(revealClass);
          revealCleanups[side]=null;
        };
        revealCleanups[side]=finishReveal;
        root.addEventListener('transitionend',finishReveal);
        timer=setTimeout(()=>finishReveal(),360);
      }
    }
    function setMobilePanel(panel,{scroll=true}={}){
      if(!root.querySelector(`[data-mobile-panel-name="${panel}"]`))return;
      root.dataset.mobilePanel=panel;
      root.querySelectorAll('[data-workspace-panel]').forEach(item=>item.classList.toggle('is-mobile-active',item.dataset.mobilePanelName===panel));
      document.querySelectorAll('.mobile-nav [data-mobile-panel]').forEach(button=>{const active=button.dataset.mobilePanel===panel;button.classList.toggle('active',active);active?button.setAttribute('aria-current','page'):button.removeAttribute('aria-current')});
      if(scroll&&matchMedia(mobileMedia).matches)requestAnimationFrame(()=>root.scrollIntoView({block:'start',behavior:options.reducedMotion?.()?'auto':'smooth'}));
      options.onMobilePanel?.(panel);
    }
    function initResizer(side){
      const handle=el(side+'Resizer');if(!handle)return;
      const key=side+'Width',fallback=defaults[side];handle.setAttribute('aria-valuemin','220');handle.setAttribute('aria-valuemax','420');
      handle.addEventListener('pointerdown',event=>{
        if(innerWidth<=1100||event.button!==0)return;event.preventDefault();
        const pointerId=event.pointerId;let raw=+(read()?.[key])||fallback,active=true;
        const finish=e=>{if(!active||e?.pointerId!==undefined&&e.pointerId!==pointerId)return;active=false;root.classList.remove('resizing');window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);window.removeEventListener('blur',finish);handle.removeEventListener('lostpointercapture',finish);if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);if(raw<170)setPanel(side,true);else persist()};
        const move=e=>{if(!active||e.pointerId!==pointerId)return;if(e.pointerType==='mouse'&&e.buttons===0){finish(e);return}const rect=root.getBoundingClientRect();raw=side==='left'?e.clientX-rect.left:rect.right-e.clientX;ui=read()||ui;ui[key]=clamp(raw);apply()};
        root.classList.add('resizing');window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);window.addEventListener('blur',finish);handle.addEventListener('lostpointercapture',finish);handle.setPointerCapture(pointerId);
      });
      handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const direction=event.key==='ArrowRight'?1:-1,multiplier=side==='left'?1:-1;ui=read()||ui;ui[key]=clamp((+ui[key]||fallback)+direction*multiplier*10);apply();persist()});
      handle.ondblclick=()=>{ui=read()||ui;ui[key]=fallback;apply();persist()};
    }
    for(const side of ['left','right']){
      el('hide'+side[0].toUpperCase()+side.slice(1))?.addEventListener('click',()=>setPanel(side,true));
      el('show'+side[0].toUpperCase()+side.slice(1))?.addEventListener('click',()=>setPanel(side,false));
      initResizer(side);
    }
    document.querySelectorAll('.mobile-nav [data-mobile-panel]').forEach(button=>button.addEventListener('click',()=>setMobilePanel(button.dataset.mobilePanel)));
    apply();
    requestAnimationFrame(()=>root.classList.add('mimi-workspace-mounted'));
    return {apply,setPanel,setMobilePanel,state:()=>ui};
  }
  global.MimiWorkspace=Object.freeze({mount});
})(window);

/* 点名工作台仅在对应业务页挂载，其他工具继续使用公共 mount。 */
(function(){
  'use strict';
  function mountRollCall(){
  if(document.body?.dataset.mimiTool!=='roll-call')return;
  MimiCommon.init({action:'点名器',subject:'点名'});
  const $=id=>document.getElementById(id),D=MimiCommon.roster,KEY='mimi-roll-call-v2';
  MimiSettings.mount({key:'mimi-roll-call-appearance-v1'});
  const defaults=()=>({students:[],history:[],options:{mode:'student',gender:'all',group:'all',noRepeat:true},ui:{}});
  let state=defaults(),busy=false,sheets=[],pending=null,revealTimer=0;
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'null');
    if(saved){
      if(!Array.isArray(saved.students)||!Array.isArray(saved.history)||saved.students.some(s=>!s||typeof s.id!=='string'||typeof s.name!=='string'||typeof s.gender!=='string'||typeof s.group!=='string')||saved.history.some(h=>!h||!Array.isArray(h.ids)||typeof h.name!=='string'||typeof h.time!=='string'))throw Error();
      state={...defaults(),...saved,options:{...defaults().options,...saved.options}};
    }
  }catch{}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('saveStatus').textContent='已自动保存'}catch{$('saveStatus').textContent='自动保存失败'}}
  function ask(title,message,action,hint=''){$('confirmTitle').textContent=title;$('confirmText').textContent=message;$('confirmHint').textContent=hint;$('confirmHint').hidden=!hint;pending=action;$('confirmDialog').showModal()}
  function selectRosterTab(name){
    document.querySelectorAll('[data-roster-tab]').forEach(button=>{const active=button.dataset.rosterTab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});
    document.querySelectorAll('.roster-tabpage').forEach(page=>{const active=page.id===`roster-tab-${name}`;page.classList.toggle('active',active);page.hidden=!active});
  }
  $('cancel').onclick=()=>$('confirmDialog').close();$('confirm').onclick=()=>{const action=pending;$('confirmDialog').close();action?.()};$('confirmDialog').addEventListener('close',()=>pending=null);
  function downloadExcel(rows,name,sheetName){MimiCommon.download(D.xlsx(rows,sheetName),name)}
  function pool(){return D.candidates(state.students,state.history,state.options)}
  function element(tag,className,text){const node=document.createElement(tag);node.className=className;node.textContent=text;return node}
  function renderRoundTotal(){$('roundTotal').textContent=D.calledIds(state.history).size}
  function renderHistory(){
    $('historyCount').textContent=state.history.length+' 次';$('historyList').replaceChildren();
    if(!state.history.length)$('historyList').append(element('div','empty','暂无记录'));
    [...state.history].reverse().forEach((h,i)=>{const row=element('div','history-item','');row.append(element('small','',`第 ${state.history.length-i} 次 · ${h.mode==='group'?'小组抽取':'随机点名'} · ${new Date(h.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}`),element('b','',h.name));if(h.mode==='group')row.append(element('small','',h.names.join('、')));$('historyList').append(row)});
    $('undo').disabled=busy||!state.history.length;$('exportHistory').disabled=busy||!state.history.length;
  }
  function renderPool(){
    const grouped=state.options.mode==='group',available=pool();$('gender').disabled=busy||grouped;
    $('poolCount').textContent=`待抽 ${available.length} ${grouped?'组':'人'}`;$('draw').disabled=busy||!available.length;
    $('draw').textContent=busy?'抽取中…':grouped?'抽小组':'抽取';
    $('drawHint').textContent=grouped?'整组抽取；性别筛选仅限单人模式':'按空格键抽取';
    $('status').textContent=!state.students.length?'请导入名单':!available.length?'暂无可抽对象':grouped?(state.options.noRepeat?'本轮不重复':'允许重复'):`${available.length} 人可抽 · ${state.options.noRepeat?'本轮不重复':'允许重复'}`;
  }
  function render(){renderRoundTotal();renderHistory();renderPool();$('rosterCount').textContent=`（${state.students.length} 人）`;$('clearRoster').disabled=busy;$('newRound').disabled=busy||!state.history.length}
  function syncOptions(){
    const hasGender=state.students.some(s=>s.gender),hasGroup=state.students.some(s=>s.group);
    $('genderControl').hidden=!hasGender;$('groupControl').hidden=!hasGroup;$('modeControl').hidden=!hasGroup;
    if(!hasGender)state.options.gender='all';
    if(!hasGroup){state.options.group='all';state.options.mode='student'}
    $('group').replaceChildren(new Option('全部小组','all'));
    [...new Set(state.students.map(s=>s.group).filter(Boolean))].forEach(g=>$('group').add(new Option(g,g)));
    if(![...$('group').options].some(o=>o.value===state.options.group))state.options.group='all';
    ['mode','gender','group'].forEach(id=>$(id).value=state.options[id]);$('noRepeat').checked=state.options.noRepeat;
  }
  function result(item){
    $('resultCaption').textContent=item?(item.mode==='group'?'抽取结果：小组':'抽取结果：学生'):'待抽取';
    $('resultName').textContent=item?item.name:'待抽取';
    $('resultMeta').textContent=item?(item.mode==='group'?item.names.join('、'):item.meta):'';
  }
  const wait=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
  async function animateDraw(available,choice){
    const resultBox=document.querySelector('.result'),name=$('resultName'),meta=$('resultMeta');
    resultBox.setAttribute('aria-live','off');$('resultCaption').textContent='抽取中';meta.textContent='';
    let previous=-1;
    // 频率先快后慢，模拟纸签轮盘惯性；仅改变展示，不改变预先确定的结果。
    for(let step=0;step<15;step++){
      let index;
      do{index=D.randomIndex(available.length)}while(available.length>1&&index===previous);
      previous=index;name.textContent=available[index].name;
      await wait(42+Math.round(.72*step*step));
    }
    name.textContent=choice.name;await wait(90);resultBox.setAttribute('aria-live','polite');
  }
  function reveal(){
    const center=document.querySelector('.center');clearTimeout(revealTimer);center.classList.remove('reveal');
    void center.offsetWidth;center.classList.add('reveal');
    revealTimer=setTimeout(()=>center.classList.remove('reveal'),850);
  }
  function formatRoster(students){return students.map(student=>{const fields=[student.name,student.gender,student.group];while(fields.at(-1)==='')fields.pop();return fields.join('，')}).join('\n')}
  function preview(rows){
    const parsed=D.normalize(rows);$('rosterText').value=formatRoster(parsed.students);
    $('importStatus').textContent=`${parsed.students.length} 人待应用`;return parsed;
  }
  function apply(){
    let parsed;try{parsed=D.normalize(D.parseText($('rosterText').value))}catch(e){return}
    const action=()=>{state.students=parsed.students;state.history=[];state.options.group='all';syncOptions();result(null);render();save();selectRosterTab('filter');$('importStatus').textContent=`已导入 ${parsed.students.length} 人`;
      const messages=[`已导入 ${parsed.students.length} 人`];if(parsed.duplicates.length)messages.push(`重名 ${parsed.duplicates.length} 处，按不同同学保留`);if(parsed.unknown)messages.push(`${parsed.unknown} 人的性别未识别`);if(parsed.skipped)messages.push(`跳过 ${parsed.skipped} 行空姓名`);$('importStatus').textContent=messages.join('；');
    };
    if(state.students.length)ask('替换名单？','现有名单和记录将被清空。',action);else action();
  }
  function setBusy(value){busy=value;['mode','group','noRepeat','rosterFile','applyRoster','rosterText','sheetSelect','template'].forEach(id=>$(id).disabled=value);$('upload').classList.toggle('is-disabled',value);$('upload').setAttribute('aria-disabled',String(value));render();document.querySelector('.center').classList.toggle('drawing',value)}
  async function draw(){
    if(busy)return;const available=pool();if(!available.length)return;
    const choice=available[D.randomIndex(available.length)],mode=state.options.mode;setBusy(true);
    // 抽取结果在动画前固定，动画不会改变概率。
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches)await animateDraw(available,choice);
    const item={mode,name:choice.name,names:choice.members.map(s=>s.name),ids:choice.members.map(s=>s.id),time:new Date().toISOString(),meta:mode==='group'?'':`${choice.members[0].gender||'未填性别'} · ${choice.members[0].group||'未分组'}`};
    state.history.push(item);result(item);setBusy(false);reveal();save();
  }
  document.querySelectorAll('[data-roster-tab]').forEach(button=>button.onclick=()=>selectRosterTab(button.dataset.rosterTab));
  $('draw').onclick=draw;$('applyRoster').onclick=apply;
  ['mode','gender','group','noRepeat'].forEach(id=>$(id).onchange=()=>{state.options[id]=id==='noRepeat'?$(id).checked:$(id).value;renderPool();save()});
  $('newRound').onclick=()=>ask('重置本轮？','本轮记录将清空。',()=>{state.history=[];result(null);render();save();});
  $('undo').onclick=()=>{state.history.pop();result(state.history.at(-1));render();save();};
  $('clearRoster').onclick=()=>ask('清空名单？','名单和记录将被清空，且无法撤销。',()=>{state.students=[];state.history=[];sheets=[];$('sheetControl').hidden=true;$('rosterText').value='';$('importStatus').textContent='';syncOptions();result(null);render();save()},'清空后无法撤销，请确认不再需要当前内容。');
  $('template').onclick=()=>downloadExcel([['姓名','性别','小组'],['张小雨','女','第一组'],['王一鸣','男','第二组']],'点名器-名单模板.xlsx','名单');
  $('exportHistory').onclick=()=>downloadExcel([['次数','时间','抽取方式','结果','成员'],...state.history.map((h,i)=>[i+1,h.time,h.mode==='group'?'小组':'单人',h.name,h.names.join('、')])],'点名器-点名记录.xlsx','点名记录');
  $('rosterFile').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;setBusy(true);
    try{
      if(file.size>5*1024*1024)throw Error('文件超过 5 MB，请删去无关内容后重试');
      const extension=file.name.split('.').pop().toLowerCase();
      if(!['xls','xlsx','txt','csv','tsv'].includes(extension))throw Error('请上传 .xls、.xlsx、.txt、.csv 或 .tsv 文件');
      if(extension==='xls'||extension==='xlsx'){
        const workbook=await D.readWorkbook(file);sheets=workbook;$('sheetSelect').replaceChildren(...sheets.map((s,i)=>new Option(s.name,String(i))));$('sheetControl').hidden=false;preview(sheets[0].rows());
      }else{
        const bytes=await file.arrayBuffer();let text;
        const start=new Uint8Array(bytes);if(start[0]===255&&start[1]===254)text=new TextDecoder('utf-16le').decode(bytes);else if(start[0]===254&&start[1]===255)text=new TextDecoder('utf-16be').decode(bytes);else{try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{text=new TextDecoder('gb18030').decode(bytes)}}
        preview(D.parseText(text));sheets=[];$('sheetControl').hidden=true;
      }

    }catch(e){$('importStatus').textContent=`导入失败：${e.message}`}
    finally{event.target.value='';setBusy(false)}
  };
  $('sheetSelect').onchange=()=>{try{preview(sheets[+$('sheetSelect').value].rows())}catch(e){$('rosterText').value='';$('importStatus').textContent=e.message;}};
  document.addEventListener('keydown',event=>{if(event.code!=='Space'||event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')||$('confirmDialog').open)return;event.preventDefault();draw()});
  MimiWorkspace.mount({read:()=>state.ui,write:save});
  if(state.students.length)$('rosterText').value=formatRoster(state.students);
  syncOptions();result(state.history.at(-1));render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountRollCall,{once:true});
  else mountRollCall();
})();
