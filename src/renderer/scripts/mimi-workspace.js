/* 咪咪工具共享工作台控制器：侧栏、拖动宽度和移动端导航的唯一行为源。 */
(function(global){
  'use strict';
  const clamp=value=>Math.max(220,Math.min(420,Math.round(value)));
  function mount(options={}){
    const root=document.querySelector(options.root||'#workspace');
    if(!root)throw new Error('MimiWorkspace: workspace not found');
    const read=options.read||(()=>({})),write=options.write||(()=>{}),notify=options.toast||(()=>{});
    const defaults={left:290,right:280,...options.widths};
    const mobileMedia=options.mobileMedia||'(max-width:760px)';
    const labels={left:'左侧栏',right:'右侧栏',...options.labels};
    let ui=read()||{};
    const revealCleanups={left:null,right:null};
    const el=id=>document.getElementById(id);
    function persist(){write(ui)}
    function apply(){
      ui=read()||ui||{};
      const left=clamp(+ui.leftWidth||defaults.left),right=clamp(+ui.rightWidth||defaults.right);
      root.style.setProperty('--left-w',left+'px');root.style.setProperty('--right-w',right+'px');
      root.style.setProperty('--left-width',left+'px');root.style.setProperty('--right-width',right+'px');
      root.classList.toggle('hide-left',!!ui.leftHidden);root.classList.toggle('hide-right',!!ui.rightHidden);
      for(const side of ['left','right']){
        el('show'+side[0].toUpperCase()+side.slice(1))?.setAttribute('aria-hidden',String(!ui[side+'Hidden']));
        el(side+'Resizer')?.setAttribute('aria-valuenow',side==='left'?left:right);
      }
    }
    function setPanel(side,hidden){
      ui=read()||ui;
      revealCleanups[side]?.();
      const revealClass='revealing-'+side;
      if(hidden)root.classList.remove(revealClass);
      else root.classList.add(revealClass);
      ui[side+'Hidden']=hidden;apply();persist();notify(hidden?`${labels[side]}已收起`:'面板已展开');
      if(!hidden){
        let timer=0;
        const finishReveal=event=>{
          if(event&&event.target!==root)return;
          root.removeEventListener('transitionend',finishReveal);
          clearTimeout(timer);
          root.classList.remove(revealClass);
          revealCleanups[side]=null;
        };
        revealCleanups[side]=finishReveal;
        root.addEventListener('transitionend',finishReveal);
        timer=setTimeout(()=>finishReveal(),360);
      }
    }
    function setMobilePanel(panel,{scroll=true}={}){
      if(!root.querySelector(`[data-mobile-panel-name="${panel}"]`))return;
      root.dataset.mobilePanel=panel;
      root.querySelectorAll('[data-workspace-panel]').forEach(item=>item.classList.toggle('is-mobile-active',item.dataset.mobilePanelName===panel));
      document.querySelectorAll('.mobile-nav [data-mobile-panel]').forEach(button=>{const active=button.dataset.mobilePanel===panel;button.classList.toggle('active',active);active?button.setAttribute('aria-current','page'):button.removeAttribute('aria-current')});
      if(scroll&&matchMedia(mobileMedia).matches)requestAnimationFrame(()=>root.scrollIntoView({block:'start',behavior:options.reducedMotion?.()?'auto':'smooth'}));
      options.onMobilePanel?.(panel);
    }
    function initResizer(side){
      const handle=el(side+'Resizer');if(!handle)return;
      const key=side+'Width',fallback=defaults[side];handle.setAttribute('aria-valuemin','220');handle.setAttribute('aria-valuemax','420');
      handle.addEventListener('pointerdown',event=>{
        if(innerWidth<=1100||event.button!==0)return;event.preventDefault();
        const pointerId=event.pointerId;let raw=+(read()?.[key])||fallback,active=true;
        const finish=e=>{if(!active||e?.pointerId!==undefined&&e.pointerId!==pointerId)return;active=false;root.classList.remove('resizing');window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',finish,true);window.removeEventListener('pointercancel',finish,true);window.removeEventListener('blur',finish);handle.removeEventListener('lostpointercapture',finish);if(handle.hasPointerCapture(pointerId))handle.releasePointerCapture(pointerId);if(raw<170)setPanel(side,true);else{persist();notify(`${labels[side]}宽度已保存`)}};
        const move=e=>{if(!active||e.pointerId!==pointerId)return;if(e.pointerType==='mouse'&&e.buttons===0){finish(e);return}const rect=root.getBoundingClientRect();raw=side==='left'?e.clientX-rect.left:rect.right-e.clientX;ui=read()||ui;ui[key]=clamp(raw);apply()};
        root.classList.add('resizing');window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',finish,true);window.addEventListener('pointercancel',finish,true);window.addEventListener('blur',finish);handle.addEventListener('lostpointercapture',finish);handle.setPointerCapture(pointerId);
      });
      handle.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const direction=event.key==='ArrowRight'?1:-1,multiplier=side==='left'?1:-1;ui=read()||ui;ui[key]=clamp((+ui[key]||fallback)+direction*multiplier*10);apply();persist()});
      handle.ondblclick=()=>{ui=read()||ui;ui[key]=fallback;apply();persist();notify(`${labels[side]}已恢复默认宽度`)};
    }
    for(const side of ['left','right']){
      el('hide'+side[0].toUpperCase()+side.slice(1))?.addEventListener('click',()=>setPanel(side,true));
      el('show'+side[0].toUpperCase()+side.slice(1))?.addEventListener('click',()=>setPanel(side,false));
      initResizer(side);
    }
    document.querySelectorAll('.mobile-nav [data-mobile-panel]').forEach(button=>button.addEventListener('click',()=>setMobilePanel(button.dataset.mobilePanel)));
    apply();
    return {apply,setPanel,setMobilePanel,state:()=>ui};
  }
  global.MimiWorkspace=Object.freeze({mount});
})(window);
