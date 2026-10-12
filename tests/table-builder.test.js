const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// 在隔离环境中运行页面实际使用的规则状态逻辑，不需要初始化 Electron 和预览组件。
const script=fs.readFileSync(require.resolve('../src/renderer/scripts/mimi-table.js'),'utf8');
const builderScript=script.slice(script.indexOf('  function suggestedColumn('),script.indexOf('  function fieldPicker('));
function setup(){
  const sources=['df1','df2','df3'].map(id=>({id,table:{headers:['学号','姓名','成绩'],rows:[[id,'小雨',90]]}}));
  const state={sources,baseSourceId:'',baseKeys:[],baseSelected:null,joins:[],nextJoinId:1,joinAutoInitialized:false};
  const select={value:'df1'};
  const context=vm.createContext({state,$:()=>select,currentTable:()=>state.sources.find(source=>source.id===select.value)?.table||null});
  vm.runInContext(builderScript,context);
  context.ensureBuilderState();
  return {state,select,sync:context.ensureBuilderState,makeJoin:context.makeJoin};
}
const ids=state=>Array.from(state.joins,join=>join.sourceId);

test('删除补充表会移除对应规则，并保留其他补充表的字段与覆盖设置',()=>{
  const {state,sync}=setup();
  const remaining=state.joins[1];
  remaining.selected=[2];remaining.overwrites=[{from:2,to:2,mode:'fillEmpty'}];
  state.sources=state.sources.filter(source=>source.id!=='df2');
  sync();
  assert.deepEqual(ids(state),['df3']);
  assert.equal(state.joins[0],remaining);
  assert.deepEqual(remaining.selected,[2]);
  assert.deepEqual(remaining.overwrites,[{from:2,to:2,mode:'fillEmpty'}]);
});

test('删除主表后，新主表退出补充表列表，不留下已删除主表的空规则',()=>{
  const {state,select,sync}=setup();
  state.sources=state.sources.filter(source=>source.id!=='df1');select.value='df2';
  sync();
  assert.equal(state.baseSourceId,'df2');
  assert.deepEqual(ids(state),['df3']);
});

test('主动切换主表时，原主表仍作为补充表保留',()=>{
  const {state,select,sync}=setup();
  select.value='df2';sync();
  assert.deepEqual(ids(state),['df1','df3']);
});

test('固定绑定数据表后，不保留未绑定数据表的空规则',()=>{
  const {state,sync,makeJoin}=setup();
  const empty=makeJoin();state.joins.push(empty);
  state.sources=state.sources.filter(source=>source.id!=='df2');sync();
  assert.deepEqual(ids(state),['df3']);
});

test('连续删除全部表格后，补充表列表为空',()=>{
  const {state,select,sync}=setup();
  for(const id of ['df1','df2','df3']){
    state.sources=state.sources.filter(source=>source.id!==id);
    select.value=state.sources[0]?.id||'';sync();
  }
  assert.equal(state.baseSourceId,'');
  assert.deepEqual(ids(state),[]);
});
