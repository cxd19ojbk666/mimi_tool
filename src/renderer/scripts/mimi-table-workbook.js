/* 做表格专用：读取多级表头，并把来源单元格的常用 Excel 格式带入结果。 */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('exceljs'):root.ExcelJS);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MimiTableWorkbook=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(ExcelJS){
  'use strict';
  const clone=value=>value?JSON.parse(JSON.stringify(value)):{};
  const plain=value=>{
    if(value==null)return '';
    if(value instanceof Date)return value;
    if(typeof value!=='object')return value;
    if(('formula' in value||'sharedFormula' in value)&&!('result' in value))throw Error('工作表含未缓存结果的公式，请在 Excel 中重新计算并保存后导入');
    if('result' in value)return plain(value.result);
    if(Array.isArray(value.richText))return value.richText.map(item=>item.text||'').join('');
    if('text' in value)return value.text;
    if('error' in value)return value.error;
    return '';
  };
  const empty=value=>value===null||value===undefined||String(value).trim()==='';
  function range(ref){
    const cell=part=>{const match=/^([A-Z]+)(\d+)$/i.exec(part);if(!match)return null;let col=0;for(const letter of match[1].toUpperCase())col=col*26+letter.charCodeAt(0)-64;return {row:Number(match[2]),col}};
    const [a,b=a]=ref.split(':').map(cell);return a&&b?{top:a.row,bottom:b.row,left:a.col,right:b.col}:null;
  }
  function uniquePaths(headerRows){
    const width=Math.max(0,...headerRows.map(row=>row.length)),used=new Set();
    return Array.from({length:width},(_,column)=>{
      const parts=[];
      headerRows.forEach((row,index)=>{
        let value=row[column];
        if(empty(value)&&index<headerRows.length-1){for(let c=column-1;c>=0;c--){if(!empty(row[c])){value=row[c];break}}}
        if(!empty(value)&&parts.at(-1)!==String(value).trim())parts.push(String(value).trim());
      });
      const base=parts.join(' / ')||`第${column+1}列`;
      let name=base,suffix=2;while(used.has(name))name=`${base}_${suffix++}`;used.add(name);return name;
    });
  }
  function buildTable(raw,{start=1,depth=1,format='xlsx'}={}){
    const first=Math.max(1,Number(start)||1),levels=Math.max(1,Math.min(8,Number(depth)||1));
    const width=raw.width;
    if(first+levels-1>raw.lastRow)throw Error('表头起始行或层数超过工作表范围');
    const headerRows=Array.from({length:levels},(_,offset)=>Array.from({length:width},(_,col)=>raw.value(first+offset,col+1,true)));
    const covered=headerRows.map(row=>row.slice());
    const headerMerges=[];
    for(const item of raw.merges||[]){
      if(item.top<first||item.bottom>=first+levels)continue;
      headerMerges.push({top:item.top-first,bottom:item.bottom-first,left:item.left-1,right:item.right-1});
      const master=headerRows[item.top-first][item.left-1];
      for(let r=item.top-first;r<=item.bottom-first;r++)for(let c=item.left-1;c<item.right;c++)covered[r][c]=master;
    }
    const headers=uniquePaths(covered);
    const rows=[],dataStyles=[],rowHeights=[];
    for(let row=first+levels;row<=raw.lastRow;row++){
      rows.push(Array.from({length:width},(_,col)=>raw.value(row,col+1,false)));
      dataStyles.push(Array.from({length:width},(_,col)=>raw.style(row,col+1)));
      rowHeights.push(raw.height(row));
    }
    return {headers,rows,headerRows,resolvedHeaderRows:covered,headerMerges,headerStart:first,headerDepth:levels,headerStyles:headerRows.map((_,offset)=>Array.from({length:width},(_,col)=>raw.style(first+offset,col+1))),headerHeights:headerRows.map((_,offset)=>raw.height(first+offset)),dataStyles,rowHeights,columnWidths:Array.from({length:width},(_,col)=>raw.widthOf(col+1)),format};
  }
  function fromRows(rows,{start=1,depth=1,format='csv'}={}){
    const width=Math.max(0,...rows.map(row=>row.length));
    if(!width||!rows.length)throw Error('没有可读取的数据');
    const raw={width,lastRow:rows.length,merges:[],value:(row,col)=>rows[row-1]?.[col-1]??'',style:()=>({}),height:()=>undefined,widthOf:()=>undefined};
    return buildTable(raw,{start,depth,format});
  }
  function worksheetInfo(sheet){
    let width=0,lastRow=0;sheet.eachRow((row,index)=>{lastRow=index;row.eachCell(cell=>{width=Math.max(width,cell.col)})});
    const merges=(sheet.model.merges||[]).map(range).filter(Boolean);
    for(const item of merges){width=Math.max(width,item.right);lastRow=Math.max(lastRow,item.bottom)}
    if(width>500)throw Error('工作表超过 500 列，请先缩小数据范围');
    return {width,lastRow,merges};
  }
  function suggestHeader(sheet){
    const info=worksheetInfo(sheet),limit=Math.min(15,info.lastRow);
    let start=1;
    for(let r=1;r<=limit;r++){
      let count=0;
      for(let c=1;c<=info.width;c++){const cell=sheet.getCell(r,c);if(cell.isMerged&&cell.master?.address!==cell.address)continue;if(!empty(plain(cell.value)))count++}
      if(count>=2){start=r;break}
      if(count===1&&r===limit)start=r;
    }
    let depth=1;
    while(depth<5&&start+depth<=info.lastRow){
      const row=start+depth-1;
      const hasHorizontalMerge=info.merges.some(item=>item.top<=row&&item.bottom>=row&&item.right>item.left&&item.top>=start);
      const hasVerticalContinuation=info.merges.some(item=>item.top<start+depth&&item.bottom>=start+depth&&item.top>=start);
      if(!hasHorizontalMerge&&!hasVerticalContinuation)break;
      depth++;
    }
    return {start,depth};
  }
  function fromWorksheet(sheet,options={}){
    const info=worksheetInfo(sheet),suggested=suggestHeader(sheet);
    if(!info.width||!info.lastRow)throw Error('工作表没有可读取的数据');
    const raw={...info,value:(row,col,header)=>{
      const cell=sheet.getCell(row,col);
      if(header&&cell.isMerged&&cell.master?.address!==cell.address)return '';
      return plain(cell.value);
    },style:(row,col)=>clone(sheet.getCell(row,col).style),height:row=>sheet.getRow(row).height,widthOf:col=>sheet.getColumn(col).width};
    return buildTable(raw,{...suggested,...options,format:'xlsx'});
  }
  function buildLayout(result,sources){
    const sourceMap=new Map(sources.map(source=>[source.id,source]));
    const columns=result.columns||result.headers.map((_,index)=>({sourceId:sources[0]?.id,index}));
    const depth=Math.max(1,...columns.map(col=>sourceMap.get(col.sourceId)?.table.headerDepth||1));
    const group=sourceMap.size>1?1:0,total=depth+group;
    const headerRows=Array.from({length:total},()=>Array(columns.length).fill(''));
    const headerStyles=headerRows.map(row=>row.map(()=>({}))),merges=[];
    const baseStyle=clone(sources[0]?.table.headerStyles?.at(-1)?.[0]);
    columns.forEach((column,outIndex)=>{
      const source=sourceMap.get(column.sourceId),table=source?.table;
      if(table&&Number.isInteger(column.index)){
        const offset=group+depth-table.headerDepth;
        table.headerRows.forEach((row,level)=>{headerRows[offset+level][outIndex]=row[column.index]??'';headerStyles[offset+level][outIndex]=clone(table.headerStyles?.[level]?.[column.index])});
      }else{
        headerRows[total-1][outIndex]=result.headers[outIndex];headerStyles[total-1][outIndex]=clone(baseStyle);
      }
    });
    if(group){
      let at=0;
      while(at<columns.length){
        const id=columns[at].sourceId,key=sourceMap.has(id)?id:'result';let end=at;
        while(end+1<columns.length&&(sourceMap.has(columns[end+1].sourceId)?columns[end+1].sourceId:'result')===key)end++;
        headerRows[0][at]=key==='result'?'对比信息':`${id} · ${sourceMap.get(id).name}`;
        headerStyles[0][at]=clone(sourceMap.get(id)?.table.headerStyles?.[0]?.[columns[at].index]||baseStyle);
        if(end>at)merges.push({top:0,bottom:0,left:at,right:end});at=end+1;
      }
    }
    for(const source of sources){
      const table=source.table,offset=group+depth-(table.headerDepth||1);
      for(const item of table.headerMerges||[]){
        const positions=columns.flatMap((column,index)=>column.sourceId===source.id&&Number.isInteger(column.index)&&column.index>=item.left&&column.index<=item.right?[index]:[]);
        if(!positions.length)continue;
        const first=positions[0],last=positions.at(-1),top=offset+item.top,bottom=offset+item.bottom;
        if(columns[first].index!==item.left)headerRows[top][first]=table.resolvedHeaderRows?.[item.top]?.[columns[first].index]??headerRows[top][first];
        if(first<last||top<bottom)merges.push({top,bottom,left:first,right:last});
      }
    }
    const rowStyles=result.rows.map((_,rowIndex)=>columns.map(column=>{
      const source=sourceMap.get(column.sourceId),table=source?.table,index=result.provenance?.[rowIndex]?.[column.sourceId];
      if(table&&Number.isInteger(column.index))return clone(table.dataStyles?.[index]?.[column.index]||table.dataStyles?.[0]?.[column.index]);
      const style=clone(table?.dataStyles?.[index]?.[0]||sources[0]?.table.dataStyles?.[result.provenance?.[rowIndex]?.[sources[0]?.id]]?.[0]);
      delete style.numFmt;return style;
    }));
    const rowHeights=result.rows.map((_,rowIndex)=>{
      for(const source of sources){const height=source.table.rowHeights?.[result.provenance?.[rowIndex]?.[source.id]];if(height)return height}
      return undefined;
    });
    const headerHeights=Array.from({length:total},(_,level)=>{
      if(level===0&&group)return 23;
      return Math.max(0,...sources.map(source=>source.table.headerHeights?.[level-group-depth+source.table.headerDepth]||0))||undefined;
    });
    const columnWidths=columns.map((column,index)=>sourceMap.get(column.sourceId)?.table.columnWidths?.[column.index]||Math.min(44,Math.max(12,String(result.headers[index]).length+3)));
    return {headerRows,headerStyles,headerMerges:merges,headerHeights,rowStyles,rowHeights,columnWidths,headerDepth:total};
  }
  async function toXlsx(result,sources,layout=buildLayout(result,sources)){
    if(!ExcelJS)throw Error('Excel 格式组件未加载');
    const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('处理结果');
    layout.columnWidths.forEach((width,index)=>{sheet.getColumn(index+1).width=width});
    const put=(rowIndex,values,styles,height)=>{
      const row=sheet.getRow(rowIndex);if(height)row.height=height;
      values.forEach((value,column)=>{const cell=row.getCell(column+1);cell.value=value===''?null:value;cell.style=clone(styles?.[column])});
    };
    layout.headerRows.forEach((row,index)=>put(index+1,row,layout.headerStyles[index],layout.headerHeights[index]));
    result.rows.forEach((row,index)=>put(layout.headerDepth+index+1,row,layout.rowStyles[index],layout.rowHeights[index]));
    for(const item of layout.headerMerges)sheet.mergeCells(item.top+1,item.left+1,item.bottom+1,item.right+1);
    sheet.views=[{state:'frozen',ySplit:layout.headerDepth}];
    return new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function toDelimited(result,format='csv',layout=result.layout){
    const delimiter=format==='tsv'||format==='txt'?'\t':',';
    const quote=value=>{const text=String(value??'');return /["\r\n,\t]/.test(text)?`"${text.replace(/"/g,'""')}"`:text};
    const rows=[...(layout?.headerRows||[result.headers]),...result.rows];
    return new Blob(['\uFEFF',rows.map(row=>row.map(quote).join(delimiter)).join('\r\n')],{type:'text/plain;charset=utf-8'});
  }
  function resultAsTable(result,layout,format='xlsx'){
    const resolvedHeaderRows=layout.headerRows.map(row=>row.slice());
    layout.headerMerges.forEach(item=>{const value=resolvedHeaderRows[item.top][item.left];for(let row=item.top;row<=item.bottom;row++)for(let col=item.left;col<=item.right;col++)resolvedHeaderRows[row][col]=value});
    return {headers:result.headers.slice(),rows:result.rows.map(row=>row.slice()),headerRows:layout.headerRows.map(row=>row.slice()),resolvedHeaderRows,headerMerges:layout.headerMerges.map(item=>({...item})),headerStart:1,headerDepth:layout.headerDepth,headerStyles:layout.headerStyles.map(row=>row.map(clone)),headerHeights:layout.headerHeights.slice(),dataStyles:layout.rowStyles.map(row=>row.map(clone)),rowHeights:layout.rowHeights.slice(),columnWidths:layout.columnWidths.slice(),format};
  }
  return {fromRows,fromWorksheet,suggestHeader,buildLayout,toXlsx,toDelimited,resultAsTable};
});
