const test=require('node:test');
const assert=require('node:assert/strict');
const {merge}=require('../src/renderer/scripts/mimi-table-merge.js');

const source=(id,headers,rows,keys,selected)=>({id,table:{headers,rows},keys,selected});

test('三张成绩表按复合键汇总，且仅输出勾选字段',()=>{
  const base=source('df1',['学号','班级','姓名','语文'],[['01','一班','小雨',93],['02','一班','小林',80]],[0,1],[2,3]);
  const math=source('df2',['编号','班级','姓名','数学'],[['01','一班','小雨',88],['02','二班','小林',75]],[0,1],[3]);
  const english=source('df3',['编号','班级','英语'],[['01','一班',91],['02','一班',86]],[0,1],[2]);
  const result=merge({mode:'match',base,joins:[math,english]});
  assert.deepEqual(result.headers,['df1·姓名','df1·语文','df2·数学','df3·英语','df2·匹配状态','df3·匹配状态']);
  assert.deepEqual(result.rows,[['小雨',93,88,91,'已匹配','已匹配'],['小林',80,'',86,'未匹配','已匹配']]);
});

test('重复键和空键不会被静默匹配',()=>{
  const base=source('df1',['姓名','语文'],[['小雨',90],['',70]],[0],[0,1]);
  const other=source('df2',['姓名','数学'],[['小雨',80],['小雨',85],['',60]],[0],[1]);
  const result=merge({mode:'match',base,joins:[other]});
  assert.deepEqual(result.rows.map(row=>row.slice(-2)),[['','参与表重复冲突'],['','主表匹配值为空']]);
  assert.match(result.note,/df2 1 行/);
});

test('多表名单对比显示缺失、变化和空键记录',()=>{
  const base=source('df1',['学号','姓名','班级'],[['01','小雨','一班'],['02','小林','一班'],['','无编号','一班']],[0],[1,2]);
  const current=source('df2',['编号','姓名','班级'],[['01','小雨','二班'],['03','小陈','一班']],[0],[1,2]);
  const signup=source('df3',['编号','姓名'],[['01','小雨'],['02','小林'],['03','小陈']],[0],[1]);
  const result=merge({mode:'compare',base,joins:[current,signup]});
  assert.equal(result.rows.length,4);
  assert.equal(result.rows.find(row=>row[0]==='01')[result.headers.indexOf('变化字段')],'班级');
  assert.equal(result.rows.find(row=>row[0]==='02')[result.headers.indexOf('对比结果')],'记录缺失');
  assert.equal(result.rows.find(row=>row[0]==='03')[result.headers.indexOf('df1·记录状态')],'缺少');
  assert.equal(result.rows.find(row=>row[0]==='（空）')[result.headers.indexOf('对比结果')],'匹配键为空');
});

test('重复使用数据表或重复选择匹配列会提示错误',()=>{
  const base=source('df1',['学号','姓名'],[['01','小雨']],[0,0],[1]);
  const other=source('df2',['编号','姓名'],[['01','小雨']],[0,1],[1]);
  assert.throws(()=>merge({mode:'match',base,joins:[other]}),/不能重复/);
  base.keys=[0];other.keys=[0];
  assert.throws(()=>merge({mode:'match',base,joins:[base]}),/不能重复参与/);
});

test('字段选择决定变化检查范围，宽松匹配可关闭',()=>{
  const base=source('df1',['姓名','班级'],[['Ａ 小雨','一班']],[0],[0]);
  const other=source('df2',['姓名','班级'],[['a 小雨','二班']],[0],[0]);
  const loose=merge({mode:'match',base,joins:[other],loose:true});
  assert.equal(loose.rows[0].at(-1),'已匹配');
  const strict=merge({mode:'match',base,joins:[other],loose:false});
  assert.equal(strict.rows[0].at(-1),'未匹配');
  const compare=merge({mode:'compare',base,joins:[other],loose:true});
  assert.equal(compare.rows[0][compare.headers.indexOf('变化字段')],'');
});
