/* 只读预览：搜索和分页仅改变展示，不修改输入表或导出结果。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.MimiTablePreview=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const text=value=>String(value??'');
  const normalize=value=>text(value).normalize('NFKC').trim().toLocaleLowerCase('zh-CN');

  function selectRows(rows,query='',predicate=null){
    const needle=normalize(query),entries=[];
    rows.forEach((row,index)=>{
      if(predicate&&!predicate(row))return;
      if(needle&&!row.some(value=>normalize(value).includes(needle)))return;
      entries.push({row,index});
    });
    return entries;
  }
  function paginate(entries,page=0,size=100){
    size=[50,100,250].includes(size)?size:100;
    const pages=Math.max(1,Math.ceil(entries.length/size));
    page=Math.max(0,Math.min(pages-1,Number.isFinite(page)?Math.trunc(page):0));
    const start=page*size;
    return {page,pages,start:entries.length?start+1:0,end:Math.min(start+size,entries.length),entries:entries.slice(start,start+size)};
  }

  function mount($,{styleToCss,onResetFilters}){
    let current=null,entries=[],page=0,size=100,chart=false;
    const table=$('dataTable'),stage=$('tableStage'),search=$('previewSearch');
    function measureHeaders(){
      if(table.hidden||chart)return;
      let top=0;
      Array.from(table.tHead.rows).forEach(row=>{
        Array.from(row.cells).forEach(cell=>{cell.style.top=`${top}px`});
        top+=row.getBoundingClientRect().height;
      });
    }
    new ResizeObserver(measureHeaders).observe(table.tHead);
    function renderHead(){
      const {headers,headerRows,headerMerges=[],headerStyles}=current;
      const levels=headerRows?.length?headerRows:[headers],anchors=new Map(),covered=new Set();
      headerMerges.forEach(merge=>{
        anchors.set(`${merge.top}:${merge.left}`,merge);
        for(let r=merge.top;r<=merge.bottom;r++)for(let c=merge.left;c<=merge.right;c++)if(r!==merge.top||c!==merge.left)covered.add(`${r}:${c}`);
      });
      table.tHead.replaceChildren();
      levels.forEach((values,r)=>{
        const line=document.createElement('tr');line.className=`header-level-${r}`;
        if(r===0){const number=document.createElement('th');number.className='preview-row-number';number.textContent='#';number.title='数据行号';number.scope='col';number.rowSpan=levels.length;line.append(number)}
        headers.forEach((header,c)=>{
          if(covered.has(`${r}:${c}`))return;
          const cell=document.createElement('th'),merge=anchors.get(`${r}:${c}`);
          cell.textContent=text(values[c]);cell.title=text(values[c])||header;
          cell.scope=merge&&merge.right>merge.left?'colgroup':'col';
          if(r===0)cell.classList.add('is-group');
          if(merge){cell.colSpan=merge.right-merge.left+1;cell.rowSpan=merge.bottom-merge.top+1;cell.classList.add('is-merged')}
          Object.assign(cell.style,styleToCss(headerStyles?.[r]?.[c]));line.append(cell);
        });table.tHead.append(line);
      });
    }
    function paint(){
      if(!current)return;
      const slice=paginate(entries,page,size);page=slice.page;
      const body=table.tBodies[0],fragment=document.createDocumentFragment();
      slice.entries.forEach(({row,index},rowIndex)=>{
        const line=document.createElement('tr');line.dataset.rowIndex=String(index);
        const number=document.createElement('th');number.className='preview-row-number';number.scope='row';number.textContent=String(index+1);line.append(number);
        current.headers.forEach((_,col)=>{
          const cell=document.createElement('td'),value=text(row[col]);cell.textContent=value;cell.title=value;
          cell.tabIndex=rowIndex===0&&col===0?0:-1;
          if(['已匹配','一致','存在'].includes(value))cell.classList.add('is-ok');
          if(['未匹配','缺失','缺少','内容变化','记录缺失'].includes(value))cell.classList.add('is-warn');
          if(['冲突','重复','待检查','空'].some(key=>value.includes(key)))cell.classList.add('is-bad');
          line.append(cell);
        });fragment.append(line);
      });body.replaceChildren(fragment);
      const filtered=!!normalize(search.value)||!!current.predicate;
      table.hidden=!entries.length;$('tableEmpty').hidden=!!entries.length;
      $('previewEmptyTitle').textContent=filtered?'没有符合条件的数据':'这张表还没有数据行';
      $('previewEmptyHint').textContent=filtered?'试试其他关键词，或清除筛选查看整张表':'可以切换其他表格，或检查表头设置';
      $('previewEmptyHint').hidden=false;$('resetPreviewFilters').hidden=!filtered;
      $('clearPreviewSearch').hidden=!search.value;
      $('previewPageLabel').textContent=`${page+1} / ${slice.pages}`;
      $('previewPrevious').disabled=page===0;$('previewNext').disabled=page===slice.pages-1;
      $('centerStatus').textContent=`${filtered?`筛选 ${entries.length} / ${current.rows.length}`:`共 ${current.rows.length}`} 行 · ${current.headers.length} 列${entries.length?` · 显示 ${slice.start}–${slice.end} 行`:''}${filtered&&current.isResult?' · 导出全部结果':''}`;
      stage.scrollTop=0;requestAnimationFrame(measureHeaders);
    }
    function filter(){
      if(!current)return;
      entries=selectRows(current.rows,search.value,current.predicate);page=0;paint();
    }
    function setView(isChart){
      const changed=chart!==isChart;chart=isChart;
      $('previewTools').hidden=chart||!current;$('previewPagination').hidden=chart||!current;
      $('tableTitleBanner').hidden=chart||!current?.title;
      if(chart&&current)$('centerStatus').textContent=`共 ${current.rows.length} 行 · 图表基于全部分析结果`;
      else if(current&&changed)paint();
    }
    function render(data){
      if(current?.key!==data.key){search.value='';page=0;stage.scrollLeft=0}
      current=data;
      $('tableTitleBanner').textContent=data.title||'';
      $('tableTitleBanner').hidden=chart||!data.title;
      $('previewTools').hidden=chart;$('previewPagination').hidden=chart;
      renderHead();filter();
    }
    function reset(){
      current=null;entries=[];page=0;search.value='';
      table.tHead.replaceChildren();table.tBodies[0].replaceChildren();table.hidden=true;
      $('previewTools').hidden=true;$('previewPagination').hidden=true;$('tableTitleBanner').hidden=true;
      $('tableEmpty').hidden=false;$('resetPreviewFilters').hidden=true;
      $('previewEmptyTitle').textContent='请先导入数据';
      $('previewEmptyHint').textContent='';$('previewEmptyHint').hidden=true;
    }
    search.addEventListener('input',event=>{if(!event.isComposing)filter()});
    search.addEventListener('compositionend',filter);
    search.addEventListener('keydown',event=>{if(event.key==='Escape'){search.value='';filter()}});
    $('clearPreviewSearch').onclick=()=>{search.value='';filter();search.focus()};
    $('resetPreviewFilters').onclick=()=>{search.value='';onResetFilters();filter();search.focus()};
    $('previewPageSize').onchange=()=>{size=Number($('previewPageSize').value);page=0;paint()};
    $('previewPrevious').onclick=()=>{page--;paint()};$('previewNext').onclick=()=>{page++;paint()};
    $('wrapPreview').onclick=()=>{
      const wrap=table.classList.toggle('is-wrapped');$('wrapPreview').setAttribute('aria-pressed',String(wrap));
      requestAnimationFrame(measureHeaders);
    };
    table.onkeydown=event=>{
      const cell=event.target.closest('td');if(!cell)return;
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)){
        event.preventDefault();
        const row=cell.parentElement,body=table.tBodies[0];
        const next=event.key==='ArrowUp'?body.rows[row.sectionRowIndex-1]?.cells[cell.cellIndex]:event.key==='ArrowDown'?body.rows[row.sectionRowIndex+1]?.cells[cell.cellIndex]:row.cells[cell.cellIndex+(event.key==='ArrowLeft'?-1:1)];
        if(next?.tagName==='TD'){cell.tabIndex=-1;next.tabIndex=0;next.focus()}
      }
    };
    return {render,reset,setView};
  }
  return {selectRows,paginate,mount};
});
