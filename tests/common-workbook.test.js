const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const XLSX=require('xlsx');

test('公共工作簿读取器识别多工作表 XLS，并提供显示值和原始值',async()=>{
  const context={window:{XLSX},Blob,TextDecoder,TextEncoder,URL,setTimeout,clearTimeout};
  vm.runInNewContext(fs.readFileSync('src/renderer/scripts/mimi-common.js','utf8'),context);
  const book=XLSX.utils.book_new();
  const roster=XLSX.utils.aoa_to_sheet([['姓名','学号'],['张小雨',42]]);
  roster.B2.z='00000';
  XLSX.utils.book_append_sheet(book,roster,'名单');
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['姓名'],['王一鸣']]),'二班');
  const bytes=XLSX.write(book,{bookType:'xls',type:'buffer'});
  const file={name:'学生.xls',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
  const sheets=await context.window.MimiCommon.roster.readWorkbook(file);
  assert.deepEqual(Array.from(sheets,sheet=>sheet.name),['名单','二班']);
  assert.equal(sheets[0].rows()[1][1],'00042');
  assert.equal(sheets[1].rows()[1][0],'王一鸣');
  const raw=await context.window.MimiCommon.roster.readWorkbook(file,{raw:true});
  assert.equal(raw[0].rows()[1][1],42);
});
