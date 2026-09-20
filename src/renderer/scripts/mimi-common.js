/* 咪咪工具共享：品牌文案、消息提示、文件下载与名单数据工具。 */
(function(global){
  'use strict';
  const text=Object.freeze({backup:'备份',restore:'恢复',clear:'清空',export:'导出',backupSaved:'备份已下载',backupRestored:'备份已恢复',restoreFailed:'恢复失败：备份文件无法读取'});
  let toastTimer;
  function toast(message){
    const element=document.getElementById('toast');
    element.textContent=message;
    element.hidden=false;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>{element.hidden=true},4000);
  }
  function download(blob,name){
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function backup(data){
    download(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`${document.title}-备份-${new Date().toISOString().slice(0,10)}.json`);
    toast(text.backupSaved);
  }
  function init({action,subject}){
    document.title=`咪咪大王${action}`;
    document.querySelector('.brand h1').textContent=document.title;
    document.querySelector('.brand p').textContent=`咪的汪给咪做的${subject}工具`;
    document.querySelectorAll('[data-mimi-action]').forEach(button=>{
      const key=button.dataset.mimiAction;
      button.textContent=text[key];
      if(button.tagName==='BUTTON')button.type='button';
      if(key==='clear')button.classList.add('danger');
    });
    const element=document.getElementById('toast');
    element.className='mimi-toast';element.hidden=true;
    element.setAttribute('role','status');element.setAttribute('aria-live','polite');
  }
  // 公共名单工具：文本与 Excel 解析、随机抽取及 CSV 导出。
  const roster=(()=>{
  const clean=value=>String(value??'').trim();
  function parseText(text){
    text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').trim();
    if(!text)return [];
    const delimiter=text.includes('\t')?'\t':text.includes(',')?',':text.includes('，')?'，':null;
    if(!delimiter)return text.split(/\n/).flatMap(line=>line.includes('、')?line.split('、').map(name=>[name]):[line.trim().split(/\s+/)]);
    const rows=[];let row=[],value='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++}else quoted=!quoted}
      else if(!quoted&&(c===delimiter||c==='\n')){row.push(value);value='';if(c==='\n'){rows.push(row);row=[]}}
      else value+=c;
    }
    if(quoted)throw Error('引号未闭合，请检查名单格式');
    row.push(value);rows.push(row);return rows;
  }
  function normalize(rows){
    rows=rows.map(row=>Array.from(row,clean)).filter(row=>row.some(Boolean));
    const isName=s=>/^(姓名|名字|学生姓名|name)$/i.test(s);
    const header=rows.findIndex(row=>row.some(isName));
    const names=header<0?0:rows[header].findIndex(isName);
    const genders=header<0?1:rows[header].findIndex(s=>/^(性别|gender|sex)$/i.test(s));
    const groups=header<0?2:rows[header].findIndex(s=>/^(小组|组别|组名|分组|group|team)$/i.test(s));
    const data=rows.slice(header<0?0:header+1);
    const students=[];let skipped=0,unknown=0;
    for(const row of data){
      const name=clean(row[names]);if(!name){skipped++;continue}
      if(name.length>80)throw Error('姓名超过 80 字，请检查分列格式');
      const raw=clean(row[genders]),gender=/^(男|男生|m|male)$/i.test(raw)?'男':/^(女|女生|f|female)$/i.test(raw)?'女':'';
      if(raw&&!gender)unknown++;
      const group=clean(row[groups]);if(group.length>80)throw Error('小组名称超过 80 字');
      students.push({id:global.crypto.randomUUID(),name,gender,group});
    }
    if(!students.length)throw Error('没有找到姓名，请检查名单或工作表');
    if(students.length>2000)throw Error('每份名单最多支持 2000 人');
    const counts=new Map();students.forEach(s=>counts.set(s.name,(counts.get(s.name)||0)+1));
    return {students,skipped,unknown,duplicates:[...counts].filter(([,n])=>n>1).map(([name])=>name)};
  }
  function calledIds(history){return new Set(history.flatMap(item=>item.ids))}
  function candidates(students,history,options){
    const called=calledIds(history);
    if(options.mode==='group'){
      const groups=new Map();
      students.filter(s=>s.group&&(options.group==='all'||s.group===options.group)).forEach(s=>{if(!groups.has(s.group))groups.set(s.group,[]);groups.get(s.group).push(s)});
      return [...groups].filter(([,members])=>!options.noRepeat||members.every(s=>!called.has(s.id))).map(([name,members])=>({name,members}));
    }
    return students.filter(s=>(options.gender==='all'||s.gender===options.gender)&&(options.group==='all'||s.group===options.group)&&(!options.noRepeat||!called.has(s.id))).map(s=>({name:s.name,members:[s]}));
  }
  function randomIndex(length){
    const values=new Uint32Array(1),limit=4294967296-4294967296%length;do{global.crypto.getRandomValues(values)}while(values[0]>=limit);return values[0]%length;
  }
  async function unzip(buffer){
    const bytes=new Uint8Array(buffer),view=new DataView(buffer),files={};let end=-1,total=0;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break}}
    if(end<0)throw Error('不是有效的 XLSX 文件，请从 Excel 另存为 .xlsx');
    const count=view.getUint16(end+10,true);if(count>3000)throw Error('工作簿内容过多，请仅保留名单工作表');
    let position=view.getUint32(end+16,true);
    for(let i=0;i<count;i++){
      if(position+46>bytes.length||view.getUint32(position,true)!==0x02014b50)throw Error('Excel 文件已损坏');
      const flags=view.getUint16(position+8,true),method=view.getUint16(position+10,true),size=view.getUint32(position+20,true),expanded=view.getUint32(position+24,true),nl=view.getUint16(position+28,true),el=view.getUint16(position+30,true),cl=view.getUint16(position+32,true),offset=view.getUint32(position+42,true);
      const name=new TextDecoder().decode(bytes.slice(position+46,position+46+nl));position+=46+nl+el+cl;
      if(!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(name))continue;
      if(flags&1)throw Error('请先移除工作簿密码');
      total+=expanded;if(total>30*1024*1024)throw Error('解压后的表格过大，请仅保留名单数据');
      if(offset+30>bytes.length)throw Error('Excel 文件不完整');
      const start=offset+30+view.getUint16(offset+26,true)+view.getUint16(offset+28,true);
      if(start+size>bytes.length)throw Error('Excel 文件不完整');
      const data=bytes.slice(start,start+size);
      if(method===0)files[name]=data;
      else if(method===8){
        const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let length=0;
        while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>expanded||length>30*1024*1024){await reader.cancel();throw Error('Excel 解压大小异常')}parts.push(value)}
        files[name]=new Uint8Array(await new Blob(parts).arrayBuffer());
      }else throw Error('不支持此 Excel 压缩格式');
    }
    return files;
  }
  async function readWorkbook(file){
    const files=await unzip(await file.arrayBuffer()),decoder=new TextDecoder();
    const xml=path=>{if(!files[path])return null;const doc=new DOMParser().parseFromString(decoder.decode(files[path]),'application/xml');if(doc.querySelector('parsererror'))throw Error('工作表 XML 损坏');return doc};
    const shared=[...(xml('xl/sharedStrings.xml')?.querySelectorAll('si')||[])].map(si=>[...si.querySelectorAll('t')].map(t=>t.textContent).join(''));
    const relationships=new Map([...(xml('xl/_rels/workbook.xml.rels')?.querySelectorAll('Relationship')||[])].map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
    const sheets=[...(xml('xl/workbook.xml')?.querySelectorAll('sheet')||[])].map(s=>{
      const target=relationships.get(s.getAttribute('r:id'))||'';
      const path=target.startsWith('/')?target.slice(1):new URL(target,'https://local/xl/').pathname.slice(1);
      return {name:s.getAttribute('name')||'工作表',path};
    }).filter(s=>files[s.path]);
    if(!sheets.length)throw Error('找不到可读取的工作表');
    return sheets.map(sheet=>({name:sheet.name,rows:()=>{
      return [...xml(sheet.path).querySelectorAll('row')].map(row=>{
        const values=[];row.querySelectorAll('c').forEach((cell,fallback)=>{
          const letters=(cell.getAttribute('r')||'').match(/^[A-Z]+/i)?.[0];let col=0;
          if(letters)for(const c of letters.toUpperCase())col=col*26+c.charCodeAt(0)-64;
          const raw=cell.querySelector('v')?.textContent||'';
          values[letters?col-1:fallback]=cell.getAttribute('t')==='s'?(shared[+raw]||''):cell.getAttribute('t')==='inlineStr'?[...cell.querySelectorAll('is t')].map(t=>t.textContent).join(''):raw;
        });return values;
      });
    }}));
  }
  function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')}
    return Object.freeze({parseText,normalize,calledIds,candidates,randomIndex,readWorkbook,csv});
  })();
  global.MimiCommon=Object.freeze({text,init,toast,download,backup,roster});
})(window);
