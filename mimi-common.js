/* 两个工具共用的品牌文案、操作名称、消息提示及文件下载。 */
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
  global.MimiCommon=Object.freeze({text,init,toast,download,backup});
})(window);
