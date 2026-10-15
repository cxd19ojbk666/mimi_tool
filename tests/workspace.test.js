const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../src/renderer/scripts/mimi-workspace.js'),'utf8');
function workspace(saved,{unavailable=false}={}){
  const styles={},classes=new Set(),frames=[];
  const root={
    style:{setProperty:(key,value)=>styles[key]=value},
    classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key),add:key=>classes.add(key)},
  };
  const context={window:{},document:{querySelector:()=>root,getElementById:()=>null,querySelectorAll:()=>[]},
    localStorage:{getItem:()=>{if(unavailable)throw Error('storage unavailable');return saved}},
    requestAnimationFrame:callback=>frames.push(callback)};
  vm.runInNewContext(source,context);
  return {api:context.window.MimiWorkspace,styles,classes,frames};
}

test('saved visibility and widths are restored before mounting, with no layout change on mount',()=>{
  for(const leftHidden of [false,true])for(const rightHidden of [false,true]){
    const ui={leftHidden,rightHidden,leftWidth:333,rightWidth:247};
    for(const nested of [false,true]){
      const state=workspace(JSON.stringify(nested?{ui}:ui));
      state.api.restore({key:'saved',nested});
      assert.equal(state.classes.has('hide-left'),leftHidden);
      assert.equal(state.classes.has('hide-right'),rightHidden);
      assert.equal(state.styles['--left-width'],'333px');
      assert.equal(state.styles['--right-width'],'247px');
      const before={...state.styles};
      state.api.mount({read:()=>ui});
      assert.deepEqual(state.styles,before);
      assert.equal(state.classes.has('mimi-workspace-mounted'),false);
      state.frames.forEach(callback=>callback());
      assert.equal(state.classes.has('mimi-workspace-mounted'),true);
    }
  }
});

test('missing, malformed or unavailable storage leaves the default layout usable',()=>{
  for(const saved of [null,'null','{bad json','{}']){
    const state=workspace(saved);
    state.api.restore({key:'saved',nested:true});
    assert.deepEqual(state.styles,{'--left-w':'290px','--left-width':'290px','--right-w':'280px','--right-width':'280px'});
    assert.equal(state.classes.size,0);
  }
  assert.doesNotThrow(()=>workspace(null,{unavailable:true}).api.restore({key:'saved'}));
});

test('table maker ignores obsolete right sidebar state and preserves its width default',()=>{
  const state=workspace(JSON.stringify({leftHidden:true,rightHidden:true,rightWidth:400}));
  state.api.restore({key:'saved',leftOnly:true,widths:{left:360}});
  assert.equal(state.styles['--left-width'],'360px');
  assert.equal(state.styles['--right-width'],'280px');
  assert.equal(state.classes.has('hide-left'),true);
  assert.equal(state.classes.has('hide-right'),false);
});

test('saved widths use the same bounds before and after mounting',()=>{
  const state=workspace(JSON.stringify({leftWidth:100,rightWidth:900}));
  state.api.restore({key:'saved'});
  assert.equal(state.styles['--left-width'],'220px');
  assert.equal(state.styles['--right-width'],'420px');
});

test('each tool restores the workspace synchronously before parsing its panels',()=>{
  for(const name of ['board-labels','seating-chart','roll-call','table-maker']){
    const html=fs.readFileSync(path.join(__dirname,`../src/renderer/pages/${name}.html`),'utf8');
    assert.equal((html.match(/src="\.\.\/scripts\/mimi-workspace.js"/g)||[]).length,1);
    assert.ok(html.indexOf('<script src="../scripts/mimi-workspace.js"></script>')<html.indexOf('<body'));
    assert.match(html,/<main class="workspace"[^>]*><script>MimiWorkspace\.restore\([^<]+\);<\/script>/);
  }
});
