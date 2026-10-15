/* 板贴业务逻辑（由页面内联脚本原样抽出，后续再按模块拆分）。*/
'use strict';
MimiCommon.init({action:'做板贴',subject:'板贴'});
const $=id=>document.getElementById(id), clone=x=>JSON.parse(JSON.stringify(x)), uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const EXPORT_DPI=150;
const fonts={round:'"YouYuan","Yuanti SC","PingFang SC",sans-serif',kai:'"STKaiti","KaiTi",serif',sans:'"PingFang SC","Microsoft YaHei",sans-serif',song:'"Songti SC","SimSun",serif',hupo:'"STHupo","华文琥珀","YouYuan",sans-serif',caiyun:'"STCaiyun","华文彩云","YouYuan",sans-serif',xinwei:'"STXinwei","华文新魏","STKaiti",serif',liti:'"STLiti","华文隶书","STKaiti",serif',yaoti:'"FZYaoti","方正姚体","YouYuan",serif',wawa:'"Wawati SC","娃娃体","YouYuan",sans-serif',hand:'"Hannotate SC","手札体","STKaiti",serif',fangsong:'"STFangsong","FangSong","仿宋",serif'};
const outlineStyles={brush:{frame:'brush'},stitched:{frame:'stitched'},cloud:{frame:'cloud'},tape:{frame:'tape'},double:{frame:'double'},ribbon:{frame:'ribbon'},bubble:{frame:'bubble'},none:{frame:'none'}};
const illustratedFrames={"sunNote": "太阳手账", "sweetHearts": "双心软框", "starCloud": "星星云朵", "gardenSign": "花园路牌", "daisy": "雏菊花框", "rainbow": "彩虹笔刷", "paperclip": "回形针便签", "comic": "漫画爆炸框", "potted": "盆栽嫩芽"};
Object.keys(illustratedFrames).forEach(frame=>outlineStyles[frame]={frame});
const colorStyles={"sun": ["#165449", "#cfaa42", "#cfaa42", "#fff0aa"], "berry": ["#dc5264", "#f28c98", "#f28c98", "#fff9ef"], "ocean": ["#1467bb", "#ffffff", "#ffffff", "#a9e1fa"], "peach": ["#4d3036", "#e987a0", "#e987a0", "#ffb6c7"], "mint": ["#194c35", "#689441", "#689441", "#def1b0"], "coffee": ["#a95714", "#db982d", "#db982d", "#ffe699"], "lilac": ["#653985", "#ffffff", "#ffffff", "#d9c0fa"], "chalk": ["#263440", "#ef7783", "#ef7783", "#fffaf0"], "orangeSoda": ["#8d3c2b", "#f47d4a", "#c85b38", "#ffd09d"], "seaSalt": ["#205d61", "#4ca89b", "#327d76", "#c8f0e8"], "grapeSoda": ["#51366f", "#9b72cf", "#7650a3", "#ead7ff"], "cocoa": ["#54352b", "#9d6b4b", "#79503c", "#ead2b4"], "watermelon": ["#276746", "#ef5f70", "#bd4358", "#ffcad0"], "moonlight": ["#46546d", "#aab5c8", "#78869d", "#eef1f7"], "deepSea": ["#f2fbff", "#70d6c7", "#3ba99c", "#193b5a"], "mono": ["#263440", "#263440", "#263440", "#fff8ec"]};
const initial={version:1,board:{w:4000,h:1200,bg:'#397862'},items:[]};
let state=clone(initial),selected=null,history=[],future=[],view='design',scale=1,drag=null,images=new Map(),previewVersion=0,busy=false,textEdit=null,textSaveTimer=null;
const measure=document.createElement('canvas').getContext('2d');
// 重组已有控件，保留数据绑定及所有编辑功能。
const boardSettings=$('bw').closest('.section');
document.querySelector('.left .panel-body').append(boardSettings);
document.querySelector('.left .section.stack').style.gridColumn='auto';
boardSettings.style.gridColumn='1 / -1';
document.querySelectorAll('.group-title > span').forEach(number=>number.remove());
const layoutPanel=$('layoutGroupTitle').closest('.editor-group');
layoutPanel.id='layoutPanel';
const stylePanel=$('styleGroup');
stylePanel.querySelector('.group-title').textContent='配色与效果';
const framePanel=document.createElement('section');framePanel.id='framePanel';framePanel.className='editor-group';
stylePanel.after(framePanel);
const inspectorTabs=document.createElement('div');inspectorTabs.className='inspector-tabs tabs';inspectorTabs.setAttribute('role','tablist');inspectorTabs.setAttribute('aria-label','板贴编辑分类');
const inspectorPanels=[layoutPanel,stylePanel,framePanel];
let inspectorPage=0;
inspectorPanels.forEach((panel,index)=>{
 const button=document.createElement('button');button.type='button';button.className='inspector-tab tab';button.id='inspectorTab'+index;
 button.textContent=['内容排版','配色效果','边框效果'][index];button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
 panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);
 button.onclick=()=>{selectInspectorPage(index);$('editorBody').scrollTop=0};
 button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const enabled=[...inspectorTabs.children].filter(b=>!b.disabled);const at=enabled.indexOf(button);const target=e.key==='Home'?0:e.key==='End'?enabled.length-1:(at+(e.key==='ArrowRight'?1:-1)+enabled.length)%enabled.length;enabled[target].click();enabled[target].focus()};
 inspectorTabs.append(button);
});
$('editor').prepend(inspectorTabs);
function selectInspectorPage(index){
 inspectorPage=index;
 inspectorPanels.forEach((panel,i)=>{panel.hidden=i!==index;const button=inspectorTabs.children[i];button.classList.toggle('active',i===index);button.setAttribute('aria-selected',String(i===index));button.tabIndex=i===index?0:-1});
}
const sizeCard=document.createElement('div');sizeCard.className='inspector-card';sizeCard.innerHTML='<h4>板贴尺寸</h4>';
const sizeFields=$('ow').closest('.pair');sizeFields.before(sizeCard);sizeCard.append(sizeFields);
const spacingCard=document.createElement('div');spacingCard.className='inspector-card';spacingCard.innerHTML='<h4>间距</h4>';
const spacingFields=$('letterSpacing').closest('.pair');spacingFields.before(spacingCard);spacingCard.append(spacingFields);
const styleStack=stylePanel.querySelector('.stack');
const editorColors=$('paperFill').closest('.pair');editorColors.classList.add('editor-colors');
styleStack.prepend(editorColors);
stylePanel.querySelector('.subheading').remove();
const borderPresets=stylePanel.querySelector('.outline-presets');
const noBorderPreset=borderPresets.querySelector('[data-outline-style="none"]');
noBorderPreset.querySelector('small').textContent='无边框';
borderPresets.prepend(noBorderPreset);
const makeEffect=(name,label,parent)=>{
 const card=document.createElement('div');card.className='effect-card';
 card.innerHTML=`<label class="check"><input type="checkbox" id="enable${name}">${label}</label>`;
 const options=document.createElement('div');options.id=name.toLowerCase()+'Options';options.className='effect-options';card.append(options);parent.append(card);return options;
};
const outlineOptions=makeEffect('Outline','文字描边',styleStack);
outlineOptions.append($('stroke').closest('label'),$('outline').closest('label'));
const shadowOptions=makeEffect('Shadow','投影效果',styleStack);
shadowOptions.append($('shadowColor').closest('label'),$('shadow').closest('label'));
const frameOptions=document.createElement('div');frameOptions.id='frameOptions';frameOptions.className='effect-options';framePanel.append(frameOptions);
const frameCurrent=document.createElement('div');frameCurrent.className='frame-current';frameCurrent.innerHTML='当前样式<strong id="currentFrameName"></strong>';
frameOptions.append(frameCurrent,borderPresets);
selectInspectorPage(0);
$('printSection').hidden=true;

