/* 多表匹配与名单对比的纯计算逻辑，可在浏览器和 Node 中使用。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MimiTableMerge=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const cell=value=>String(value??'').replace(/[\u200B-\u200D\uFEFF]/g,'').trim();
  const normalized=(value,loose)=>{
    const text=cell(value);
    return loose?text.normalize('NFKC').replace(/\s+/g,'').toLocaleLowerCase('zh-CN'):text;
  };
  const label=(source,column)=>`${source.id}·${source.table.headers[column]}`;
  const keyOf=(row,columns,loose)=>{
    const parts=columns.map(index=>normalized(row[index],loose));
    return parts.every(Boolean)?JSON.stringify(parts):null;
  };
  function validate(base,joins){
    if(!base?.table)throw Error('请先选择主表');
    if(!joins.length)throw Error('请至少添加一张参与表');
    if(!base.keys.length||base.keys.some(index=>!Number.isInteger(index)||index<0||index>=base.table.headers.length))throw Error('请设置有效的主表匹配列');
    const ids=new Set([base.id]);
    for(const source of joins){
      if(!source.table)throw Error('请为每张参与表选择数据表');
      if(ids.has(source.id))throw Error('同一张数据表不能重复参与，请选择其他表');
      ids.add(source.id);
      if(source.keys.length!==base.keys.length||source.keys.some(index=>!Number.isInteger(index)||index<0||index>=source.table.headers.length))throw Error(`${source.id} 的匹配列尚未设置完整`);
    }
    if(new Set(base.keys).size!==base.keys.length)throw Error('主表的匹配列不能重复');
    for(const source of joins)if(new Set(source.keys).size!==source.keys.length)throw Error(`${source.id} 的匹配列不能重复`);
  }
  function indexSource(source,loose){
    const records=new Map(),empty=[];
    source.table.rows.forEach((row,index)=>{
      const key=keyOf(row,source.keys,loose);
      if(key===null){empty.push({row,index});return}
      if(!records.has(key))records.set(key,[]);
      records.get(key).push({row,index});
    });
    return {records,empty};
  }
  function uniqueHeaders(names){
    const used=new Set();
    return names.map(name=>{let result=name,n=2;while(used.has(result))result=`${name}_${n++}`;used.add(result);return result});
  }
  const picked=(source,row)=>source.selected.map(index=>row?.[index]??'');
  const keyLabel=(source,row)=>source.keys.map(index=>cell(row?.[index])).join(' / ');
  function comparisonChanges(sources,groups){
    const byName=new Map();
    sources.forEach((source,index)=>{
      if(groups[index].length!==1)return;
      source.selected.forEach(column=>{
        if(source.keys.includes(column))return;
        const name=source.table.headers[column],value=normalized(groups[index][0].row[column],false);
        if(!byName.has(name))byName.set(name,[]);
        byName.get(name).push(value);
      });
    });
    return [...byName].filter(([,values])=>values.length>1&&new Set(values).size>1).map(([name])=>name);
  }
  // 附表字段去向：selected=新增列；overwrites=手动覆盖[{from:附表列, to:主表列, mode:fillEmpty|overwrite}]
  function merge({mode,base,joins,loose=true,compareChanges=true}){
    validate(base,joins);
    joins.forEach(j=>{if(!Array.isArray(j.overwrites)) j.overwrites=[]});
    const sources=[base,...joins],indexes=sources.map(source=>indexSource(source,loose));
    // 新增列：全部 selected 都追加为新列；覆盖列：按手动映射写回主表列，不产生新列
    const appendCols=joins.flatMap(source=>(source.selected||[]).map(col=>({source,sourceId:source.id,index:col})));
    const overwriteCols=joins.flatMap(source=>(source.overwrites||[]).filter(o=>Number.isInteger(o.from)&&Number.isInteger(o.to)).map(o=>({source,sourceId:source.id,index:o.from,target:o.to,mode:o.mode||'fillEmpty'})));
    const outputColumns=[...base.selected.map(index=>label(base,index)),...appendCols.map(c=>label(c.source,c.index))];
    const columns=[...base.selected.map(index=>({sourceId:base.id,index})),...appendCols.map(c=>({sourceId:c.sourceId,index:c.index}))];
    if(mode==='match'){
      const headers=uniqueHeaders([...outputColumns,...joins.map(source=>`${source.id}·匹配状态`)]);
      const provenance=[];
      const rows=base.table.rows.map((row,rowIndex)=>{
        const key=keyOf(row,base.keys,loose),baseDuplicates=key!==null&&(indexes[0].records.get(key)?.length||0)>1;
        // 先取主表保留字段，再按覆盖策略写入附表值
        const basePos=new Map(base.selected.map((col,i)=>[col,i]));
        const values=[...picked(base,row)],statuses=[],origin={[base.id]:rowIndex};
        joins.forEach((source,index)=>{
          const matches=key===null?[]:indexes[index+1].records.get(key)||[];
          const status=key===null?'主表匹配值为空':baseDuplicates?'主表重复':matches.length>1?'参与表重复冲突':matches.length?'已匹配':'未匹配';
          const mrow=status==='已匹配'?matches[0].row:null;
          // 新增列
          appendCols.filter(c=>c.source===source).forEach(c=>values.push(mrow?mrow[c.index]??'':''));
          // 手动覆盖列：fillEmpty 仅主表为空时写入；overwrite 全部覆盖
          overwriteCols.filter(c=>c.source===source).forEach(c=>{
            if(!mrow)return;
            const incoming=mrow[c.index]??'';
            const pos=basePos.get(c.target);
            if(pos==null)return;
            const cur=values[pos];
            const curEmpty=cur==null||String(cur).trim()==='';
            const inEmpty=incoming==null||String(incoming).trim()==='';
            if(inEmpty)return;
            if(c.mode==='overwrite'||curEmpty)values[pos]=incoming;
          });
          statuses.push(status);
          if(status==='已匹配')origin[source.id]=matches[0].index;
        });
        provenance.push(origin);
        return [...values,...statuses];
      });
      const skipped=indexes.slice(1).map((index,i)=>`${joins[i].id} ${index.empty.length} 行`).filter((_,i)=>indexes[i+1].empty.length);
      const summary=joins.map((source,index)=>{
        const statuses=rows.map(row=>row[outputColumns.length+index]);
        return `${source.id} 已匹配 ${statuses.filter(value=>value==='已匹配').length}、未匹配 ${statuses.filter(value=>value==='未匹配').length}、待检查 ${statuses.filter(value=>!['已匹配','未匹配'].includes(value)).length}`;
      }).join('；');
      return {headers,rows,columns:[...columns,...joins.map(source=>({kind:'status',sourceId:source.id}))],provenance,fileName:'多表匹配结果.xlsx',summary,note:skipped.length?`参与表匹配键为空，未参与匹配：${skipped.join('、')}`:''};
    }
    if(mode!=='compare')throw Error('未知的计算方式');
    const headers=uniqueHeaders(['匹配键',...outputColumns,'对比结果','变化字段',...sources.map(source=>`${source.id}·记录状态`)]);
    const keys=new Set(indexes.flatMap(index=>[...index.records.keys()]));
    const rows=[],provenance=[];
    for(const key of keys){
      const groups=indexes.map(index=>index.records.get(key)||[]);
      const representative=groups.findIndex(group=>group.length);
      const changes=compareChanges?comparisonChanges(sources,groups):[];
      const status=groups.some(group=>group.length>1)?'重复冲突':groups.some(group=>!group.length)?'记录缺失':changes.length?'内容变化':'一致';
      rows.push([keyLabel(sources[representative],groups[representative][0].row),...sources.flatMap((source,i)=>picked(source,groups[i].length===1?groups[i][0].row:null)),status,changes.join('、'),...groups.map(group=>group.length>1?'重复冲突':group.length?'存在':'缺少')]);
      provenance.push(Object.fromEntries(groups.flatMap((group,i)=>group.length===1?[[sources[i].id,group[0].index]]:[])));
    }
    indexes.forEach((index,i)=>index.empty.forEach(({row,index:rowIndex})=>{
      rows.push(['（空）',...sources.flatMap((source,j)=>picked(source,i===j?row:null)),'匹配键为空','',...sources.map((_,j)=>i===j?'匹配键为空':'—')]);
      provenance.push({[sources[i].id]:rowIndex});
    }));
    return {headers,rows,columns:[{kind:'key'},...columns,{kind:'compare'},{kind:'changes'},...sources.map(source=>({kind:'status',sourceId:source.id}))],provenance,fileName:'多表名单对比结果.xlsx'};
  }
  return {merge};
});
