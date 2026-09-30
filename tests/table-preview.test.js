const test=require('node:test');
const assert=require('node:assert/strict');
const {selectRows,paginate}=require('../src/renderer/scripts/mimi-table-preview');

test('搜索覆盖第 500 行之后的数据，保留原始行号且不修改源表',()=>{
  const rows=Array.from({length:625},(_,index)=>Object.freeze([`学生${index+1}`,index+1]));
  Object.freeze(rows);
  const matches=selectRows(rows,'学生601');
  assert.deepEqual(matches,[{row:['学生601',601],index:600}]);
  assert.equal(matches[0].row,rows[600]);
  assert.equal(rows.length,625);
  const last=paginate(selectRows(rows),6,100);
  assert.deepEqual([last.start,last.end,last.pages,last.entries.length],[601,625,7,25]);
});

test('搜索支持全角、大小写、数字和空值，并能与待检查筛选组合',()=>{
  const rows=[['ＡＢＣ',0,null,'已匹配'],['abc',10,undefined,'未匹配'],['别的记录',20,'','未匹配']];
  assert.deepEqual(selectRows(rows,' AbC ',row=>row[3]==='未匹配').map(item=>item.index),[1]);
  assert.deepEqual(selectRows(rows,'0').map(item=>item.index),[0,1,2]);
  assert.equal(selectRows(rows,'不存在').length,0);
  assert.equal(selectRows(rows,'  ').length,3);
});

test('空结果、页码越界和每页行数变化不会造成跳行或重复',()=>{
  const entries=selectRows(Array.from({length:251},(_,i)=>[i]));
  const first=paginate(entries,0,250),last=paginate(entries,99,250);
  assert.equal(last.page,1);
  assert.deepEqual([...first.entries,...last.entries],entries);
  assert.equal(paginate(entries,-1,50).start,1);
  assert.deepEqual(paginate([],3,100),{page:0,pages:1,start:0,end:0,entries:[]});
});