function fontString(o){return `${o.italic?'italic ':''}${o.bold?'bold ':''}100px ${fonts[o.font]||fonts.round}`}
function layout(o){measure.font=fontString(o);const lines=o.vertical?Array.from(o.text.replace(/\n/g,'')).slice(0,100):o.text.split('\n');if(!lines.length)lines.push('');const spacing=(o.letterSpacing||0)/o.f*100,widths=lines.map(t=>{if(!spacing)return measure.measureText(t).width;const chars=Array.from(t);return chars.reduce((w,ch)=>w+measure.measureText(ch).width,0)+Math.max(0,chars.length-1)*spacing});const pad=(o.frame&&o.frame!=='none'?(illustratedFrames[o.frame]?72:58):18)+o.outline/o.f*100+o.shadow/o.f*100;return {lines,widths,spacing,pad,w:Math.max(20,...widths)+pad*2,h:100+(lines.length-1)*100*o.lineHeight+pad*2}}
function resizeText(o){if(o.type==='text'){const l=layout(o);o.w=l.w*o.f/100;o.h=l.h*o.f/100}}
function newText(text='新的板贴',f=160){const o={id:uid(),type:'text',text,x:300,y:300,f,font:'round',bold:true,italic:false,vertical:false,fill:'#165449',paperFill:'#fff0aa',frame:'brush',stroke:'#cfaa42',outline:3,outlineEnabled:true,shadow:0,shadowEnabled:false,shadowColor:'#263440',lineHeight:1.15,letterSpacing:0};resizeText(o);return o}
state.items=[newText('把每一天',185),newText('过成喜欢的样子',140)];state.items[0].x=state.items[1].x=480;state.items[0].y=220;state.items[1].y=560;state.items[1].fill='#1467bb';state.items[1].paperFill='#a9e1fa';state.items[1].stroke='#ffffff';state.items[1].frame='cloud';selected=state.items[0].id;
function current(){return state.items.find(o=>o.id===selected)}
const settingsController=MimiSettings.mount({
  key:'mimi-board-appearance-v1',dialogId:'appearanceSettingsDialog',
  controls:{font:'appearanceFont',scale:'appearanceScale',compact:'appearanceCompact',reduceMotion:'appearanceReduceMotion',confirmDanger:'appearanceConfirmDanger'},
  open:'#openAppearanceSettings',close:'#closeAppearanceSettings',reset:'#resetAppearanceSettings',
  onApply:()=>requestAnimationFrame(()=>{if(view==='design')render()})
});
function checkpoint(){history.push(JSON.stringify(state));if(history.length>40)history.shift();future=[]}
function autosave(){try{localStorage.setItem('mimi-board-v1',JSON.stringify(state));$('saveStatus').textContent='● 已在此浏览器暂存'}catch{$('saveStatus').textContent='请保存作品备份（浏览器暂存不可用）'}}
function commit(){autosave();render();sync();if(view==='print')preview()}
function change(fn){checkpoint();fn();commit()}
function undo(redo=false){const from=redo?future:history,to=redo?history:future;if(!from.length)return;to.push(JSON.stringify(state));state=JSON.parse(from.pop());if(!current())selected=state.items[0]?.id||null;commit()}
function scheduleTextSave(){clearTimeout(textSaveTimer);$('saveStatus').textContent='● 正在编辑…';textSaveTimer=setTimeout(()=>{textSaveTimer=null;autosave()},400)}
function finishTextEdit(){if(!textEdit)return;clearTimeout(textSaveTimer);textSaveTimer=null;textEdit=null;autosave();sync();if(view==='print')preview()}
function paintText(ctx,text,x,y,spacing,method){if(!spacing){ctx[method](text,x,y);return}for(const ch of Array.from(text)){ctx[method](ch,x,y);x+=ctx.measureText(ch).width+spacing}}
// Enlarge each illustration around its own bounds, keeping it inside the export.
function largerDecoration(c,w,h,x0,y0,x1,y1,draw){
 const factor=1.22,cx=(x0+x1)/2,cy=(y0+y1)/2;
 const tx=Math.max(4-factor*x0,Math.min(w-4-factor*x1,cx*(1-factor)));
 const ty=Math.max(4-factor*y0,Math.min(h-4-factor*y1,cy*(1-factor)));
 c.save();c.translate(tx,ty);c.scale(factor,factor);draw();c.restore();
}

// Uneven, broad cloud lobes keep a roomy center for horizontal and vertical text.
function cloudOutline(c,w,h){
 const left=40,right=w-40,n=Math.max(3,Math.round((w-80)/145)),step=(right-left)/n;
 c.beginPath();c.moveTo(left,44);
 for(let i=0;i<n;i++){
  const x=left+i*step,peak=[0,-8,5,-3][i%4],end= i===n-1?46:([38,45,35][i%3]);
  c.bezierCurveTo(x+step*.12,peak,x+step*.76,peak-2,x+step,end);
 }
 const sideCount=Math.max(2,Math.round((h-88)/120)),sideStep=(h-88)/sideCount;
 for(let i=0;i<sideCount;i++){const y=44+i*sideStep;c.bezierCurveTo(w-1,y+sideStep*.08,w-1,y+sideStep*.88,right,y+sideStep)}
 for(let i=n;i>0;i--){const x=left+i*step,depth=[h+1,h-8,h+4][i%3];c.bezierCurveTo(x-step*.16,depth,x-step*.80,depth,x-step,h-44)}
 for(let i=sideCount;i>0;i--){const y=44+i*sideStep;c.bezierCurveTo(1,y-sideStep*.12,1,y-sideStep*.9,left,y-sideStep)}
 c.closePath();
}

