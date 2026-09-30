/* 咪咪大王做表格：在本机完成匹配、对比、清洗和成绩可视化。 */
(function(){
  'use strict';
  if(document.body?.dataset.mimiTool!=='table-maker')return;
  MimiCommon.init({action:'做表格',subject:'表格'});
  const $=id=>document.getElementById(id),D=MimiCommon.roster,toast=MimiCommon.toast;
  const MODE_META={
    match:{title:'合并结果'},
    compare:{title:'核对结果'},
    clean:{title:'清理结果'},
    grade:{title:'成绩分析'}
  };
  const state={mode:'match',sources:[],nextId:1,result:null,issuesOnly:false,charts:[],ui:loadUi(),baseSourceId:'',baseKeys:[],baseSelected:null,joins:[],nextJoinId:1,joinAutoInitialized:false};

  const preview=MimiTablePreview.mount($,{styleToCss:excelStyleToCss,onResetFilters:()=>{if(state.result&&$('previewSource').value===''){state.issuesOnly=false;showResult()}}});

  function loadUi(){
    try{
      const ui=JSON.parse(localStorage.getItem('mimi-table-ui')||'{}')||{};
      delete ui.rightHidden;delete ui.rightWidth;return ui;
    }catch{return {}}
  }
  function saveUi(){try{localStorage.setItem('mimi-table-ui',JSON.stringify(state.ui))}catch{}}
  function cleanText(value){return String(value??'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim()}
  function normalizeKey(value,loose=true){let text=cleanText(value).normalize('NFKC');if(loose)text=text.replace(/\s+/g,'').toLocaleLowerCase('zh-CN');return text}
  function isBlank(value){return cleanText(value)===''}
  function uniqueHeaders(row){
    const used=new Set();
    return row.map((value,index)=>{const base=cleanText(value)||`第${index+1}列`;let result=base,n=2;while(used.has(result))result=`${base}_${n++}`;used.add(result);return result});
  }
  function tableFromRows(rawRows,format='csv'){
    const rows=rawRows.map(row=>Array.from(row,value=>value??''));
    const header=rows.slice(0,12).findIndex(row=>row.filter(value=>!isBlank(value)).length>=2);
    return MimiTableWorkbook.fromRows(rows,{start:header<0?1:header+1,depth:1,format});
  }
  function currentTable(slot){
    return state.sources.find(source=>source.id===$(`source${slot}`).value)?.table||null;
  }
  function addSource(name,table,raw=null){
    const source={id:`df${state.nextId++}`,name,table,raw,settingsOpen:false};state.sources.push(source);return source;
  }
  function renderSources(){
    const select=$('sourceA'),previous=select.value;
    select.replaceChildren(option('','请选择数据表'),...state.sources.map(source=>option(source.id,source.name)));
    select.value=state.sources.some(source=>source.id===previous)?previous:'';
    if(!$('sourceA').value&&state.sources.length)$('sourceA').value=state.sources[0].id;
    $('sourceCount').textContent=`${state.sources.length} 张`;
    $('clearAll').hidden=!state.sources.length;
    $('sourceList').replaceChildren(...state.sources.map(source=>{
      const row=document.createElement('div');row.className='source-item';
      const preview=document.createElement('button');preview.type='button';preview.className='source-preview';preview.textContent=source.name;preview.title=`${source.name} · ${source.table.rows.length} 行 · ${source.table.headers.length} 列；点击预览`;
      preview.onclick=()=>{renderSource(source.table,source.name,{preserveResult:true});workspaceController.setMobilePanel('preview')};
      const remove=document.createElement('button');remove.type='button';remove.className='source-remove';remove.textContent='×';remove.setAttribute('aria-label',`移除 ${source.id} ${source.name}`);
      remove.onclick=()=>{state.sources=state.sources.filter(item=>item!==source);renderSources();sourcesChanged()};
      const badge=document.createElement('span');badge.className='source-badge';row.append(preview,badge,remove);
      const item=document.createElement('div');item.className='source-card';item.setAttribute('role','listitem');item.dataset.sourceId=source.id;item.classList.toggle('is-base',source.id===select.value);item.append(row);
      if(source.raw){
        const details=document.createElement('details');details.className='source-settings';details.open=source.settingsOpen;
        details.ontoggle=()=>{source.settingsOpen=details.open};
        const summary=document.createElement('summary');summary.textContent='调整表头';details.append(summary);
        const controls=document.createElement('div');controls.className='source-header-controls';
        for(const [title,key,max] of [['起始行','start',50],['层数','depth',8]]){
          const label=document.createElement('label'),input=document.createElement('input');label.textContent=title;input.type='number';input.className='field';input.min='1';input.max=String(max);input.value=String(key==='start'?source.table.headerStart:source.table.headerDepth);
          input.onchange=()=>{try{
            const start=key==='start'?Number(input.value):source.table.headerStart,depth=key==='depth'?Number(input.value):source.table.headerDepth;
            if(!Number.isInteger(start)||!Number.isInteger(depth)||start<1||depth<1||start>50||depth>8)throw Error('表头起始行或层数无效');
            source.table=source.raw.kind==='worksheet'?MimiTableWorkbook.fromWorksheet(source.raw.sheet,{start,depth}):MimiTableWorkbook.fromRows(source.raw.rows,{start,depth,format:source.raw.format});
            if(source.id===state.baseSourceId)state.baseSourceId='';
            state.joins.filter(join=>join.sourceId===source.id).forEach(join=>{join.keys=state.baseKeys.map(index=>suggestedKey(source.table,index));join.selected=source.table.headers.map((_,i)=>i).filter(i=>!join.keys.includes(i))});
            source.settingsOpen=true;renderSources();sourcesChanged();toast(`${source.id} 的表头已更新`);
          }catch(error){input.value=String(key==='start'?source.table.headerStart:source.table.headerDepth);toast(error.message)}};
          label.append(input);controls.append(label);
        }
        details.append(controls);item.append(details);
      }
      return item;
    }));
    syncPreviewSources();updateSourceHighlights();refreshFlow();
  }
  function sourcesChanged(){
    syncColumnControls();renderBuilder();updateSourceHighlights();refreshFlow();const table=currentTable('A');if(table)renderSource(table,'数据预览');else resetResult();
  }
  function updateSourceHighlights(){document.querySelectorAll('.source-card').forEach(card=>{
    const isBase=card.dataset.sourceId===$('sourceA').value;card.classList.toggle('is-base',isBase);
    const badge=card.querySelector('.source-badge');badge.hidden=!isBase;badge.textContent=['match','compare'].includes(state.mode)?'主表':'当前';
  })}
  function syncPreviewSources(){
    const select=$('previewSource'),previous=select.value;
    select.replaceChildren(option('',state.result?MODE_META[state.mode].title:'选择原始表格'),...state.sources.map(source=>option(source.id,source.name)));
    select.options[0].disabled=!state.result;
    select.value=state.sources.some(source=>source.id===previous)?previous:'';
    updatePreviewSourceTitle();
    $('previewToolbar').hidden=!state.sources.length;$('viewResult').hidden=!state.result;
  }
  function updatePreviewSourceTitle(){
    const select=$('previewSource');
    if(select.options[0]){select.options[0].textContent=state.result?MODE_META[state.mode].title:'选择原始表格';select.options[0].disabled=!state.result}
    const name=select.selectedOptions[0]?.textContent||'选择原始表格';
    $('previewSourceText').textContent=name;
    // 透明覆盖的 select 沿用统一深色气泡提示，写在容器上而非 select 自身，避免原生 title 样式。
    const control=select.closest('.preview-source-control');
    if(select.value&&name)control?.setAttribute('data-tooltip',name);
    else control?.removeAttribute('data-tooltip');
  }
  function refreshFlow(){
    const count=state.sources.length,hasBase=!!currentTable('A'),multi=state.mode==='match'||state.mode==='compare';
    const canConfigure=hasBase&&(!multi||count>=2);
    const joinIds=state.joins.map(join=>join.sourceId);
    const joinsReady=!multi||state.joins.length>0&&new Set(joinIds).size===joinIds.length&&state.joins.every(join=>join.sourceId&&join.sourceId!==$('sourceA').value&&sourceById(join.sourceId));
    const validKeys=keys=>keys.length>0&&new Set(keys).size===keys.length&&keys.every(index=>Number.isInteger(index)&&index>=0);
    const keysReady=!multi||validKeys(state.baseKeys)&&state.joins.every(join=>join.keys.length===state.baseKeys.length&&validKeys(join.keys));
    $('sourceALabel').hidden=!canConfigure||!multi&&count===1;
    $('sourceHint').hidden=!multi||!canConfigure;
    $('sourceHint').textContent=state.mode==='match'?'结果只保留主表的行。':'核对各表的缺失和变化。';
    $('modeControls').hidden=!canConfigure;
    $('openRules').hidden=!canConfigure;
    $('loadSample').hidden=hasBase;
    document.querySelector('.merge-builder').hidden=!multi||!canConfigure;
    document.querySelector('[data-controls="clean"]').hidden=state.mode!=='clean'||!hasBase;
    document.querySelector('[data-controls="grade"]').hidden=state.mode!=='grade'||!hasBase;
    $('rulesDialogTitle').textContent=multi?'设置匹配规则':state.mode==='clean'?'设置清理规则':'设置成绩分析规则';
    $('joinHeading').textContent=state.mode==='compare'?'核对表':'补充表';
    $('addKey').hidden=!!currentTable('A')&&state.baseKeys.length>=currentTable('A').headers.length;
    $('addJoin').hidden=!state.sources.some(source=>source.id!==$('sourceA').value&&!joinIds.includes(source.id));
    $('runTask').disabled=!canConfigure||!joinsReady||!keysReady;
    let hint='';
    if(canConfigure&&!joinsReady)hint=state.joins.length?'参与表重复或为空':'加参与表';
    else if(canConfigure&&!keysReady)hint='匹配列重复或为空';
    $('runHint').textContent=hint;
    $('runHint').hidden=!hint;
    // 数据表列表保持折叠；需要时再查看具体表格。
    if(canConfigure&&!refreshFlow._welcomed){refreshFlow._welcomed=true;$('modeControls')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
    if(!count)refreshFlow._welcomed=false;
  }
  function addManual(){
    try{
      const text=$('manualText').value;if(!text.trim())throw Error('请先输入数据');
      let table;
      if($('manualFormat').value==='names')table={headers:['姓名或编号'],rows:text.split(/\r?\n/).map(value=>[value.trim()]).filter(row=>row[0])};
      else{
        const rows=D.parseText(text),width=Math.max(...rows.map(row=>row.length));
        if(!width)throw Error('请先输入数据');
        const headers=$('manualHeader').checked?uniqueHeaders(Array.from({length:width},(_,i)=>rows[0][i])):Array.from({length:width},(_,i)=>`第${i+1}列`);
        table={headers,rows:($('manualHeader').checked?rows.slice(1):rows).map(row=>headers.map((_,i)=>row[i]??''))};
      }
      if(!table.rows.length)throw Error('请至少输入一行数据');
      const rawRows=[table.headers,...table.rows],parsed=MimiTableWorkbook.fromRows(rawRows,{format:'manual'});
      const source=addSource(cleanText($('manualName').value)||'手动输入',parsed,{kind:'rows',rows:rawRows,format:'manual'});
      if(state.joinAutoInitialized&&(state.mode==='match'||state.mode==='compare'))state.joins.push(makeJoin(source.id));
      $('manualDialog').close();renderSources();sourcesChanged();renderSource(parsed,`${source.id} 已添加`);toast(`已添加 ${source.id}，可在主表或参与表中选择`);
    }catch(error){$('manualError').textContent=error.message;$('manualError').hidden=false}
  }
  function decodeText(buffer){
    const bytes=new Uint8Array(buffer);
    if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(buffer);
    if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(buffer);
    try{return new TextDecoder('utf-8',{fatal:true}).decode(buffer)}catch{return new TextDecoder('gb18030').decode(buffer)}
  }
  async function readFile(file){
    if(file.size>12*1024*1024)throw Error('文件超过 12 MB，请删去无关工作表后重试');
    const ext=file.name.split('.').pop().toLowerCase();
    if(ext==='xlsx'){
      const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());
      return {name:file.name,sheets:workbook.worksheets.map(sheet=>({name:sheet.name,sheet,format:'xlsx'}))};
    }
    if(ext==='xls'){
      const sheets=await D.readWorkbook(file,{raw:true});
      return {name:file.name,sheets:sheets.map(sheet=>({name:sheet.name,rows:sheet.rows(),format:'xls'}))};
    }
    if(!['csv','tsv','txt'].includes(ext))throw Error('请选择 .xls、.xlsx、.csv、.tsv 或 .txt 文件');
    const text=decodeText(await file.arrayBuffer()),rows=D.parseText(text);
    return {name:file.name,sheets:[{name:'数据',rows,format:ext}]};
  }
  function option(value,text=value){return new Option(text,String(value))}
  function fillSelect(select,headers,{firstLabel=null,firstValue=''}={}){
    const previous=select.value,items=[];
    if(firstLabel!==null)items.push(option(firstValue,firstLabel));
    headers.forEach((header,index)=>items.push(option(index,header)));
    select.replaceChildren(...items);
    if([...select.options].some(item=>item.value===previous))select.value=previous;
  }
  function suggestedColumn(headers,patterns,fallback=0){const found=headers.findIndex(header=>patterns.some(pattern=>pattern.test(header)));return found>=0?found:Math.min(fallback,Math.max(0,headers.length-1))}
  function syncColumnControls(){
    const a=currentTable('A');
    ['dedupeKey','studentColumn','scoreColumn'].forEach(id=>{if(!a)$(id).replaceChildren()});
    if(a){
      ['dedupeKey','studentColumn','scoreColumn'].forEach(id=>{
        const first=id==='dedupeKey'?{firstLabel:'整行完全相同',firstValue:'*'}:id==='scoreColumn'?{firstLabel:'自动识别全部成绩列',firstValue:'*'}:{};
        fillSelect($(id),a.headers,first);
      });
      if(state.baseSourceId!==$('sourceA').value)$('studentColumn').value=String(suggestedColumn(a.headers,[/姓名|名字|name/i]));
    }
  }
  function sourceById(id){return state.sources.find(source=>source.id===id)||null}
  function suggestedKey(table,baseIndex){
    if(!table)return -1;
    const base=currentTable('A'),name=base?.headers[baseIndex];
    const exact=table.headers.indexOf(name);
    return exact>=0?exact:suggestedColumn(table.headers,[/学号|编号|id/i,/姓名|名字|name/i]);
  }
  function ensureBuilderState(){
    const baseId=$('sourceA').value,base=currentTable('A');
    if(baseId!==state.baseSourceId){
      const previousBaseId=state.baseSourceId;
      state.baseSourceId=baseId;state.baseKeys=base?[suggestedColumn(base.headers,[/学号|编号|id/i,/姓名|名字|name/i])]:[];
      state.baseSelected=base?base.headers.map((_,i)=>i):null;
      state.joins.forEach(join=>{
        if(join.sourceId===baseId){join.sourceId=sourceById(previousBaseId)?.id||'';join.selected=null}
        const source=sourceById(join.sourceId);
        join.keys=state.baseKeys.map(index=>suggestedKey(source?.table,index));
        if(join.selected===null&&source)join.selected=source.table.headers.map((_,i)=>i).filter(i=>!join.keys.includes(i));
      });
    }
    state.joins.forEach(join=>{
      if(join.sourceId&&!sourceById(join.sourceId)){join.sourceId='';join.keys=[];join.selected=null}
    });
    if(!state.joinAutoInitialized&&state.sources.length>1){
      state.sources.filter(source=>source.id!==baseId).forEach(source=>state.joins.push(makeJoin(source.id)));
      state.joinAutoInitialized=true;
    }
  }
  function makeJoin(sourceId=''){
    const source=sourceById(sourceId),keys=state.baseKeys.map(index=>suggestedKey(source?.table,index));
    return {uid:state.nextJoinId++,sourceId,keys,selected:source?source.table.headers.map((_,i)=>i).filter(i=>!keys.includes(i)):null,fieldsOpen:false,overwrites:[],overwriteOpen:true};
  }
  function fieldPicker(container,source,selected,onChange){
    container.replaceChildren();
    if(!source){const hint=document.createElement('small');hint.textContent='先选择数据表';container.append(hint);return}
    let current=selected.slice();
    const update=next=>{current=next.slice();onChange(current);container.querySelectorAll('input[type="checkbox"]').forEach(input=>{input.checked=current.includes(Number(input.value))})};
    const actions=document.createElement('div');actions.className='field-actions';
    for(const [title,indices] of [['全选',source.table.headers.map((_,i)=>i)],['清空',[]]]){
      const button=document.createElement('button');button.type='button';button.className='field-action';button.textContent=title;
      button.onclick=()=>update(indices);actions.append(button);
    }
    container.append(actions);
    source.table.headers.forEach((header,index)=>{
      const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=String(index);input.checked=current.includes(index);
      input.onchange=()=>{const next=new Set(current);if(input.checked)next.add(index);else next.delete(index);update([...next].sort((a,b)=>a-b))};
      label.append(input,document.createTextNode(header));container.append(label);
    });
  }
  function keySelect(table,value,onChange){
    const select=document.createElement('select');select.className='field';select.setAttribute('aria-label','匹配列');
    select.replaceChildren(option('-1','请选择列'),...(table?.headers||[]).map((header,index)=>option(index,header)));
    select.value=String(value??-1);select.onchange=()=>onChange(Number(select.value));return select;
  }
  function renderBuilder(){
    ensureBuilderState();const base=currentTable('A');
    const baseList=$('baseKeyList');baseList.replaceChildren();
    state.baseKeys.forEach((index,position)=>{
      const row=document.createElement('div');row.className='builder-key-row';
      const text=document.createElement('span');text.textContent=state.baseKeys.length===1?'主表':`条件 ${position+1}`;
      row.append(text,keySelect(base,index,value=>{state.baseKeys[position]=value;state.joins.forEach(join=>{join.keys[position]=suggestedKey(sourceById(join.sourceId)?.table,value)});renderBuilder();renderSource(base,'匹配条件已更新')}));
      if(state.baseKeys.length>1){const remove=document.createElement('button');remove.type='button';remove.className='field-action';remove.textContent='移除';remove.onclick=()=>{state.baseKeys.splice(position,1);state.joins.forEach(join=>join.keys.splice(position,1));renderBuilder();renderSource(base,'匹配条件已更新')};row.append(remove)}
      baseList.append(row);
    });
    const baseSource=sourceById(state.baseSourceId);
    const baseSummary=()=>{$('baseFieldSummary').textContent=`主表保留字段 · ${state.baseSelected?.length||0}/${baseSource?.table.headers.length||0} 列`};
    baseSummary();
    fieldPicker($('baseFieldList'),baseSource,state.baseSelected||[],selected=>{state.baseSelected=selected;baseSummary();renderSource(base,'字段选择已更新')});
    const joinList=$('joinList');joinList.replaceChildren();
    state.joins.forEach((join,joinIndex)=>{
      const source=sourceById(join.sourceId),card=document.createElement('section');card.className='join-card';
      const top=document.createElement('div');top.className='join-card-head';
      const title=document.createElement('strong');title.textContent=`参与表 ${joinIndex+1}`;
      const remove=document.createElement('button');remove.type='button';remove.className='field-action';remove.textContent='移除';remove.setAttribute('aria-label',`移除参与表 ${joinIndex+1}`);
      remove.onclick=()=>{state.joins.splice(joinIndex,1);renderBuilder();if(base)renderSource(base,'参与表已更新')};top.append(title,remove);card.append(top);
      const select=document.createElement('select');select.className='field';select.setAttribute('aria-label',`选择参与表 ${joinIndex+1}`);
      select.replaceChildren(option('','请选择数据表'),...state.sources.filter(item=>item.id!==$('sourceA').value&&(item.id===join.sourceId||!state.joins.some(other=>other!==join&&other.sourceId===item.id))).map(item=>option(item.id,item.name)));select.value=join.sourceId;
      select.onchange=()=>{join.sourceId=select.value;const next=sourceById(join.sourceId);join.keys=state.baseKeys.map(index=>suggestedKey(next?.table,index));join.selected=next?next.table.headers.map((_,i)=>i).filter(i=>!join.keys.includes(i)):null;renderBuilder();if(base)renderSource(base,'参与表已更新')};card.append(select);
      state.baseKeys.forEach((baseIndex,position)=>{
        const row=document.createElement('label');row.className='join-key-row';
        const caption=document.createElement('span');caption.textContent=`${base?.headers[baseIndex]||`条件 ${position+1}`} ↔`;
        row.append(caption,keySelect(source?.table,join.keys[position],value=>{join.keys[position]=value;refreshFlow();renderSource(base,'匹配条件已更新')}));card.append(row);
      });
      // 手动覆盖：选择“附表列 → 主表列”，决定写回主表的字段与策略
      const owWrap=document.createElement('div');owWrap.className='join-overwrite';
      const owHead=document.createElement('div');owHead.className='builder-heading';
      const owTitle=document.createElement('strong');owTitle.textContent='覆盖主表字段';
      const owHint=document.createElement('small');owHint.textContent='手动选择需写回主表的字段';
      owHead.append(owTitle,owHint);owWrap.append(owHead);
      const owList=document.createElement('div');owList.className='stack';owWrap.append(owList);
      const paintOw=()=>{
        owList.replaceChildren();
        (join.overwrites||[]).forEach((ow,oi)=>{
          const row=document.createElement('div');row.className='overwrite-row';
          const fromSel=document.createElement('select');fromSel.className='field';fromSel.setAttribute('aria-label','附表字段');
          fromSel.replaceChildren(option(-1,'附表列…'),...(source?.table.headers||[]).map((h,i)=>option(i,h)));fromSel.value=String(ow.from??-1);
          fromSel.onchange=()=>{ow.from=Number(fromSel.value);refreshFlow();if(base)renderSource(base,'覆盖关系已更新')};
          const arrow=document.createElement('span');arrow.textContent='→';arrow.className='overwrite-arrow';
          const toSel=document.createElement('select');toSel.className='field';toSel.setAttribute('aria-label','主表字段');
          toSel.replaceChildren(option(-1,'主表列…'),...(base?.headers||[]).map((h,i)=>option(i,h)));toSel.value=String(ow.to??-1);
          toSel.onchange=()=>{ow.to=Number(toSel.value);refreshFlow();if(base)renderSource(base,'覆盖关系已更新')};
          const modeSel=document.createElement('select');modeSel.className='field';modeSel.setAttribute('aria-label','覆盖方式');
          modeSel.replaceChildren(option('fillEmpty','仅填空'),option('overwrite','全部覆盖'));modeSel.value=ow.mode||'fillEmpty';modeSel.title='仅填空：主表为空才写入；全部覆盖：直接覆盖主表值';
          modeSel.onchange=()=>{ow.mode=modeSel.value;if(base)renderSource(base,'覆盖方式已更新')};
          const del=document.createElement('button');del.type='button';del.className='field-action';del.textContent='移除';
          del.onclick=()=>{join.overwrites.splice(oi,1);paintOw();refreshFlow();if(base)renderSource(base,'覆盖已移除')};
          row.append(fromSel,arrow,toSel,modeSel,del);owList.append(row);
        });
        if(!(join.overwrites||[]).length){const empty=document.createElement('small');empty.className='overwrite-empty';empty.textContent='暂无覆盖，所选补充字段将作为新增列';owList.append(empty)}
      };
      paintOw();
      const addOw=document.createElement('button');addOw.type='button';addOw.className='quiet-action';addOw.textContent='＋ 加覆盖字段';
      addOw.onclick=()=>{join.overwrites.push({from:-1,to:-1,mode:'fillEmpty'});paintOw()};
      owWrap.append(addOw);card.append(owWrap);
      const disclosure=document.createElement('details');disclosure.className='field-disclosure join-fields';disclosure.open=!!join.fieldsOpen;
      disclosure.ontoggle=()=>{join.fieldsOpen=disclosure.open};
      const fieldSummary=document.createElement('summary');disclosure.append(fieldSummary);
      const updateFieldSummary=()=>{fieldSummary.textContent=`补充字段 · ${join.selected?.length||0}/${source?.table.headers.length||0} 列`};updateFieldSummary();
      const fields=document.createElement('div');fields.className='field-picker';disclosure.append(fields);card.append(disclosure);
      fieldPicker(fields,source,join.selected||[],selected=>{join.selected=selected;updateFieldSummary();if(base)renderSource(base,'字段选择已更新')});
      joinList.append(card);
    });
    refreshFlow();
  }
  function renderSource(table,label,{preserveResult=false}={}){
    if(!preserveResult){state.result=null;state.charts.forEach(item=>item.dispose());state.charts=[]}
    $('exportResult').disabled=true;$('saveResult').disabled=true;$('resultActions').hidden=true;
    $('viewResult').hidden=!state.result;
    $('previewSource').value=state.sources.find(source=>source.table===table)?.id||'';
    updatePreviewSourceTitle();
    $('centerTabs').hidden=true;$('filterIssues').hidden=true;
    $('previewTitle').textContent='数据预览';
    showView('table');
    renderTable(table.headers,table.rows,table.headerRows,table.headerMerges,table,{key:table});
  }
  async function handleFiles(event){
    const files=Array.from(event.target.files);event.target.value='';let added=0;const failures=[],addedSources=[];
    for(const file of files){
      try{
        const workbook=await readFile(file);
        for(const sheet of workbook.sheets){
          try{
            const table=sheet.sheet?MimiTableWorkbook.fromWorksheet(sheet.sheet):tableFromRows(sheet.rows,sheet.format);
            const raw=sheet.sheet?{kind:'worksheet',sheet:sheet.sheet}:{kind:'rows',rows:sheet.rows,format:sheet.format};
            addedSources.push(addSource(`${workbook.name} · ${sheet.name}`,table,raw));added++;
          }
          catch(error){failures.push(`${file.name} / ${sheet.name}：${error.message}`)}
        }
      }catch(error){failures.push(`${file.name}：${error.message}`)}
    }
    if(state.joinAutoInitialized&&(state.mode==='match'||state.mode==='compare'))addedSources.filter(source=>source.id!==$('sourceA').value).forEach(source=>state.joins.push(makeJoin(source.id)));
    renderSources();sourcesChanged();toast(`已添加 ${added} 张数据表${failures.length?'；部分导入失败':''}`);
    if(failures.length)$('centerStatus').textContent=`已添加 ${added} 张。${failures.join('；')}`;
  }

  function setMode(mode){
    state.mode=mode;document.querySelectorAll('.task-button').forEach(button=>{const active=button.dataset.mode===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active))});
    $('compareChangesWrap').hidden=mode!=='compare';
    $('sourceALabel').firstChild.textContent=mode==='clean'||mode==='grade'?'处理对象':'主表';
    $('previewTitle').textContent='表格预览';
    $('chartTab').hidden=true;showView('table');renderBuilder();updateSourceHighlights();
    if(currentTable('A'))renderSource(currentTable('A'),'数据预览');
    if(matchMedia('(max-width:760px)').matches)workspaceController.setMobilePanel('setup',{scroll:false});
  }
  function showView(view){
    const chart=view==='chart'&&state.mode==='grade';$('tableStage').hidden=chart;$('chartStage').hidden=!chart;$('tableTab').classList.toggle('active',!chart);$('chartTab').classList.toggle('active',chart);
    $('tableTab').setAttribute('aria-pressed',String(!chart));$('chartTab').setAttribute('aria-pressed',String(chart));
    preview.setView(chart);
    if(chart){state.charts.forEach(item=>item.resize());requestAnimationFrame(()=>state.charts.forEach(item=>item.resize()))}
  }
  function requireTables(){
    const a=currentTable('A');if(!a)throw Error('请先选择数据表');
    return {a};
  }
  function runMatch(){
    return runMulti('match');
  }
  function runCompare(){
    return runMulti('compare');
  }
  function runMulti(mode){
    const baseSource=sourceById($('sourceA').value);
    const base=baseSource?{...baseSource,keys:state.baseKeys,selected:state.baseSelected||[]}:null;
    const joins=state.joins.map(join=>{
      const source=sourceById(join.sourceId);
      return {id:source?.id||'',table:source?.table||null,keys:join.keys,selected:join.selected||[],overwrites:(join.overwrites||[]).filter(o=>Number.isInteger(o.from)&&Number.isInteger(o.to))};
    });
    const result=MimiTableMerge.merge({mode,base,joins,loose:$('fuzzyMatch').checked,compareChanges:$('compareChanges').checked});
    result.sourceIds=[base.id,...joins.map(source=>source.id)];
    result.layout=MimiTableWorkbook.buildLayout(result,result.sourceIds.map(sourceById));
    return result;
  }
  function normalizeCell(value,spaces,punctuation){
    if(typeof value!=='string')return value;
    let result=spaces?value.replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[\t\u00A0 ]+/g,' ').trim():value;
    if(punctuation)result=result.normalize('NFKC').replace(/,/g,'，').replace(/:/g,'：');
    return result;
  }
  function runClean(){
    const {a}=requireTables(),settings={spaces:$('cleanSpaces').checked,blankRows:$('cleanBlankRows').checked,blankCols:$('cleanBlankCols').checked,duplicates:$('cleanDuplicates').checked,punctuation:$('cleanPunctuation').checked};
    const source=sourceById($('sourceA').value),records=a.rows.map((row,index)=>({row:row.slice(),index}));
    let kept=records,columns=a.headers.map((_,index)=>index);
    if(settings.spaces||settings.punctuation)kept=kept.map(record=>({...record,row:record.row.map(value=>normalizeCell(value,settings.spaces,settings.punctuation))}));
    if(settings.blankRows)kept=kept.filter(record=>record.row.some(value=>!isBlank(value)));
    if(settings.duplicates){const keyValue=$('dedupeKey').value,keyIndex=keyValue==='*'?-1:+keyValue,seen=new Set();kept=kept.filter(({row})=>{const key=keyIndex<0?row.map(value=>normalizeKey(value)).join('\u001f'):normalizeKey(row[keyIndex]);if(keyIndex>=0&&!key)return true;if(seen.has(key))return false;seen.add(key);return true})}
    if(settings.blankCols)columns=columns.filter(index=>kept.some(record=>!isBlank(record.row[index])));
    const result={headers:columns.map(index=>a.headers[index]),rows:kept.map(record=>columns.map(index=>record.row[index])),columns:columns.map(index=>({sourceId:source.id,index})),provenance:kept.map(record=>({[source.id]:record.index})),sourceIds:[source.id],fileName:'整理后的表格.xlsx'};
    result.layout=MimiTableWorkbook.buildLayout(result,[source]);return result;
  }
  function numeric(value){
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    const text=cleanText(value).normalize('NFKC').replace(/,/g,'');if(!text||!/^[-+]?\d+(?:\.\d+)?$/.test(text))return null;const number=Number(text);return Number.isFinite(number)?number:null;
  }
  function scoreColumns(table,nameIndex){
    if($('scoreColumn').value!=='*')return [+$('scoreColumn').value];
    return table.headers.map((header,index)=>({header,index,values:table.rows.map(row=>numeric(row[index])).filter(value=>value!==null)})).filter(item=>{
      if(item.index===nameIndex||/学号|编号|序号|考号|身份证|电话|手机|id/i.test(item.header))return false;
      const namedScore=/语文|数学|英语|科学|道法|体育|音乐|美术|成绩|分数|score/i.test(item.header);
      const plausible=item.values.length>=Math.max(2,Math.ceil(table.rows.length*.5))&&item.values.every(value=>value>=0&&value<=150);
      return namedScore||plausible;
    }).map(item=>item.index);
  }
  function round(value,digits=1){const multiple=10**digits;return Math.round((value+Number.EPSILON)*multiple)/multiple}
  function runGrade(){
    const {a}=requireTables(),nameIndex=+$('studentColumn').value,columns=scoreColumns(a,nameIndex),pass=Number($('passLine').value),excellent=Number($('excellentLine').value);
    if(!columns.length)throw Error('没有识别到成绩列，请手动选择一列');if(!Number.isFinite(pass)||!Number.isFinite(excellent)||excellent<pass)throw Error('优秀线应大于或等于及格线');
    const students=a.rows.map((row,rowIndex)=>{const values=columns.map(index=>numeric(row[index])),valid=values.filter(value=>value!==null),total=valid.reduce((sum,value)=>sum+value,0),average=valid.length?total/valid.length:null;return {row,name:cleanText(row[nameIndex])||`第${rowIndex+2}行`,values,total,average}});
    const ranked=students.filter(item=>item.average!==null).sort((x,y)=>y.average-x.average);let last=null,rank=0;ranked.forEach((item,index)=>{if(item.average!==last)rank=index+1;item.rank=rank;last=item.average});
    const headers=[...a.headers,...(columns.length>1?['总分']:[]),'平均分','名次'];
    const rows=students.map(item=>[...item.row,...(columns.length>1?[item.average===null?'':round(item.total,2)]:[]),item.average===null?'':round(item.average,2),item.rank||'']);
    const summaries=columns.map((column,index)=>{const values=students.map(item=>item.values[index]).filter(value=>value!==null);return {name:a.headers[column],average:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0,max:values.length?Math.max(...values):0,min:values.length?Math.min(...values):0,pass:values.filter(value=>value>=pass).length,excellent:values.filter(value=>value>=excellent).length,count:values.length}});
    const source=sourceById($('sourceA').value),result={headers,rows,columns:[...a.headers.map((_,index)=>({sourceId:source.id,index})),...(columns.length>1?[{kind:'total'}]:[]),{kind:'average'},{kind:'rank'}],provenance:students.map((_,index)=>({[source.id]:index})),sourceIds:[source.id],fileName:'成绩分析结果.xlsx',chartData:{students:ranked,summaries,pass,excellent}};
    result.layout=MimiTableWorkbook.buildLayout(result,[source]);return result;
  }
  function resultLayoutStyles(){return state.result?.layout?.headerStyles||null}
  function excelStyleToCss(style={}){
    const css={};
    if(style.font?.color?.argb){const a=String(style.font.color.argb);if(a.length===8)css.color=`#${a.slice(2)}`}
    if(style.fill?.fgColor?.argb){const a=String(style.fill.fgColor.argb);if(a.length===8&&!/^FF0{6}$/.test(a)&&!/^FFFFFFFF$/.test(a))css.backgroundColor=`#${a.slice(2)}`}
    if(style.alignment?.horizontal==='center')css.textAlign='center';
    if(style.alignment?.horizontal==='right')css.textAlign='right';
    if(style.font?.bold)css.fontWeight='800';
    return css;
  }
  function renderTable(headers,rows,headerRows=null,headerMerges=[],tableObj=null,options={}){
    preview.render({headers,rows,headerRows,headerMerges:headerMerges||[],headerStyles:tableObj?.headerStyles||resultLayoutStyles(),title:tableObj?.title,...options});
  }
  function resultQuality(result){
    if(state.mode==='match'){
      const statusCount=state.joins.length,groups={matched:0,unmatched:0,review:0};
      result.rows.forEach(row=>{
        const statuses=row.slice(-statusCount);
        if(statuses.some(value=>value!=='已匹配'&&value!=='未匹配'))groups.review++;
        else if(statuses.some(value=>value==='未匹配'))groups.unmatched++;
        else groups.matched++;
      });
      return {text:`完整匹配 ${groups.matched} · 未匹配 ${groups.unmatched} · 冲突或空键 ${groups.review}`,needsReview:row=>row.slice(-statusCount).some(value=>value!=='已匹配')};
    }
    if(state.mode==='compare'){
      const index=result.columns.findIndex(column=>column.kind==='compare'),counts=new Map();
      result.rows.forEach(row=>counts.set(row[index],(counts.get(row[index])||0)+1));
      return {text:[['一致','一致'],['记录缺失','缺失'],['内容变化','变化'],['重复冲突','重复'],['匹配键为空','空键']].filter(([key])=>counts.has(key)).map(([key,label])=>`${label} ${counts.get(key)}`).join(' · '),needsReview:row=>row[index]!=='一致'};
    }
    return null;
  }
  function chart(el,option){const instance=echarts.getInstanceByDom(el)||echarts.init(el,null,{renderer:'canvas'});instance.setOption(option,true);return instance}
  function renderCharts(data){
    const palette=['#ff785d','#ffc94f','#68bde8','#32a889','#8c7bd5'],textStyle={fontFamily:'YouYuan, Yuanti SC, Microsoft YaHei, sans-serif',color:'#304354'};
    const averages=data.students.map(item=>item.average),distribution=[averages.filter(value=>value<data.pass).length,averages.filter(value=>value>=data.pass&&value<data.excellent).length,averages.filter(value=>value>=data.excellent).length];
    const common={animationDuration:550,color:palette,textStyle,grid:{left:48,right:22,top:54,bottom:42},tooltip:{trigger:'axis',confine:true},title:{left:16,top:12,textStyle:{...textStyle,fontSize:15,fontWeight:900}}};
    const c1=chart($('distributionChart'),{...common,title:{...common.title,text:'成绩分布'},xAxis:{type:'category',data:[`未达${data.pass}分`,`${data.pass}–${data.excellent-1}分`,`${data.excellent}分及以上`],axisLabel:{color:'#5e7180'}},yAxis:{type:'value',minInterval:1,axisLabel:{color:'#5e7180'}},series:[{type:'bar',data:distribution,barMaxWidth:52,itemStyle:{color:params=>palette[params.dataIndex],borderRadius:[8,8,0,0]},label:{show:true,position:'top'}}]});
    const c2=chart($('summaryChart'),{...common,title:{...common.title,text:'各科平均分'},xAxis:{type:'category',data:data.summaries.map(item=>item.name),axisLabel:{color:'#5e7180',interval:0,rotate:data.summaries.length>5?25:0}},yAxis:{type:'value',axisLabel:{color:'#5e7180'}},series:[{type:'bar',data:data.summaries.map(item=>round(item.average)),barMaxWidth:42,itemStyle:{color:'#68bde8',borderRadius:[8,8,0,0]},markLine:{silent:true,data:[{yAxis:data.pass,name:'及格线'}]},label:{show:true,position:'top'}}]});
    const top=data.students.slice(0,20).reverse(),c3=chart($('rankingChart'),{...common,title:{...common.title,text:`学生平均分排名${data.students.length>20?'（前20名）':''}`},grid:{left:88,right:30,top:54,bottom:30},xAxis:{type:'value',axisLabel:{color:'#5e7180'}},yAxis:{type:'category',data:top.map(item=>item.name),axisLabel:{color:'#5e7180'}},series:[{type:'bar',data:top.map(item=>round(item.average)),barMaxWidth:22,itemStyle:{color:'#32a889',borderRadius:[0,8,8,0]},label:{show:true,position:'right'}}]});
    state.charts=[c1,c2,c3];
  }
  function showResult(){
      const result=state.result;if(!result)return;
      $('previewSource').value='';updatePreviewSourceTitle();$('viewResult').hidden=true;
      $('previewTitle').textContent=MODE_META[state.mode].title;
      const quality=resultQuality(result);
      renderTable(result.headers,result.rows,result.layout?.headerRows,result.layout?.headerMerges,{headerStyles:result.layout?.headerStyles,title:result.preamble?.[0]?.find(v=>v)||state.sources[0]?.table.title},{key:result,isResult:true,predicate:state.issuesOnly?quality?.needsReview:null});$('exportResult').disabled=false;$('saveResult').disabled=false;$('resultActions').hidden=false;
      $('resultQuality').textContent=quality?.text||'';$('resultQuality').hidden=!quality;
      $('filterIssues').hidden=!quality;$('filterIssues').textContent=state.issuesOnly?'查看全部':'只看待检查';$('filterIssues').setAttribute('aria-pressed',String(state.issuesOnly));
      const details=[result.summary,result.note].filter(Boolean).join('；');$('resultDetails').hidden=!details;$('resultDetails').open=false;$('resultSummary').textContent=details;
      $('centerTabs').hidden=!result.chartData;
      if(result.chartData){$('chartTab').hidden=false;showView('chart');renderCharts(result.chartData)}else{$('chartTab').hidden=true;showView('table')}
  }
  function run(){
    try{
      const result=state.mode==='match'?runMatch():state.mode==='compare'?runCompare():state.mode==='clean'?runClean():runGrade();state.result=result;state.issuesOnly=false;
      showResult();
      toast('处理完成，请检查预览');if(matchMedia('(max-width:760px)').matches)workspaceController.setMobilePanel('preview');
    }catch(error){toast(error.message)}
  }
  function resetResult(){preview.reset();state.result=null;state.issuesOnly=false;state.charts.forEach(item=>item.dispose());state.charts=[];$('dataTable').hidden=true;$('dataTable').tHead.replaceChildren();$('dataTable').tBodies[0].replaceChildren();$('tableEmpty').hidden=false;$('exportResult').disabled=true;$('saveResult').disabled=true;$('resultActions').hidden=true;$('viewResult').hidden=true;$('centerTabs').hidden=true;$('chartTab').hidden=true;$('previewTitle').textContent='表格预览';showView('table');$('centerStatus').textContent='请添加数据'}
  function clearAll(){state.sources=[];state.nextId=1;state.baseSourceId='';state.baseKeys=[];state.baseSelected=null;state.joins=[];state.nextJoinId=1;state.joinAutoInitialized=false;renderSources();syncColumnControls();renderBuilder();resetResult();toast('已清空，原始文件没有被修改')}
  function setSynthetic(name,headers,rows){return addSource(name,MimiTableWorkbook.fromRows([headers,...rows],{format:'manual'}))}
  function saveResult(){
    if(!state.result)return;
    const sources=state.result.sourceIds?.map(sourceById).filter(Boolean)||[];
    const format=sources.some(item=>['xls','xlsx'].includes(item.table.format))?'xlsx':sources[0]?.table.format||'manual';
    const table=state.result.layout?MimiTableWorkbook.resultAsTable(state.result,state.result.layout,format):MimiTableWorkbook.fromRows([state.result.headers,...state.result.rows],{format:'manual'});
    const source=addSource(`${MODE_META[state.mode].title}`,table);
    renderSources();$('viewResult').hidden=true;toast(`已添加「${source.name}」，可选择它继续处理`);
  }
  function loadSample(){
    clearAll();
    if(state.mode==='match'){
      setSynthetic('语文成绩.xlsx',['学号','姓名','语文'],[['50101','张小雨',93],['50102','王一鸣',76],['50103','李可心',98],['50104','陈小满',59]]);
      setSynthetic('数学成绩.xlsx',['学号','姓名','数学'],[['50101','张小雨',88],['50102','王一鸣',82],['50103','李可心',96],['50104','陈小满',67]]);
      setSynthetic('英语成绩.xlsx',['学号','姓名','英语'],[['50101','张小雨',91],['50102','王一鸣',79],['50103','李可心',95],['50104','陈小满',63]]);
    }else if(state.mode==='compare'){
      setSynthetic('原班名单.xlsx',['学号','姓名','班级'],[['50101','张小雨','五年级一班'],['50102','王一鸣','五年级一班'],['50103','李可心','五年级一班']]);
      setSynthetic('本学期名单.xlsx',['学号','姓名','班级'],[['50101','张小雨','五年级一班'],['50102','王一鸣','五年级二班'],['50104','陈小满','五年级一班']]);
      setSynthetic('报名名单.xlsx',['学号','姓名','报名状态'],[['50101','张小雨','已报名'],['50103','李可心','已报名'],['50104','陈小满','已报名']]);
    }else if(state.mode==='clean'){
      setSynthetic('待整理名单.xlsx',['学号','姓名','联系电话','备注','空列'],[[' 50101 ',' 张小雨 ','138 0000 0001',' 已确认 ',''],['50102','王一鸣','13800000002','未确认',''],['50102','王一鸣','13800000002','未确认',''],['','','','','']]);
    }else{
      setSynthetic('五年级一班成绩.xlsx',['学号','姓名','语文','数学','英语'],[['50101','张小雨',93,88,91],['50102','王一鸣',76,82,79],['50103','李可心',98,96,95],['50104','陈小满',59,67,63],['50105','周小树',86,91,84],['50106','林星河',72,58,69],['50107','赵可乐',90,94,88],['50108','吴一朵',65,73,70]]);
    }
    renderSources();sourcesChanged();
    if(state.mode==='match'||state.mode==='compare')while(state.joins.length<state.sources.length-1){const unused=state.sources.find(source=>source.id!==$('sourceA').value&&!state.joins.some(join=>join.sourceId===source.id));state.joins.push(makeJoin(unused?.id||''))}
    renderBuilder();renderSource(currentTable('A'),'示例数据已准备');toast('示例数据已载入，可以直接开始处理');
  }
  async function exportResult(){
    if(!state.result)return;
    try{
      $('exportResult').disabled=true;
      const result=state.result,sources=result.sourceIds?.map(sourceById).filter(Boolean)||[];if(!result.preamble)result.preamble=sources[0]?.table.preamble||[];
      const baseFormat=sources[0]?.table.format||'xlsx',hasExcel=sources.some(source=>['xls','xlsx'].includes(source.table.format));
      const format=result.layout&&!hasExcel&&['csv','tsv','txt'].includes(baseFormat)?baseFormat:'xlsx';
      const blob=format==='xlsx'?(result.layout?await MimiTableWorkbook.toXlsx(result,sources,result.layout):D.xlsx([result.headers,...result.rows],MODE_META[state.mode].title)):MimiTableWorkbook.toDelimited(result,format);
      const name=result.fileName.replace(/\.xlsx$/i,`.${format}`);MimiCommon.download(blob,name);toast(`已导出 ${format.toUpperCase()} 结果`);
    }catch(error){toast(`导出失败：${error.message}`)}finally{$('exportResult').disabled=false}
  }

  document.querySelectorAll('.task-button').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
  $('openManual').onclick=()=>{$('manualError').hidden=true;$('manualDialog').showModal();$('manualName').focus()};
  $('openRules').onclick=()=>{$('rulesDialog').showModal();const first=state.mode==='match'||state.mode==='compare'?$('sourceA'):state.mode==='clean'?$('dedupeKey'):$('studentColumn');first.focus()};
  document.querySelectorAll('[data-close-dialog]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
  $('filesInput').onchange=handleFiles;
  $('uploadTrigger').onclick=()=>$('filesInput').click();
  $('previewImport').onclick=()=>$('filesInput').click();$('previewManual').onclick=()=>$('openManual').click();
  $('sourceA').onchange=sourcesChanged;
  $('previewSource').onchange=()=>{const source=sourceById($('previewSource').value);if(source)renderSource(source.table,source.name,{preserveResult:true});else if(state.result)showResult()};
  $('viewResult').onclick=showResult;
  $('filterIssues').onclick=()=>{state.issuesOnly=!state.issuesOnly;showResult()};
  $('addKey').onclick=()=>{const base=currentTable('A');if(!base){toast('请先选择主表');return}const unused=base.headers.findIndex((_,i)=>!state.baseKeys.includes(i));state.baseKeys.push(unused);state.joins.forEach(join=>join.keys.push(suggestedKey(sourceById(join.sourceId)?.table,unused)));renderBuilder();renderSource(base,'匹配条件已更新')};
  $('addJoin').onclick=()=>{const unused=state.sources.find(source=>source.id!==$('sourceA').value&&!state.joins.some(join=>join.sourceId===source.id));state.joins.push(makeJoin(unused?.id||''));state.joinAutoInitialized=true;renderBuilder();const base=currentTable('A');if(base)renderSource(base,'参与表已更新')};
  $('addManual').onclick=addManual;$('saveResult').onclick=saveResult;
  ['fuzzyMatch','compareChanges','dedupeKey','cleanSpaces','cleanBlankRows','cleanBlankCols','cleanDuplicates','cleanPunctuation','studentColumn','scoreColumn','passLine','excellentLine'].forEach(id=>$(id).addEventListener('change',()=>{refreshFlow();const table=currentTable('A');if(table)renderSource(table,'设置已更新')}));
  $('manualFormat').onchange=()=>{
    const table=$('manualFormat').value==='table';$('manualHeaderWrap').hidden=!table;
    $('manualText').placeholder=table?'姓名,性别,班级\n张小雨,女,一班\n王一鸣,男,一班':'张小雨\n王一鸣\n李可心';
    $('manualHint').textContent=table?'支持 Excel 粘贴 / CSV。':'每行一人。';
  };
  $('runTask').onclick=run;$('loadSample').onclick=loadSample;$('clearAll').onclick=()=>$('clearDialog').showModal();$('confirmClear').onclick=()=>{$('clearDialog').close();clearAll()};$('exportResult').onclick=exportResult;$('tableTab').onclick=()=>showView('table');$('chartTab').onclick=()=>showView('chart');
  const workspaceController=MimiWorkspace.mount({read:()=>state.ui,write:saveUi,toast,widths:{left:360},labels:{left:'任务设置栏'},onMobilePanel:panel=>{if(panel==='preview')state.charts.forEach(item=>item.resize())}});
  renderSources();addEventListener('resize',()=>state.charts.forEach(item=>item.resize()));setMode('match');
})();
