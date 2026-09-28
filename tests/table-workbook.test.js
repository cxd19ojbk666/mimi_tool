const test=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const Workbook=require('../src/renderer/scripts/mimi-table-workbook');
const {merge}=require('../src/renderer/scripts/mimi-table-merge');

function makeSheet(name,subject,score,color){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet(name);
  sheet.mergeCells('A1:B1');sheet.getCell('A1').value='基本信息';
  sheet.mergeCells('C1:D1');sheet.getCell('C1').value='成绩';
  sheet.getRow(2).values=['学号','姓名',subject,'备注'];
  sheet.getRow(3).values=['01','小雨',score,'正常'];
  sheet.getCell('C3').numFmt='0.0';
  sheet.getCell('C3').font={name:'宋体',bold:true,color:{argb:color}};
  sheet.getCell('C3').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFFFF2CC'}};
  sheet.getCell('C3').alignment={horizontal:'center'};
  sheet.getCell('C3').border={bottom:{style:'thin',color:{argb:'FF336699'}}};
  sheet.getColumn(3).width=21;sheet.getRow(3).height=27;
  return sheet;
}

test('XLSX 导入后可识别多级合并表头，并手动覆盖起始行与层数',async()=>{
  const original=makeSheet('语文','语文',93,'FFCC0000');
  const book=new ExcelJS.Workbook();await book.xlsx.load(await original.workbook.xlsx.writeBuffer());
  const sheet=book.worksheets[0];
  assert.deepEqual(Workbook.suggestHeader(sheet),{start:1,depth:2});
  const table=Workbook.fromWorksheet(sheet);
  assert.deepEqual(table.headers,['基本信息 / 学号','基本信息 / 姓名','成绩 / 语文','成绩 / 备注']);
  assert.deepEqual(table.headerMerges,[{top:0,bottom:0,left:0,right:1},{top:0,bottom:0,left:2,right:3}]);
  assert.equal(table.columnWidths[2],21);
  assert.equal(table.rowHeights[0],27);
  assert.deepEqual(Workbook.fromWorksheet(sheet,{start:2,depth:1}).headers,['学号','姓名','语文','备注']);
});

test('三表汇总导出后保留各来源表头合并、列宽和单元格样式',async()=>{
  const sources=[
    {id:'df1',name:'语文',table:Workbook.fromWorksheet(makeSheet('语文','语文',93,'FFCC0000'))},
    {id:'df2',name:'数学',table:Workbook.fromWorksheet(makeSheet('数学','数学',88,'FF008800'))},
    {id:'df3',name:'英语',table:Workbook.fromWorksheet(makeSheet('英语','英语',91,'FF0000CC'))}
  ];
  const base={...sources[0],keys:[0,1],selected:[0,1,2,3]};
  const joins=[{...sources[1],keys:[0,1],selected:[2,3]},{...sources[2],keys:[0,1],selected:[2]}];
  const result=merge({mode:'match',base,joins});
  const layout=Workbook.buildLayout(result,sources);
  const blob=await Workbook.toXlsx(result,sources,layout);
  const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await blob.arrayBuffer());
  const sheet=reopened.worksheets[0];
  assert.equal(sheet.getCell('A1').value,'df1 · 语文');
  assert.equal(sheet.getCell('C2').value,'成绩');
  assert.equal(sheet.getCell('C3').value,'语文');
  assert.equal(sheet.getCell('E3').value,'数学');
  assert.equal(sheet.getCell('G3').value,'英语');
  assert.equal(sheet.getCell('C4').value,93);
  assert.equal(sheet.getCell('E4').value,88);
  assert.equal(sheet.getCell('G4').value,91);
  assert.equal(sheet.getCell('C4').numFmt,'0.0');
  assert.equal(sheet.getCell('E4').font.color.argb,'FF008800');
  assert.equal(sheet.getCell('G4').fill.fgColor.argb,'FFFFF2CC');
  assert.equal(sheet.getCell('G4').alignment.horizontal,'center');
  assert.equal(sheet.getCell('C4').border.bottom.style,'thin');
  assert.equal(sheet.getColumn(3).width,21);
  assert.equal(sheet.getRow(4).height,27);
  assert.ok(sheet.model.merges.includes('A2:B2'));
  assert.ok(sheet.model.merges.includes('A1:D1'));
});

test('CSV 源保持文本格式输出，表头层数仍可配置',async()=>{
  const table=Workbook.fromRows([['基础','成绩'],['姓名','数学'],['小雨',88]],{depth:2,format:'csv'});
  assert.deepEqual(table.headers,['基础 / 姓名','成绩 / 数学']);
  const blob=Workbook.toDelimited({headers:['姓名','数学'],rows:[['小雨',88]]},'csv');
  assert.match(await blob.text(),/姓名,数学\r\n小雨,88/);
});

test('只选合并表头中的部分列时，保留该组标题',async()=>{
  const table=Workbook.fromWorksheet(makeSheet('成绩','语文',93,'FFCC0000'));
  const base={id:'df1',name:'基准',table,keys:[0],selected:[1,2]};
  const join={id:'df2',name:'补充',table:Workbook.fromRows([['学号','英语'],['01',91]]),keys:[0],selected:[1]};
  const result=merge({mode:'match',base,joins:[join]});
  const layout=Workbook.buildLayout(result,[base,join]);
  const book=new ExcelJS.Workbook();await book.xlsx.load(await (await Workbook.toXlsx(result,[base,join],layout)).arrayBuffer());
  assert.equal(book.worksheets[0].getCell('A2').value,'基本信息');
  assert.equal(book.worksheets[0].getCell('B2').value,'成绩');
});

test('没有缓存结果的 Excel 公式会明确报错',()=>{
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('公式');
  sheet.getRow(1).values=['姓名','成绩'];sheet.getCell('A2').value='小雨';sheet.getCell('B2').value={formula:'40+50'};
  assert.throws(()=>Workbook.fromWorksheet(sheet),/未缓存结果的公式/);
});