// The nine illustrated frames share the same renderer in previews and exports.
function drawIllustratedFrame(c,o,w,h){
 const k=o.frame,bg=o.paperFill||'#fff8ec';
 c.save();c.lineJoin='round';c.lineCap='round';
 const path=(points,fill,stroke='#ffffff',lw=5)=>{c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke()}};
 const oval=(x,y,rx,ry,fill,stroke=null,lw=2)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke()}};
 const line=(pts,color,width=3)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke()};
 const box=(x,y,ww,hh,r,fill,stroke,lw=4)=>{c.beginPath();c.roundRect(x,y,ww,hh,r);c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=lw;c.stroke()};
 const star=(x,y,r)=>{largerDecoration(c,w,h,x-r-2,y-r-2,x+r+2,y+r+2,()=>{const pts=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,rr=i%2?r*.45:r;return[x+Math.cos(a)*rr,y+Math.sin(a)*rr]});path(pts,'#ffda54','#fffef5',3)});};
 const heart=(x,y,r,angle)=>{largerDecoration(c,w,h,x-30,y-30,x+30,y+25,()=>{c.save();c.translate(x,y);c.rotate(angle);c.scale(r/25,r/25);c.beginPath();c.moveTo(0,19);c.bezierCurveTo(-45,-3,-15,-34,0,-12);c.bezierCurveTo(15,-34,45,-3,0,19);c.fillStyle='#f87592';c.strokeStyle='#fffdf5';c.lineWidth=4;c.stroke();c.fill();line([[-12,-10],[-15,-3],[-9,7]],'#ffbdc9',2);c.restore()});};
 const leaf=(x,y,flip=1)=>{c.save();c.translate(x,y);c.scale(flip,1);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-2,-18,18,-28,24,-25);c.bezierCurveTo(28,-9,13,5,0,0);c.fillStyle='#62a34e';c.strokeStyle='#3d833e';c.lineWidth=2;c.fill();c.stroke();line([[0,0],[17,-18]],'#418039',2);c.restore()};
 const daisy=(x,y)=>{largerDecoration(c,w,h,x-25,y-25,x+32,y+47,()=>{line([[x,y+8],[x+5,y+45]],'#579543',4);leaf(x+4,y+37);for(let i=0;i<6;i++){const a=i*Math.PI/3;oval(x+Math.cos(a)*13,y+Math.sin(a)*13,10,11,'#fffdf4','#e8e6dc',2)}oval(x,y,9,9,'#ffd24e')});};
 const cloud=(x,y)=>{largerDecoration(c,w,h,x-30,y-24,x+33,y+24,()=>{for(const [dx,dy,r]of[[-16,0,12],[-7,-9,13],[9,-9,12],[20,2,11],[8,10,12],[-7,10,12]])oval(x+dx,y+dy,r,r,'#fffefa','#e8e8e4',2);oval(x-7,y,2,3,'#293943');oval(x+8,y,2,3,'#293943');c.beginPath();c.arc(x+1,y+3,5,0,Math.PI);c.strokeStyle='#293943';c.lineWidth=2;c.stroke();oval(x-14,y+6,3,2,'#ff9cae');oval(x+15,y+6,3,2,'#ff9cae')});};
 if(k==='sunNote'){
  const pts=[[14,16]];for(let x=14;x<w-18;x+=12)pts.push([x,16+Math.sin(x)*2]);pts.push([w-18,h-19]);for(let x=w-18;x>12;x-=12)pts.push([x,h-18+Math.sin(x)*2]);path(pts,bg,null);
  c.save();c.globalAlpha=.16;for(let y=42;y<h-20;y+=24)line([[18,y],[w-23,y]],'#82b4b0',1);c.restore();
  // Binder-hole details are painted within the paper, without erasing the board.
  for(let y=43;y<h-25;y+=43){c.save();c.globalAlpha=.35;oval(21,y,7,7,'#9c997e');line([[12,y],[20,y]],'#9c997e',3);c.restore()}
 }else if(k==='gardenSign'){
  path([[18,19],[w-48,19],[w-13,h/2],[w-48,h-19],[18,h-19]],bg,'#ffffff',8);
  c.setLineDash([7,7]);path([[30,29],[w-54,29],[w-27,h/2],[w-54,h-29],[30,h-29]],bg,'#94b67e',2);c.setLineDash([]);
 }else if(k==='comic'){
  const pts=[];const nx=Math.max(4,Math.ceil(w/85));for(let i=0;i<=nx;i++){pts.push([15+i*(w-30)/nx,14+(i%2)*12])}pts.push([w-26,h*.35],[w-8,h*.49],[w-28,h*.64]);for(let i=nx;i>=0;i--)pts.push([15+i*(w-30)/nx,h-14-(i%2)*12]);pts.push([27,h*.65],[8,h*.5],[27,h*.34]);path(pts,bg,'#ffffff',6);
 }else if(k==='rainbow'){
  const pts=[];for(let x=16;x<w-18;x+=6)pts.push([x,27+Math.sin(x*2.4)*5]);for(let x=w-18;x>15;x-=6)pts.push([x,h-24+Math.sin(x*1.7)*5]);path(pts,bg,null);
 }else if(k==='starCloud'){
  cloudOutline(c,w,h);c.fillStyle=bg;c.strokeStyle='#ffffff';c.lineWidth=7;c.fill();c.stroke();
 }else if(k==='daisy'){
  c.beginPath();c.moveTo(15,h/2);c.quadraticCurveTo(8,20,42,28);const n=Math.max(3,Math.ceil(w/100)),step=(w-84)/n;for(let i=0;i<n;i++)c.quadraticCurveTo(42+(i+.5)*step,4,42+(i+1)*step,28);c.quadraticCurveTo(w-5,22,w-15,h/2);c.quadraticCurveTo(w-6,h-20,w-42,h-28);for(let i=n;i>0;i--)c.quadraticCurveTo(42+(i-.5)*step,h-4,42+(i-1)*step,h-28);c.quadraticCurveTo(5,h-20,15,h/2);c.closePath();c.fillStyle=bg;c.strokeStyle='#ffffff';c.lineWidth=7;c.fill();c.stroke();
 }else{box(17,20,w-34,h-40,k==='paperclip'?23:45,bg,k==='paperclip'?'#2d3c49':'#ffffff',5);if(k!=='paperclip'){c.setLineDash([8,6]);c.beginPath();c.roundRect(27,30,w-54,h-60,35);c.strokeStyle=k==='potted'?'#8fc786':'#ef9eae';c.lineWidth=2;c.stroke();c.setLineDash([])}}
 // Subtle, deterministic grain stays in the paper interior.
 c.save();c.globalAlpha=.15;for(let i=0;i<Math.min(160,w*h/300);i++)oval(35+(i*73.17)%(w-70),40+(i*43.31)%(h-80),1.5,.6,'#ffffff');c.restore();
 if(k==='sunNote'){
  largerDecoration(c,w,h,w-64,2,w-4,62,()=>{const x=w-34,y=32;for(let i=0;i<8;i++){const a=i*Math.PI/4;line([[x+Math.cos(a)*23,y+Math.sin(a)*23],[x+Math.cos(a)*28,y+Math.sin(a)*28]],'#f7a044',3)}oval(x,y,19,19,'#ffd659','#fffefa',3);oval(x-6,y-3,2,3,'#9a5a27');oval(x+6,y-3,2,3,'#9a5a27');c.beginPath();c.arc(x,y+1,7,0,Math.PI);c.strokeStyle='#db8251';c.lineWidth=2;c.stroke();});line([[60,h-35],[w-60,h-38]],'#ffd64b',5)
 }else if(k==='sweetHearts'){heart(32,41,26,-.3);heart(w-32,h-42,24,.35)}
 else if(k==='starCloud'){star(31,53,20);star(w-33,h-49,19);line([[w-43,16],[w-37,7]],'#ffe269',5)}
 else if(k==='daisy'){daisy(32,h/2-15);daisy(w-34,h/2-15)}
 else if(k==='gardenSign'){
  largerDecoration(c,w,h,6,24,60,117,()=>{box(29,32,9,67,3,'#bd9364','#fff9e7',3);path([[16,31],[53,26],[55,54],[17,59],[22,44]],'#d6aa76','#886648',3);line([[25,37],[43,34]],'#bd915f',1);for(let i=0;i<5;i++)oval(18+i*8,104-(i%2)*6,11,9,'#72a857','#fffdf0',2)});
 }else if(k==='rainbow'){
  largerDecoration(c,w,h,w-111,7,w-9,60,()=>{['#f888b1','#ffc675','#fff18d','#a4d88a','#91d7f0'].forEach((color,i)=>{c.beginPath();c.arc(w-60,58,48-i*6,Math.PI,Math.PI*2);c.strokeStyle=color;c.lineWidth=6;c.stroke()})});;cloud(w-31,66)
 }else if(k==='paperclip'){
  path([[w-45,22],[w-19,48],[w-45,48]],'#f9e5bb',null);largerDecoration(c,w,h,10,6,57,79,()=>{c.save();c.translate(34,39);c.rotate(.3);c.beginPath();c.moveTo(10,15);c.lineTo(10,-15);c.bezierCurveTo(10,-35,-13,-35,-13,-15);c.lineTo(-13,23);c.bezierCurveTo(-13,37,5,37,5,23);c.lineTo(5,-13);c.strokeStyle='#fffefa';c.lineWidth=10;c.stroke();c.strokeStyle='#5c90bc';c.lineWidth=5;c.stroke();c.restore();});line([[61,h-39],[w-60,h-42]],'#ffda47',5)
 }else if(k==='comic'){
  for(const [x,y,a]of[[28,36,-.6],[w-29,40,.6],[30,h-39,.4]]){c.save();c.translate(x,y);c.rotate(a);c.scale(1.22,1.22);path([[-7,-9],[7,-6],[0,7]],'#ffa94e',null);c.restore()}
 }else if(k==='potted'){
  largerDecoration(c,w,h,w-65,h-106,w-8,h-16,()=>{const x=w-37,y=h-52;line([[x,y],[x+2,y-38]],'#4a873a',5);leaf(x+2,y-25,-1);leaf(x+2,y-25,1);path([[x-21,y],[x+21,y],[x+15,y+34],[x-14,y+34]],'#ba743e','#fffdf5',4);box(x-24,y-3,48,12,4,'#cc884f','#92562f',2);line([[x-11,y+15],[x-8,y+26]],'#de9a60',3)});
 }
 c.restore();
}

