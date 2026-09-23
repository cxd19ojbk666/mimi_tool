/* 咪咪大王做表格：在本机完成匹配、对比、清洗和成绩可视化。 */
(function(){
  'use strict';
  if(document.body?.dataset.mimiTool!=='table-maker')return;
  MimiCommon.init({action:'做表格',subject:'表格'});
  const $=id=>document.getElementById(id),D=MimiCommon.roster,toast=MimiCommon.toast;
  const MODE_META={
    match:{button:'开始智能匹配',title:'匹配结果'},
    compare:{button:'开始名单对比',title:'对比结果'},
    clean:{button:'开始整理表格',title:'整理结果'},
    grade:{button:'生成成绩图表',title:'成绩分析'}
  };
  const state={mode:'match',files:{A:null,B:null},result:null,charts:[],ui:loadUi()};

  function loadUi(){try{return JSON.parse(localStorage.getItem('mimi-table-ui')||'{}')||{}}catch{return {}}}
  function saveUi(){try{localStorage.setItem('mimi-table-ui',JSON.stringify(state.ui))}catch{}}
  function cleanText(value){return String(value??'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim()}
  function normalizeKey(value,loose=true){let text=cleanText(value).normalize('NFKC');if(loose)text=text.replace(/\s+/g,'').toLocaleLowerCase('zh-CN');return text}
  function isBlank(value){return cleanText(value)===''}
  function uniqueHeaders(row){
    const counts=new Map();
    return row.map((value,index)=>{const base=cleanText(value)||`第${index+1}列`,count=(counts.get(base)||0)+1;counts.set(base,count);return count===1?base:`${base}_${count}`});
  }
  function tableFromRows(rawRows){
    const rows=rawRows.map(row=>Array.from(row,value=>value??''));
    while(rows.length&&rows[0].every(isBlank))rows.shift();
    if(!rows.length)throw Error('工作表没有可读取的数据');
    const headerIndex=Math.max(0,rows.slice(0,12).findIndex(row=>row.filter(value=>!isBlank(value)).length>=2));
    const headers=uniqueHeaders(rows[headerIndex]);
    const data=rows.slice(headerIndex+1).map(row=>headers.map((_,index)=>row[index]??''));
    if(!headers.length)throw Error('没有找到表头');
    return {headers,rows:data,headerIndex};
  }
  function currentTable(slot){
    const file=state.files[slot];if(!file)return null;
    const select=$(slot==='A'?'sheetA':'sheetB'),index=Math.max(0,+select.value||0);
    return tableFromRows(file.sheets[index].rows);
  }
  function displayValue(value){return value===null||value===undefined?'':String(value)}
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
      const workbook=await D.readWorkbook(file);
      return {name:file.name,sheets:workbook.map(sheet=>({name:sheet.name,rows:sheet.rows()}))};
    }
    if(!['csv','tsv','txt'].includes(ext))throw Error('请选择 .xlsx、.csv、.tsv 或 .txt 文件');
    const text=decodeText(await file.arrayBuffer()),rows=D.parseText(text);
    return {name:file.name,sheets:[{name:'数据',rows}]};
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
    const a=currentTable('A'),b=currentTable('B');
    if(a){
      ['matchKeyA','compareKeyA','dedupeKey','studentColumn','scoreColumn'].forEach(id=>{
        const first=id==='dedupeKey'?{firstLabel:'整行完全相同',firstValue:'*'}:id==='scoreColumn'?{firstLabel:'自动识别全部成绩列',firstValue:'*'}:{};
        fillSelect($(id),a.headers,first);
      });
      const key=suggestedColumn(a.headers,[/学号|编号|id/i,/姓名|名字|name/i]);
      $('matchKeyA').value=String(key);$('compareKeyA').value=String(key);$('studentColumn').value=String(suggestedColumn(a.headers,[/姓名|名字|name/i]));
    }
    if(b){
      fillSelect($('matchKeyB'),b.headers);fillSelect($('compareKeyB'),b.headers);
      const key=suggestedColumn(b.headers,[/学号|编号|id/i,/姓名|名字|name/i]);$('matchKeyB').value=String(key);$('compareKeyB').value=String(key);
      const items=[option('*','全部非匹配列'),...b.headers.map((header,index)=>option(index,header))];$('appendColumn').replaceChildren(...items);
    }
  }
  function renderFile(slot){
    const file=state.files[slot],suffix=slot==='A'?'A':'B',card=$(`fileCard${suffix}`),name=$(`fileName${suffix}`),meta=$(`fileMeta${suffix}`),sheet=$(`sheet${suffix}`),wrap=$(`sheetWrap${suffix}`);
    card.classList.toggle('loaded',!!file);
    if(!file){name.textContent=slot==='A'?'主表':'补充表';meta.textContent=slot==='A'?'支持 .xlsx、.csv、.tsv':'智能匹配和名单对比时需要';wrap.hidden=true;return}
    name.textContent=file.name;meta.textContent=`${file.sheets.length} 个工作表`;
    sheet.replaceChildren(...file.sheets.map((item,index)=>option(index,item.name)));wrap.hidden=file.sheets.length<2;
  }
  function renderSource(table,label){
    state.result=null;$('exportResult').disabled=true;$('report').hidden=true;$('reportEmpty').hidden=false;$('resultCount').textContent=`${table.rows.length} 行`;
    renderTable(table.headers,table.rows);$('centerStatus').textContent=`${label}：${table.rows.length} 行，${table.headers.length} 列。请选择任务设置后开始处理。`;
  }
  async function handleFile(slot,event){
    const file=event.target.files[0];if(!file)return;
    try{
      state.files[slot]=await readFile(file);renderFile(slot);syncColumnControls();
      const table=currentTable(slot);renderSource(table,slot==='A'?'主表已读取':'补充表已读取');toast(`已读取 ${file.name}`);
    }catch(error){toast(`导入失败：${error.message}`)}finally{event.target.value=''}
  }

  function setMode(mode){
    state.mode=mode;document.querySelectorAll('.task-button').forEach(button=>{const active=button.dataset.mode===mode;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))});
    document.querySelectorAll('[data-controls]').forEach(group=>group.hidden=group.dataset.controls!==mode);
    const needsB=mode==='match'||mode==='compare';$('fileCardB').hidden=!needsB;$('sheetWrapB').hidden=!needsB||!state.files.B||state.files.B.sheets.length<2;
    $('runTask').textContent=MODE_META[mode].button;$('previewTitle').textContent=MODE_META[mode].title;
    $('chartTab').hidden=mode!=='grade';showView('table');
    if(state.files.A)renderSource(currentTable('A'),'主表预览');
  }
  function showView(view){
    const chart=view==='chart'&&state.mode==='grade';$('tableStage').hidden=chart;$('chartStage').hidden=!chart;$('tableTab').classList.toggle('active',!chart);$('chartTab').classList.toggle('active',chart);
    if(chart){state.charts.forEach(item=>item.resize());requestAnimationFrame(()=>state.charts.forEach(item=>item.resize()))}
  }
  function requireTables(needsB){
    const a=currentTable('A');if(!a)throw Error('请先选择主表');
    const b=needsB?currentTable('B'):null;if(needsB&&!b)throw Error('这个任务还需要选择补充表');
    return {a,b};
  }
  function indexRows(table,keyIndex,loose=true){
    const map=new Map(),blank=[];
    table.rows.forEach((row,rowIndex)=>{const key=normalizeKey(row[keyIndex],loose);if(!key){blank.push(rowIndex);return}if(!map.has(key))map.set(key,[]);map.get(key).push({row,rowIndex})});
    return {map,blank,duplicates:[...map].filter(([,items])=>items.length>1)};
  }
  function safeHeader(existing,name,prefix='补充表'){
    let result=name;if(existing.includes(result))result=`${prefix}·${name}`;let n=2,base=result;while(existing.includes(result))result=`${base}_${n++}`;existing.push(result);return result;
  }
  function runMatch(){
    const {a,b}=requireTables(true),keyA=+$('matchKeyA').value,keyB=+$('matchKeyB').value,loose=$('fuzzyMatch').checked,index=indexRows(b,keyB,loose),primary=indexRows(a,keyA,loose);
    const selected=$('appendColumn').value==='*'?b.headers.map((_,i)=>i).filter(i=>i!==keyB):[+$('appendColumn').value];
    const headers=[...a.headers];selected.forEach(i=>safeHeader(headers,b.headers[i]));headers.push('匹配状态');
    let matched=0,missing=0,ambiguous=0;
    const rows=a.rows.map(row=>{const key=normalizeKey(row[keyA],loose),matches=key?index.map.get(key)||[]:[];let status,values;
      if(!key){status='主表匹配值为空';values=selected.map(()=> '');missing++}
      else if(!matches.length){status='未匹配';values=selected.map(()=> '');missing++}
      else if(matches.length>1){status='补充表存在重复';values=selected.map(()=> '');ambiguous++}
      else{status='已匹配';values=selected.map(i=>matches[0].row[i]);matched++}
      return [...row,...values,status];
    });
    const issues=[];
    if(index.duplicates.length)issues.push({type:'bad',text:`补充表有 ${index.duplicates.length} 个重复匹配值，相关记录没有自动填入。`});
    if(primary.duplicates.length)issues.push({type:'warn',text:`主表有 ${primary.duplicates.length} 个重复匹配值，已逐行保留。`});
    if(index.blank.length)issues.push({type:'warn',text:`补充表有 ${index.blank.length} 行匹配值为空。`});
    if(!issues.length)issues.push({type:'good',text:'匹配列没有发现重复或空值。'});
    return {headers,rows,metrics:[['已匹配',matched],['未匹配',missing],['重复冲突',ambiguous],['主表总行数',a.rows.length]],issues,fileName:'智能匹配结果.xlsx'};
  }
  function rowSummary(headers,row){return headers.map((header,index)=>`${header}：${displayValue(row[index])}`).join('；')}
  function runCompare(){
    const {a,b}=requireTables(true),keyA=+$('compareKeyA').value,keyB=+$('compareKeyB').value,aIndex=indexRows(a,keyA),bIndex=indexRows(b,keyB),keys=new Set([...aIndex.map.keys(),...bIndex.map.keys()]);
    const common=a.headers.map((header,index)=>({header,a:index,b:b.headers.indexOf(header)})).filter(item=>item.a!==keyA&&item.b>=0&&item.b!==keyB);
    const headers=['对比值','状态','变化字段','主表记录','补充表记录'];let same=0,changed=0,removed=0,added=0,conflicts=0;
    const rows=[];
    keys.forEach(key=>{const aa=aIndex.map.get(key)||[],bb=bIndex.map.get(key)||[];let status,changes=[];
      if(aa.length>1||bb.length>1){status='重复值待检查';conflicts++}
      else if(!bb.length){status='补充表缺少';removed++}
      else if(!aa.length){status='补充表新增';added++}
      else{
        if($('compareChanges').checked)changes=common.filter(item=>normalizeKey(aa[0].row[item.a],false)!==normalizeKey(bb[0].row[item.b],false)).map(item=>item.header);
        if(changes.length){status='内容变化';changed++}else{status='两表一致';same++}
      }
      rows.push([displayValue(aa[0]?.row[keyA]??bb[0]?.row[keyB]??key),status,changes.join('、'),aa[0]?rowSummary(a.headers,aa[0].row):'',bb[0]?rowSummary(b.headers,bb[0].row):'']);
    });
    const issues=[];
    if(conflicts)issues.push({type:'bad',text:`有 ${conflicts} 个对比值在至少一张表中重复，无法判断对应关系。`});
    if(aIndex.blank.length||bIndex.blank.length)issues.push({type:'warn',text:`两张表共有 ${aIndex.blank.length+bIndex.blank.length} 行对比值为空，未参与对比。`});
    if(!issues.length)issues.push({type:'good',text:'对比列没有发现重复值或空值。'});
    return {headers,rows,metrics:[['两表一致',same],['内容变化',changed],['补充表新增',added],['补充表缺少',removed]],issues,fileName:'名单对比结果.xlsx'};
  }
  function normalizeCell(value,spaces,punctuation){
    if(typeof value!=='string')return value;
    let result=spaces?value.replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/[\t\u00A0 ]+/g,' ').trim():value;
    if(punctuation)result=result.normalize('NFKC').replace(/,/g,'，').replace(/:/g,'：');
    return result;
  }
  function runClean(){
    const {a}=requireTables(false),settings={spaces:$('cleanSpaces').checked,blankRows:$('cleanBlankRows').checked,blankCols:$('cleanBlankCols').checked,duplicates:$('cleanDuplicates').checked,punctuation:$('cleanPunctuation').checked};
    let rows=a.rows.map(row=>row.slice()),headers=a.headers.slice(),changedCells=0,blankRows=0,blankCols=0,duplicates=0;
    if(settings.spaces||settings.punctuation)rows=rows.map(row=>row.map(value=>{const next=normalizeCell(value,settings.spaces,settings.punctuation);if(next!==value)changedCells++;return next}));
    if(settings.blankRows){const before=rows.length;rows=rows.filter(row=>row.some(value=>!isBlank(value)));blankRows=before-rows.length}
    if(settings.duplicates){const keyValue=$('dedupeKey').value,keyIndex=keyValue==='*'?-1:+keyValue,seen=new Set();rows=rows.filter(row=>{const key=keyIndex<0?row.map(value=>normalizeKey(value)).join('\u001f'):normalizeKey(row[keyIndex]);if(keyIndex>=0&&!key)return true;if(seen.has(key)){duplicates++;return false}seen.add(key);return true})}
    if(settings.blankCols){const keep=headers.map((_,index)=>rows.some(row=>!isBlank(row[index])));blankCols=keep.filter(value=>!value).length;headers=headers.filter((_,index)=>keep[index]);rows=rows.map(row=>row.filter((_,index)=>keep[index]))}
    const issues=[];if(!changedCells&&!blankRows&&!blankCols&&!duplicates)issues.push({type:'good',text:'没有发现符合当前规则的脏数据。'});else issues.push({type:'good',text:'原表没有被覆盖，可以先检查结果再导出。'});
    if(settings.duplicates&&$('dedupeKey').value!=='*')issues.push({type:'warn',text:'重复记录按所选列判断，并保留第一次出现的记录。'});
    return {headers,rows,metrics:[['整理后行数',rows.length],['修正单元格',changedCells],['删除空行',blankRows],['删除重复',duplicates]],issues:[...issues,...(blankCols?[{type:'warn',text:`已删除 ${blankCols} 个整列为空的列。`}]:[])],fileName:'整理后的表格.xlsx'};
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
    const {a}=requireTables(false),nameIndex=+$('studentColumn').value,columns=scoreColumns(a,nameIndex),pass=Number($('passLine').value),excellent=Number($('excellentLine').value);
    if(!columns.length)throw Error('没有识别到成绩列，请手动选择一列');if(!Number.isFinite(pass)||!Number.isFinite(excellent)||excellent<pass)throw Error('优秀线应大于或等于及格线');
    let invalid=0;const students=a.rows.map((row,rowIndex)=>{const values=columns.map(index=>numeric(row[index]));invalid+=values.filter((value,index)=>value===null&&!isBlank(row[columns[index]])).length;const valid=values.filter(value=>value!==null),total=valid.reduce((sum,value)=>sum+value,0),average=valid.length?total/valid.length:null;return {row,rowIndex,name:cleanText(row[nameIndex])||`第${rowIndex+2}行`,values,total,average}});
    const ranked=students.filter(item=>item.average!==null).sort((x,y)=>y.average-x.average);let last=null,rank=0;ranked.forEach((item,index)=>{if(item.average!==last)rank=index+1;item.rank=rank;last=item.average});
    const headers=[...a.headers,...(columns.length>1?['总分']:[]),'平均分','名次'];
    const rows=students.map(item=>[...item.row,...(columns.length>1?[item.average===null?'':round(item.total,2)]:[]),item.average===null?'':round(item.average,2),item.rank||'']);
    const summaries=columns.map((column,index)=>{const values=students.map(item=>item.values[index]).filter(value=>value!==null);return {name:a.headers[column],average:values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0,max:values.length?Math.max(...values):0,min:values.length?Math.min(...values):0,pass:values.filter(value=>value>=pass).length,excellent:values.filter(value=>value>=excellent).length,count:values.length}});
    const averages=students.map(item=>item.average).filter(value=>value!==null),passed=averages.filter(value=>value>=pass).length,excellentCount=averages.filter(value=>value>=excellent).length;
    const issues=[];if(invalid)issues.push({type:'bad',text:`发现 ${invalid} 个非空但无法识别为数字的成绩单元格，计算时已跳过。`});if(students.some(item=>item.average===null))issues.push({type:'warn',text:'部分学生没有有效成绩，因此没有参与排名。'});if(!issues.length)issues.push({type:'good',text:'成绩列均可正常计算。'});
    return {headers,rows,metrics:[['参与统计',averages.length],['班级平均',averages.length?round(averages.reduce((sum,value)=>sum+value,0)/averages.length):'—'],['及格人数',passed],['优秀人数',excellentCount]],issues,fileName:'成绩分析结果.xlsx',chartData:{students:ranked,summaries,pass,excellent}};
  }
  function renderTable(headers,rows){
    $('tableEmpty').hidden=true;$('dataTable').hidden=false;const table=$('dataTable'),head=table.tHead,body=table.tBodies[0];head.replaceChildren();body.replaceChildren();
    const tr=document.createElement('tr');headers.forEach(header=>{const th=document.createElement('th');th.textContent=header;th.title=header;tr.append(th)});head.append(tr);
    rows.slice(0,500).forEach(row=>{const line=document.createElement('tr');headers.forEach((_,index)=>{const td=document.createElement('td'),value=displayValue(row[index]);td.textContent=value;td.title=value;line.append(td)});body.append(line)});
  }
  function renderReport(result){
    $('reportEmpty').hidden=true;$('report').hidden=false;$('metrics').replaceChildren(...result.metrics.map(([label,value])=>{const div=document.createElement('div');div.className='metric';const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;div.append(strong,span);return div}));
    $('issues').replaceChildren(...result.issues.map(issue=>{const div=document.createElement('div');div.className=`issue ${issue.type==='bad'?'bad':issue.type==='good'?'good':''}`;div.textContent=issue.text;return div}));
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
  function run(){
    try{
      const result=state.mode==='match'?runMatch():state.mode==='compare'?runCompare():state.mode==='clean'?runClean():runGrade();state.result=result;
      renderTable(result.headers,result.rows);renderReport(result);$('resultCount').textContent=`${result.rows.length} 行`;$('exportResult').disabled=false;
      $('centerStatus').textContent=`处理完成：共 ${result.rows.length} 行，${result.headers.length} 列${result.rows.length>500?'；预览显示前 500 行':''}。`;
      if(result.chartData){$('chartTab').hidden=false;showView('chart');renderCharts(result.chartData)}else{$('chartTab').hidden=true;showView('table')}
      toast('处理完成，请检查预览和处理报告');if(matchMedia('(max-width:760px)').matches)workspaceController.setMobilePanel('preview');
    }catch(error){toast(error.message)}
  }
  function resetResult(){state.result=null;state.charts.forEach(item=>item.dispose());state.charts=[];$('dataTable').hidden=true;$('dataTable').tHead.replaceChildren();$('dataTable').tBodies[0].replaceChildren();$('tableEmpty').hidden=false;$('report').hidden=true;$('reportEmpty').hidden=false;$('resultCount').textContent='0 行';$('exportResult').disabled=true;$('chartTab').hidden=true;showView('table');$('centerStatus').textContent='等待导入表格'}
  function clearAll(){state.files={A:null,B:null};renderFile('A');renderFile('B');resetResult();toast('已清空，原始文件没有被修改')}
  function setSynthetic(slot,name,headers,rows){state.files[slot]={name,sheets:[{name:'数据',rows:[headers,...rows]}]};renderFile(slot)}
  function loadSample(){
    clearAll();
    if(state.mode==='match'||state.mode==='compare'){
      setSynthetic('A','五年级一班花名册.xlsx',['学号','姓名','班级'],[['50101','张小雨','五年级一班'],['50102','王一鸣','五年级一班'],['50103','李可心','五年级一班'],['50104','陈小满','五年级一班']]);
      setSynthetic('B','活动报名表.xlsx',['学号','姓名','联系电话','报名状态'],[['50101','张小雨','13800000001','已报名'],['50102','王一鸣','13800000002','已报名'],['50102','王一鸣','13800000009','重复提交'],['50105','周小树','13800000005','已报名']]);
    }else if(state.mode==='clean'){
      setSynthetic('A','待整理名单.xlsx',['学号','姓名','联系电话','备注','空列'],[[' 50101 ',' 张小雨 ','138 0000 0001',' 已确认 ',''],['50102','王一鸣','13800000002','未确认',''],['50102','王一鸣','13800000002','未确认',''],['','','','','']]);
    }else{
      setSynthetic('A','五年级一班成绩.xlsx',['学号','姓名','语文','数学','英语'],[['50101','张小雨',93,88,91],['50102','王一鸣',76,82,79],['50103','李可心',98,96,95],['50104','陈小满',59,67,63],['50105','周小树',86,91,84],['50106','林星河',72,58,69],['50107','赵可乐',90,94,88],['50108','吴一朵',65,73,70]]);
    }
    syncColumnControls();renderSource(currentTable('A'),'示例数据已准备');toast('示例数据已载入，可以直接开始处理');
  }
  function exportResult(){if(!state.result)return;MimiCommon.download(D.xlsx([state.result.headers,...state.result.rows],MODE_META[state.mode].title),state.result.fileName);toast('Excel 已导出')}

  document.querySelectorAll('.task-button').forEach(button=>button.onclick=()=>setMode(button.dataset.mode));
  $('fileA').onchange=event=>handleFile('A',event);$('fileB').onchange=event=>handleFile('B',event);
  $('sheetA').onchange=()=>{syncColumnControls();renderSource(currentTable('A'),'主表预览')};$('sheetB').onchange=()=>{syncColumnControls();renderSource(currentTable('B'),'补充表预览')};
  $('runTask').onclick=run;$('loadSample').onclick=loadSample;$('clearAll').onclick=clearAll;$('exportResult').onclick=exportResult;$('tableTab').onclick=()=>showView('table');$('chartTab').onclick=()=>showView('chart');
  const workspaceController=MimiWorkspace.mount({read:()=>state.ui,write:saveUi,toast,labels:{left:'任务设置栏',right:'处理报告栏'},onMobilePanel:panel=>{if(panel==='preview')state.charts.forEach(item=>item.resize())}});
  addEventListener('resize',()=>state.charts.forEach(item=>item.resize()));setMode('match');
})();