function drawFrame(ctx,o,w,h){
 const kind=o.frame;if(!kind||kind==='none')return;
 if(illustratedFrames[kind]){drawIllustratedFrame(ctx,o,w,h);return;}
 const bg=o.paperFill||'#fff8ec',edge=o.stroke||'#ffffff';
 ctx.save();ctx.fillStyle=bg;ctx.strokeStyle=edge;ctx.lineWidth=5;ctx.lineJoin='round';ctx.lineCap='round';
 const rounded=(inset=8,r=30)=>{ctx.beginPath();ctx.roundRect(inset,inset,w-inset*2,h-inset*2,r)};
 ctx.save();
 if(kind==='brush'){
  ctx.beginPath();ctx.moveTo(14,14);for(let x=14;x<w-14;x+=7)ctx.lineTo(x,12+Math.sin(x*1.7)*5);ctx.lineTo(w-8,h-17);for(let x=w-14;x>10;x-=7)ctx.lineTo(x,h-13+Math.sin(x*2.3)*5);ctx.closePath();ctx.fill();
  ctx.globalAlpha=.55;for(let i=0;i<70;i++){const x=10+(i*83.71)%(w-20),y=i%2?8+(i%5):h-12+(i%5);ctx.fillRect(x,y,3+i%8,1.5)}
 }else if(kind==='cloud'){
  cloudOutline(ctx,w,h);ctx.fill();ctx.stroke();
 }else if(kind==='tape'){
  ctx.beginPath();ctx.moveTo(15,12);ctx.lineTo(w-15,12);for(let y=12;y<h-12;y+=10)ctx.lineTo(w-12+(Math.round(y/10)%2)*5,y);ctx.lineTo(15,h-12);for(let y=h-12;y>12;y-=10)ctx.lineTo(12-(Math.round(y/10)%2)*5,y);ctx.closePath();ctx.fill();ctx.clip();ctx.strokeStyle='#ffffff';ctx.globalAlpha=.24;ctx.lineWidth=13;for(let x=-h;x<w;x+=34){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.stroke()}
 }else if(kind==='ribbon'){
  ctx.beginPath();ctx.moveTo(8,12);ctx.lineTo(w-8,12);ctx.lineTo(w-30,h/2);ctx.lineTo(w-8,h-12);ctx.lineTo(8,h-12);ctx.lineTo(30,h/2);ctx.closePath();ctx.fill();ctx.stroke();
 }else if(kind==='bubble'){
  ctx.beginPath();ctx.moveTo(42,10);ctx.lineTo(w-40,10);ctx.quadraticCurveTo(w-10,10,w-10,40);ctx.lineTo(w-10,h-50);ctx.quadraticCurveTo(w-10,h-22,w-40,h-22);ctx.lineTo(65,h-22);ctx.lineTo(30,h-5);ctx.lineTo(36,h-24);ctx.quadraticCurveTo(10,h-24,10,h-50);ctx.lineTo(10,40);ctx.quadraticCurveTo(10,10,42,10);ctx.closePath();ctx.fill();ctx.stroke();
 }else{rounded();ctx.fill();ctx.stroke();ctx.lineWidth=2.5;if(kind==='stitched')ctx.setLineDash([7,7]);rounded(17,23);ctx.stroke();ctx.setLineDash([])}
 ctx.restore();
 // Decorations stay inside the existing print bounds and outside the text area.
 ctx.save();ctx.globalAlpha=.10;ctx.fillStyle='#ffffff';
 for(let i=0;i<Math.min(180,w*h/300);i++){const x=24+(i*61.73)%(w-48),y=24+(i*37.19)%(h-48);ctx.beginPath();ctx.ellipse(x,y,1.8+i%3,.7, -.45,0,Math.PI*2);ctx.fill()}
 ctx.restore();
 const heart=(x,y,size,angle=0)=>{largerDecoration(ctx,w,h,x-30,y-30,x+30,y+25,()=>{ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(size/30,size/30);ctx.beginPath();ctx.moveTo(0,10);ctx.bezierCurveTo(-31,-8,-15,-29,0,-14);ctx.bezierCurveTo(15,-29,31,-8,0,10);ctx.closePath();ctx.fillStyle='#f26e83';ctx.strokeStyle='#fffdf5';ctx.lineWidth=4;ctx.stroke();ctx.fill();ctx.restore()});};
 const star=(x,y,r)=>{largerDecoration(ctx,w,h,x-r-2,y-r-2,x+r+2,y+r+2,()=>{ctx.save();ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rad=i%2?r*.46:r;ctx.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad)}ctx.closePath();ctx.fillStyle='#efad35';ctx.fill();ctx.restore()});};
 const rays=(x,y,flip=1)=>{largerDecoration(ctx,w,h,x-5,y-12,x+30,y+10,()=>{ctx.save();ctx.strokeStyle='#ffda68';ctx.lineWidth=5;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(x+flip*i*10,y+Math.abs(i-1)*6);ctx.lineTo(x+flip*(i*13-3),y-9+Math.abs(i-1)*5);ctx.stroke()}ctx.restore()});};
 if(kind==='stitched'){heart(30,27,29,-.3);heart(w-30,h-26,17,.3)}
 if(kind==='cloud'){rays(w-48,22);star(25,h-29,9);ctx.save();ctx.strokeStyle='#ffffff';ctx.globalAlpha=.7;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(48,h-20);ctx.quadraticCurveTo(62,h-10,79,h-18);ctx.stroke();ctx.restore()}
 if(kind==='double'){
  largerDecoration(ctx,w,h,w-62,2,w-5,46,()=>{ctx.save();ctx.translate(w-33,29);ctx.strokeStyle='#8b5a35';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-5,14);ctx.quadraticCurveTo(6,2,0,-12);ctx.stroke();ctx.fillStyle='#70a947';ctx.strokeStyle='#fffdf2';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(1,0);ctx.bezierCurveTo(-27,-1,-27,-29,-13,-23);ctx.bezierCurveTo(0,-23,6,-9,1,0);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(1,0);ctx.bezierCurveTo(2,-21,25,-23,24,-11);ctx.bezierCurveTo(19,1,9,4,1,0);ctx.fill();ctx.stroke();ctx.strokeStyle='#4f8334';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(0,-1);ctx.lineTo(-13,-16);ctx.moveTo(2,-1);ctx.lineTo(17,-11);ctx.stroke();ctx.restore()});;rays(16,h-24)
 }
 if(kind==='ribbon'){star(29,h/2,11);star(w-29,h/2,11);ctx.save();ctx.strokeStyle='#fffdf4';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(43,21);ctx.lineTo(w-43,21);ctx.moveTo(43,h-21);ctx.lineTo(w-43,h-21);ctx.stroke();ctx.restore()}
 if(kind==='tape'){
  for(const [x,y,a] of [[31,24,-.55],[w-31,h-24,-.55]]){ctx.save();ctx.translate(x,y);ctx.scale(1.22,1.22);ctx.rotate(a);ctx.fillStyle='#f4fff1';ctx.globalAlpha=.72;ctx.fillRect(-25,-10,50,20);ctx.strokeStyle='#bdd8c5';ctx.lineWidth=2;for(let i=-23;i<25;i+=7){ctx.beginPath();ctx.moveTo(i,-9);ctx.lineTo(i+5,9);ctx.stroke()}ctx.restore()}
 }
 if(kind==='bubble'){
  ctx.save();ctx.translate(w-30,30);ctx.scale(1.22,1.22);ctx.rotate(.35);ctx.strokeStyle='#293845';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(0,19);ctx.stroke();ctx.fillStyle='#f16c80';ctx.beginPath();ctx.moveTo(-10,-15);ctx.lineTo(10,-15);ctx.lineTo(7,-3);ctx.quadraticCurveTo(20,8,0,9);ctx.quadraticCurveTo(-20,8,-7,-3);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#ff9ba7';ctx.beginPath();ctx.ellipse(0,-15,13,6,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();rays(17,30)
 }
 if(kind==='brush'){
  ctx.save();ctx.strokeStyle='#f47c89';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(42,h-24);ctx.bezierCurveTo(w*.35,h-32,w*.65,h-21,w-42,h-28);ctx.stroke();ctx.globalAlpha=.45;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(51,h-18);ctx.lineTo(w-53,h-23);ctx.stroke();ctx.restore();rays(w-35,27);
 }
 ctx.restore();
}
function drawItem(ctx,o){ctx.save();ctx.translate(o.x,o.y);if(o.type==='image'){const im=images.get(o.src);if(im)ctx.drawImage(im,0,0,o.w,o.h)}else{const l=layout(o),r=o.f/100;ctx.scale(r,r);drawFrame(ctx,o,l.w,l.h);ctx.font=fontString(o);ctx.textBaseline='alphabetic';ctx.textAlign='left';ctx.lineJoin='round';ctx.miterLimit=2;const sw=o.outline/r,sh=o.shadow/r;for(let i=0;i<l.lines.length;i++){const x=l.pad,y=l.pad+84+i*100*o.lineHeight;if(sh){ctx.fillStyle=o.shadowColor;ctx.strokeStyle=o.shadowColor;ctx.lineWidth=2*sw;if(sw)paintText(ctx,l.lines[i],x+sh,y+sh,l.spacing,'strokeText');paintText(ctx,l.lines[i],x+sh,y+sh,l.spacing,'fillText')}ctx.strokeStyle=o.stroke;ctx.lineWidth=2*sw;if(sw)paintText(ctx,l.lines[i],x,y,l.spacing,'strokeText');ctx.fillStyle=o.fill;paintText(ctx,l.lines[i],x,y,l.spacing,'fillText')}}ctx.restore()}
function render(){const stage=$('stage');if(stage.hidden)return;const available=Math.max(80,stage.clientWidth-78),availableHeight=Math.max(80,stage.clientHeight-140);const zoomValue=$('zoom').value,fitScale=Math.min(available/state.board.w,availableHeight/state.board.h);scale=fitScale*(zoomValue==='fit'?1:Number(zoomValue));const w=state.board.w*scale,h=state.board.h*scale,dpr=Math.min(window.devicePixelRatio||1,2),c=$('board');c.style.width=w+'px';c.style.height=h+'px';c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);const ctx=c.getContext('2d');ctx.scale(c.width/state.board.w,c.height/state.board.h);ctx.fillStyle=state.board.bg;ctx.fillRect(0,0,state.board.w,state.board.h);if($('grid').checked){ctx.beginPath();ctx.strokeStyle='#ffffff17';ctx.lineWidth=.6/scale;for(let x=100;x<state.board.w;x+=100){ctx.moveTo(x,0);ctx.lineTo(x,state.board.h)}for(let y=100;y<state.board.h;y+=100){ctx.moveTo(0,y);ctx.lineTo(state.board.w,y)}ctx.stroke()}state.items.forEach(o=>drawItem(ctx,o));const o=current();if(o){ctx.strokeStyle='#ffdb76';ctx.lineWidth=1.5/scale;ctx.setLineDash([5/scale,4/scale]);ctx.strokeRect(o.x,o.y,o.w,o.h);ctx.setLineDash([]);ctx.beginPath();ctx.arc(o.x+o.w,o.y+o.h,6/scale,0,Math.PI*2);ctx.fillStyle='#ffc94f';ctx.fill();ctx.strokeStyle='#304354';ctx.stroke()}$('ruler').innerHTML=`<span>0</span><span>${state.board.w/20} cm</span><span>${state.board.w/10} cm</span>`;$('boardCaption').textContent=`黑板 ${state.board.w/10} × ${state.board.h/10} cm · 仅按比例展示`}
// 左侧设置保持独立折叠，编辑区使用任务分页。
document.querySelectorAll('#settingsBody > .section').forEach((section,index)=>{
  let heading=section.firstElementChild;
  if(heading.tagName==='LABEL'){
    const replacement=document.createElement('div');replacement.className=heading.className;
    replacement.append(...heading.childNodes);heading.replaceWith(replacement);heading=replacement;
  }
  heading.classList.add('section-heading');
  const button=document.createElement('button');button.type='button';button.className='section-toggle';
  button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
  const contents=[...section.children].filter(child=>child!==heading);
  contents.forEach((child,i)=>{if(!child.id)child.id=`section-${index}-content-${i}`});
  button.setAttribute('aria-controls',contents.map(child=>child.id).join(' '));
  const update=()=>{
    const collapsed=section.classList.contains('is-folded');
    button.removeAttribute('title');button.setAttribute('aria-label',collapsed?'展开':'收起');button.setAttribute('aria-expanded',String(!collapsed));
  };
  button.onclick=()=>{section.classList.toggle('is-folded');update()};
  heading.append(button);update();
});
function setVal(id,v){if(document.activeElement!==$(id))$(id).value=v}
function round(n){return Math.round(n*10)/10}
function syncEffectControls(o){const enabled={Outline:o.outlineEnabled??o.outline>0,Shadow:o.shadowEnabled??o.shadow>0};for(const name of ['Outline','Shadow']){$('enable'+name).checked=enabled[name];$(name.toLowerCase()+'Options').hidden=!enabled[name]}}
function renderStyleSamples(o){syncEffectControls(o);const frame=o.frame||'none';$('currentFrameName').textContent=borderPresets.querySelector(`[data-outline-style="${frame}"] small`)?.textContent||'无边框';document.querySelectorAll('[data-sample]').forEach(c=>{const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle=state.board.bg;ctx.fillRect(0,0,c.width,c.height);const sample={...o,...outlineStyles[c.dataset.sample],text:'板贴',x:0,y:0,f:100,letterSpacing:0,vertical:false,lineHeight:1.15};resizeText(sample);const r=Math.min((c.width-14)/sample.w,(c.height-10)/sample.h);ctx.save();ctx.translate((c.width-sample.w*r)/2,(c.height-sample.h*r)/2);ctx.scale(r,r);drawItem(ctx,sample);ctx.restore()})}

function sync(){setVal('bw',state.board.w/10);setVal('bh',state.board.h/10);setVal('bg',state.board.bg);$('count').textContent=state.items.length+' 张';$('undo').disabled=!history.length;$('redo').disabled=!future.length;const o=current();for(const id of ['duplicate','delete','front'])$(id).disabled=!o;$('noSelection').hidden=!!o;$('editor').hidden=!o;if(o){const isText=o.type==='text';$('textLayoutControls').hidden=!isText;for(const button of [...inspectorTabs.children].slice(1))button.disabled=!isText;if(!isText)inspectorPage=0;selectInspectorPage(inspectorPage);$('layoutGroupTitle').textContent=isText?'文字与排版':'板贴尺寸';for(const [id,key]of [['ow','w'],['oh','h']])setVal(id,round(o[key]/10));if(isText){renderStyleSamples(o);for(const key of ['text','font','fill','paperFill','stroke','outline','shadow','shadowColor','lineHeight','letterSpacing'])setVal(key,key==='paperFill'?(o.paperFill||'#fff8ec'):o[key]);$('outlineValue').textContent=round(o.outline)+' mm';$('shadowValue').textContent=round(o.shadow)+' mm';$('letterSpacingValue').textContent=round(o.letterSpacing||0)+' mm';$('lineHeightValue').textContent=Math.round(o.lineHeight*100)/100+'×';for(const key of ['bold','italic','vertical'])$(key).checked=o[key];document.querySelectorAll('[data-outline-style]').forEach(b=>{const s=outlineStyles[b.dataset.outlineStyle];b.classList.toggle('active',s.frame===(o.frame||'none'));b.setAttribute('aria-pressed',String(s.frame===(o.frame||'none')))})}const outside=o.x<0||o.y<0||o.x+o.w>state.board.w+.01||o.y+o.h>state.board.h+.01;$('selectionInfo').textContent=`${outside?'⚠ 超出黑板 · ':''}板贴 ${round(o.w/10)} × ${round(o.h/10)} cm · 占黑板宽 ${round(o.w/state.board.w*100)}%`}else $('selectionInfo').textContent='点击板贴，开始编辑';$('objects').replaceChildren();state.items.forEach(o=>{const b=document.createElement('button');b.className='object-row'+(o.id===selected?' active':'');const s=document.createElement('span');s.textContent=(o.type==='image'?'▧ '+o.name:'✎ '+o.text.replace(/\n/g,' '));const sm=document.createElement('small');sm.textContent=round(o.w/10)+' cm';b.append(s,sm);b.onclick=()=>{selected=o.id;render();sync();if(view==='print')preview()};$('objects').append(b)});if(!state.items.length)$('objects').textContent='还没有板贴，添加一张吧。'}
function number(id,min,max,fallback){const n=Number($(id).value);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback}
function options(){const sizes={A4:[210,297],A3:[297,420],A2:[420,594],A1:[594,841],A0:[841,1189],B3:[353,500],B2:[500,707],B1:[707,1000],B0:[1000,1414]};let [pw,ph]=sizes[$('paper').value]||sizes.A1;if($('orientation').value==='landscape')[pw,ph]=[ph,pw];return {pw,ph,m:number('margin',5,30,10),printBorder:$('printBorder').checked,dpi:EXPORT_DPI}}
function packItems(items,cw,ch,gap=5){const invalid=items.filter(o=>o.w>cw+.01||o.h>ch+.01),fit=items.filter(o=>!invalid.includes(o)).sort((a,b)=>b.h-a.h||b.w-a.w),bins=[];for(const o of fit){let target=null,best=Infinity;for(const bin of bins)for(const shelf of bin.shelves)if(o.h<=shelf.h+.01&&shelf.x+o.w<=cw+.01){const waste=cw-shelf.x-o.w;if(waste<best){best=waste;target={bin,shelf}}}if(!target)for(const bin of bins){const last=bin.shelves.at(-1),y=last?last.y+last.h+gap:0;if(y+o.h<=ch+.01){const shelf={x:0,y,h:o.h};bin.shelves.push(shelf);target={bin,shelf};break}}if(!target){const bin={shelves:[],placements:[]},shelf={x:0,y:0,h:o.h};bin.shelves.push(shelf);bins.push(bin);target={bin,shelf}}target.bin.placements.push({o,x:target.shelf.x,y:target.shelf.y});target.shelf.x+=o.w+gap}return {bins,invalid}}
function plan(){const p=options(),cw=p.pw-2*p.m,ch=p.ph-2*p.m-8,mode=$('mode').value;if(mode==='packed'){const packed=packItems(state.items,cw,ch),pages=packed.bins.map((bin,i)=>({...p,cw,ch,packed:true,placements:bin.placements,name:`自动拼版 · 第 ${i+1} 页`}));return {pages,total:pages.length,p,groups:[],invalid:packed.invalid}}const groups=mode==='board'?[{w:state.board.w,h:state.board.h,items:state.items,name:'整板',x:0,y:0}]: (mode==='all'?state.items:(current()?[current()]:[])).map(o=>({w:o.w,h:o.h,x:o.x,y:o.y,items:[o],name:'板贴 '+(state.items.indexOf(o)+1)}));let pages=[],total=0;groups.forEach(g=>{const cols=Math.max(1,Math.ceil((g.w-1e-7)/cw)),rows=Math.max(1,Math.ceil((g.h-1e-7)/ch));total+=cols*rows;if(total<=500)for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)pages.push({...p,cw,ch,g,r,c,rows,cols,x:c*cw,y:r*ch})});return {pages,total,p,groups,invalid:[]}}
function drawPage(page,ppm){const c=document.createElement('canvas');c.width=Math.round(page.pw*ppm);c.height=Math.round(page.ph*ppm);const art=document.createElement('canvas');art.width=c.width;art.height=c.height;const artCtx=art.getContext('2d');artCtx.scale(art.width/page.pw,art.height/page.ph);artCtx.save();artCtx.beginPath();artCtx.rect(page.m,page.m,page.cw,page.ch);artCtx.clip();if(page.packed){artCtx.translate(page.m,page.m);page.placements.forEach(({o,x,y})=>{artCtx.save();artCtx.translate(x-o.x,y-o.y);drawItem(artCtx,o);artCtx.restore()})}else{artCtx.translate(page.m-page.x-page.g.x,page.m-page.y-page.g.y);page.g.items.forEach(o=>drawItem(artCtx,o))}artCtx.restore();const ctx=c.getContext('2d');ctx.scale(c.width/page.pw,c.height/page.ph);ctx.fillStyle='#fff';ctx.fillRect(0,0,page.pw,page.ph);ctx.save();ctx.beginPath();ctx.rect(page.m,page.m,page.cw,page.ch);ctx.clip();if(page.printBorder){const mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;const maskCtx=mask.getContext('2d');maskCtx.drawImage(art,0,0);maskCtx.globalCompositeOperation='source-in';maskCtx.fillStyle=state.board.bg;maskCtx.fillRect(0,0,mask.width,mask.height);for(let i=0;i<16;i++){const a=i*Math.PI/8;ctx.drawImage(mask,Math.cos(a),Math.sin(a),page.pw,page.ph)}}ctx.drawImage(art,0,0,page.pw,page.ph);ctx.restore();return c}
async function preview(){const version=++previewVersion,q=plan();$('pages').replaceChildren();if(q.invalid.length){const n=document.createElement('p');n.className='notice';n.textContent=`有 ${q.invalid.length} 张板贴大于可打印区域，自动拼版已跳过。请改用更大纸张、调整方向或缩小板贴。`;$('pages').append(n)}if(q.total>500){$('pages').textContent='超过 500 页，请选择单张板贴或调整设计尺寸。';return}for(const p of q.pages.slice(0,60)){if(version!==previewVersion)return;const card=document.createElement('div');card.className='page-card';const c=drawPage(p,.7);const label=document.createElement('div');label.textContent=p.packed?`${p.name} · ${p.placements.length} 张`:`${p.g.name} · ${p.r+1} 行 ${p.c+1} 列`;card.append(c,label);$('pages').append(card);await new Promise(r=>setTimeout(r,0))}if(q.total>60){const n=document.createElement('p');n.textContent='仅预览前 60 页，导出包含全部页面。';$('pages').append(n)}}
function switchView(v){view=v;$('editSection').hidden=v==='print';$('printSection').hidden=v!=='print';$('rightTitle').textContent=v==='print'?'打印设置':'编辑板贴';$('stage').hidden=v!=='design';$('printView').hidden=v!=='print';$('designTab').classList.toggle('active',v==='design');$('printTab').classList.toggle('active',v==='print');$('zoom').disabled=v==='print';if(v==='print')preview();else{previewVersion++;render()}}
$('designTab').onclick=()=>switchView('design');$('printTab').onclick=()=>switchView('print');function closeExportMenu(){$('exportMenu').hidden=true;$('topPrint').setAttribute('aria-expanded','false')}$('topPrint').onclick=e=>{e.stopPropagation();const open=$('exportMenu').hidden;$('exportMenu').hidden=!open;$('topPrint').setAttribute('aria-expanded',String(open))};$('exportMenu').onclick=e=>e.stopPropagation();document.addEventListener('click',closeExportMenu);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeExportMenu()});$('zoom').onchange=render;$('grid').onchange=render;
for(const id of ['bw','bh','bg'])$(id).onchange=()=>change(()=>{state.board.w=number('bw',20,2000,400)*10;state.board.h=number('bh',20,1000,120)*10;state.board.bg=$('bg').value;$(id).blur()});
document.querySelectorAll('[data-board]').forEach(b=>b.onclick=()=>change(()=>{const [w,h]=b.dataset.board.split(',').map(Number);state.board.w=w*10;state.board.h=h*10}));
$('addText').onclick=()=>change(()=>{const o=newText();o.x=Math.max(0,(state.board.w-o.w)/2);o.y=Math.max(0,(state.board.h-o.h)/2);state.items.push(o);selected=o.id;switchView('design')});
for(const name of ['Outline','Shadow'])$('enable'+name).onchange=()=>{const o=current();if(!o||o.type!=='text')return;change(()=>{const on=$('enable'+name).checked;o[name.toLowerCase()+'Enabled']=on;if(name==='Outline')o.outline=on?(o.lastOutline||3):(o.lastOutline=o.outline,0);if(name==='Shadow')o.shadow=on?(o.lastShadow||5):(o.lastShadow=o.shadow,0);resizeText(o)})};
for(const id of ['font','fill','paperFill','stroke','shadowColor','bold','italic','vertical'])$(id).onchange=()=>{const o=current();if(!o||o.type!=='text')return;change(()=>{if(['bold','italic','vertical'].includes(id))o[id]=$(id).checked;else o[id]=$(id).value;resizeText(o)})};
const textField=$('text');
textField.oninput=()=>{const o=current();if(!o||o.type!=='text')return;if(!textEdit||textEdit.id!==o.id){checkpoint();textEdit={id:o.id}}o.text=textField.value;resizeText(o);render();sync();scheduleTextSave()};
textField.onblur=finishTextEdit;
textField.onkeydown=e=>{if(e.key!=='Enter'||e.isComposing||e.keyCode===229)return;e.preventDefault();if(e.ctrlKey){const start=textField.selectionStart,end=textField.selectionEnd;textField.setRangeText('\n',start,end,'end');textField.dispatchEvent(new Event('input',{bubbles:true}));return}textField.blur()};
for(const id of ['outline','shadow','letterSpacing','lineHeight'])$(id).oninput=()=>{const o=current();if(!o||o.type!=='text')return;change(()=>{if(id==='lineHeight')o.lineHeight=number(id,1,3,1.15);else{const max=id==='outline'?100:id==='letterSpacing'?50:30;o[id]=number(id,0,max,0);if(id==='outline'||id==='shadow')o[id+'Enabled']=true}resizeText(o)})};
for(const [id,key]of [['ow','w'],['oh','h']])$(id).onchange=()=>{const o=current();if(!o)return;change(()=>{const val=number(id,.5,2000,1)*10,r=val/o[key];o.w*=r;o.h*=r;if(o.type==='text'){o.f*=r;o.outline*=r;o.shadow*=r;o.letterSpacing=(o.letterSpacing||0)*r}$(id).blur()})};
$('duplicate').onclick=()=>{const o=current();if(o)change(()=>{const c=clone(o);c.id=uid();c.x+=30;c.y+=30;state.items.push(c);selected=c.id})};$('delete').onclick=()=>{if(current())change(()=>{state.items=state.items.filter(o=>o.id!==selected);selected=state.items.at(-1)?.id||null})};$('front').onclick=()=>{const o=current();if(o)change(()=>{state.items=state.items.filter(x=>x!==o);state.items.push(o)})};$('undo').onclick=()=>undo();$('redo').onclick=()=>undo(true);
document.querySelectorAll('[data-style]').forEach(b=>b.onclick=()=>{const o=current();if(!o||o.type!=='text'){return}change(()=>{const a=colorStyles[b.dataset.style];[o.fill,o.stroke,o.shadowColor,o.paperFill]=a;resizeText(o)})});
document.querySelectorAll('[data-outline-style]').forEach(b=>b.onclick=()=>{const o=current();if(!o||o.type!=='text'){return}change(()=>{Object.assign(o,outlineStyles[b.dataset.outlineStyle]);resizeText(o)})});
function point(e){const r=$('board').getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*state.board.w,y:(e.clientY-r.top)/r.height*state.board.h}}
$('board').onpointerdown=e=>{if(busy)return;const p=point(e),o=current();if(o&&Math.hypot(p.x-o.x-o.w,p.y-o.y-o.h)<14/scale){checkpoint();drag={kind:'size',start:p,o,startO:clone(o)}}else{const hit=[...state.items].reverse().find(o=>p.x>=o.x&&p.x<=o.x+o.w&&p.y>=o.y&&p.y<=o.y+o.h);selected=hit?.id||null;if(hit){checkpoint();drag={kind:'move',start:p,o:hit,startO:clone(hit)}}}e.currentTarget.setPointerCapture(e.pointerId);render();sync()};
$('board').onpointermove=e=>{if(!drag)return;const p=point(e),{o,startO:s,start}=drag;if(drag.kind==='move'){o.x=Math.max(0,Math.min(Math.max(0,state.board.w-o.w),s.x+p.x-start.x));o.y=Math.max(0,Math.min(Math.max(0,state.board.h-o.h),s.y+p.y-start.y))}else{const r=Math.max(.03,Math.min(20,(p.x-s.x)/s.w));o.w=s.w*r;o.h=s.h*r;if(o.type==='text'){o.f=s.f*r;o.outline=s.outline*r;o.shadow=s.shadow*r;o.letterSpacing=(s.letterSpacing||0)*r}}render();sync()};
function endDrag(){if(drag){drag=null;commit()}}$('board').onpointerup=endDrag;$('board').onpointercancel=endDrag;
document.addEventListener('keydown',e=>{if(busy||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||$('clearDialog').open)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo(e.shiftKey)}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('delete').click()}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&current()){e.preventDefault();change(()=>{const o=current(),d=e.shiftKey?10:1;o.x=Math.max(0,o.x+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0));o.y=Math.max(0,o.y+(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0))})}});
for(const id of ['paper','orientation','mode','margin','printBorder'])$(id).onchange=()=>{if(view==='print')preview()};
async function loadImage(src){if(images.has(src))return images.get(src);const im=new Image();im.src=src;await im.decode();images.set(src,im);return im}
function readData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
$('imageFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>20*1024*1024)throw Error('请使用 20 MB 以内的 PNG、JPG 或 WebP 图片');let src=await readData(f),im=await loadImage(src);if(im.width*im.height>16000000){const c=document.createElement('canvas'),r=Math.sqrt(16000000/(im.width*im.height));c.width=im.width*r;c.height=im.height*r;c.getContext('2d').drawImage(im,0,0,c.width,c.height);src=c.toDataURL('image/png');im=await loadImage(src)}change(()=>{const o={id:uid(),type:'image',name:f.name,src,x:100,y:100,w:Math.min(500,state.board.w/2),h:0};o.h=o.w*im.height/im.width;state.items.push(o);selected=o.id;switchView('design')})}catch(err){}e.target.value=''};
const download=MimiCommon.download;
$('save').onclick=()=>{MimiCommon.backup(state)};$('open').onclick=()=>$('projectFile').click();
function validate(s){if(s?.version!==1||!s.board||!Array.isArray(s.items)||s.items.length>200)throw Error('不是有效的板贴作品');const num=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);if(!num(s.board.w,200,20000)||!num(s.board.h,200,10000)||!color(s.board.bg))throw Error('黑板参数不正确');const ids=new Set();for(const o of s.items){if(typeof o.id!=='string'||ids.has(o.id)||!num(o.x,0,100000)||!num(o.y,0,100000)||!num(o.w,.01,100000)||!num(o.h,.01,100000))throw Error('板贴尺寸不正确');ids.add(o.id);if(o.type==='text'){if(o.paperFill!=null&&!color(o.paperFill))throw Error('底纸颜色不正确');if(o.frame!=null&&!outlineStyles[o.frame])throw Error('外框样式不正确');if(o.letterSpacing==null)o.letterSpacing=0;if(typeof o.text!=='string'||o.text.length>400||!fonts[o.font]||!num(o.f,.01,100000)||!num(o.outline,0,10000)||!num(o.shadow,0,10000)||!num(o.letterSpacing,0,1000)||!num(o.lineHeight,1,3)||![o.fill,o.stroke,o.shadowColor].every(color))throw Error('文字参数不正确');resizeText(o)}else if(o.type==='image'){if(typeof o.src!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(o.src)||o.src.length>30000000)throw Error('图片数据不正确');o.name=String(o.name||'图片').slice(0,200)}else throw Error('未知板贴类型')}return s}
async function restore(s){s=validate(s);for(const o of s.items)if(o.type==='image')await loadImage(o.src);checkpoint();state=s;selected=s.items[0]?.id||null;commit()}
$('projectFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>80000000)throw Error('作品文件超过 80 MB');await restore(JSON.parse(await f.text()));}catch(err){}e.target.value=''};
function clearProject(){change(()=>{state=clone(initial);selected=null});$('clearDialog').close();}
$('clearProject').onclick=()=>{if(settingsController.get().confirmDanger)$('clearDialog').showModal();else clearProject()};$('cancelClear').onclick=()=>$('clearDialog').close();$('confirmClear').onclick=clearProject;
const enc=new TextEncoder(),bytes=s=>enc.encode(s),join=arr=>{const n=arr.reduce((s,a)=>s+a.length,0),r=new Uint8Array(n);let pos=0;for(const a of arr){r.set(a,pos);pos+=a.length}return r};
function dataBytes(url){return Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0))}
// Minimal PDF writer: each page contains a high-resolution, fixed-size JPEG. No network dependencies.
function makePdf(pages,pw,ph){const W=pw*72/25.4,H=ph*72/25.4,objects=[null,bytes('<< /Type /Catalog /Pages 2 0 R >>'),null];const refs=[];pages.forEach(p=>{const page=objects.length,im=page+1,stream=page+2;refs.push(page);objects.push(bytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im ${im} 0 R >> >> /Contents ${stream} 0 R >>`));objects.push(join([bytes(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.data.length} >>\nstream\n`),p.data,bytes('\nendstream')]));const content=`q ${W} 0 0 ${H} 0 0 cm /Im Do Q`;objects.push(bytes(`<< /Length ${bytes(content).length} >>\nstream\n${content}\nendstream`))});objects[2]=bytes(`<< /Type /Pages /Count ${refs.length} /Kids [${refs.map(n=>n+' 0 R').join(' ')}] >>`);const chunks=[bytes('%PDF-1.4\n%MIMI\n')],offsets=[0];let offset=chunks[0].length;for(let i=1;i<objects.length;i++){offsets[i]=offset;const b=join([bytes(`${i} 0 obj\n`),objects[i],bytes('\nendobj\n')]);chunks.push(b);offset+=b.length}const xref=offset;chunks.push(bytes(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));return new Blob(chunks,{type:'application/pdf'})}
function makeDocx(pages,pw,ph){const cx=Math.round(pw*36000),cy=Math.round(ph*36000);const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';const files=[['[Content_Types].xml',xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],['_rels/.rels',xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>']];let rel='',body='';pages.forEach((p,i)=>{files.push([`word/media/page${i}.jpg`,p.data]);rel+=`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${i}.jpg"/>`;body+=`<w:p><w:pPr>${i?'<w:pageBreakBefore/>':''}<w:spacing w:before="0" w:after="0" w:line="1" w:lineRule="exact"/></w:pPr><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${cx}" cy="${cy}"/><wp:wrapNone/><wp:docPr id="${i+1}" name="Page ${i+1}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${i+1}" name="Page ${i+1}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${i+1}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`});body+=`<w:sectPr><w:pgSz w:w="${Math.round(pw/25.4*1440)}" w:h="${Math.round(ph/25.4*1440)}"${pw>ph?' w:orient="landscape"':''}/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>`;files.push(['word/document.xml',xml+`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}</w:body></w:document>`],['word/_rels/document.xml.rels',xml+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`]);return MimiCommon.zip(files,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
async function exportDocument(format){if(busy)return;const q=plan();if(q.invalid.length){return}if(!q.total){return}if(q.total>150){return}busy=true;$('busyDialog').showModal();try{await document.fonts.ready;const pages=[];for(let i=0;i<q.pages.length;i++){$('progressText').textContent=`正在生成第 ${i+1} / ${q.total} 页`;$('progress').value=(i+1)/q.total*100;await new Promise(r=>setTimeout(r,10));const c=drawPage(q.pages[i],q.p.dpi/25.4);pages.push({width:c.width,height:c.height,data:dataBytes(c.toDataURL('image/jpeg',.94))});c.width=c.height=1}download(format==='pdf'?makePdf(pages,q.p.pw,q.p.ph):makeDocx(pages,q.p.pw,q.p.ph),`咪咪板贴_${$('paper').value}.${format}`);}catch(e){}finally{busy=false;$('busyDialog').close()}}
$('busyDialog').addEventListener('cancel',e=>e.preventDefault());$('exportPdf').onclick=()=>{closeExportMenu();exportDocument('pdf')};$('exportDocx').onclick=()=>{closeExportMenu();exportDocument('docx')};
$('exportPng').onclick=()=>{closeExportMenu();const o=current();if(!o){return}const ppm=EXPORT_DPI/25.4,w=Math.ceil(o.w*ppm),h=Math.ceil(o.h*ppm);if(w*h>40000000||w>16000||h>16000){return}const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.scale(w/o.w,h/o.h);ctx.translate(-o.x,-o.y);drawItem(ctx,o);c.toBlob(b=>{if(b){download(b,`板贴_${round(o.w/10)}x${round(o.h/10)}cm.png`);}},'image/png')};
const workspaceUi=(()=>{try{return JSON.parse(localStorage.getItem('mimi-board-ui-v1')||'{}')}catch{return{}}})();
function saveWorkspaceUi(){try{localStorage.setItem('mimi-board-ui-v1',JSON.stringify(workspaceUi))}catch{}}
MimiWorkspace.mount({read:()=>workspaceUi,write:saveWorkspaceUi,onMobilePanel:panel=>{if(panel==='board'&&view==='design')render()}});
new ResizeObserver(()=>{if(view==='design')render()}).observe($('stage'));
(async()=>{try{const saved=localStorage.getItem('mimi-board-v1');if(saved){const s=validate(JSON.parse(saved));for(const o of s.items)if(o.type==='image')await loadImage(o.src);state=s;selected=state.items[0]?.id||null;$('saveStatus').textContent='● 已恢复上次的作品'}}catch{$('saveStatus').textContent='● 暂存不可用，请保存作品文件'}await document.fonts.ready;state.items.forEach(resizeText);render();sync()})();
