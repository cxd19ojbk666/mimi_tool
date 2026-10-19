// 咪咪工具 CSS 重复扫描：只做报告，不改样式。
// 用法：node tools/css-report.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 项目根目录（tools/ 上一级）
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const styleDir = join(root, 'src/renderer/styles');
const files = readdirSync(styleDir).filter((f) => f.endsWith('.css'));

// 极简规则提取：忽略 @media 头，只收顶层“选择器 { 声明 }”。
function rules(css) {
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const head = m[1].trim();
    if (!head || head.startsWith('@')) continue;
    for (const s of head.split(',')) {
      const sel = s.trim().replace(/\s+/g, ' ');
      if (sel) out.push({ selector: sel, body: m[2].trim() });
    }
  }
  return out;
}

const byFile = new Map();
for (const f of files) byFile.set(f, rules(readFileSync(join(styleDir, f), 'utf8')));

console.log('=== 同一文件内重复定义的选择器 ===');
for (const [f, list] of byFile) {
  const counts = new Map();
  list.forEach((r) => counts.set(r.selector, (counts.get(r.selector) || 0) + 1));
  const dup = [...counts].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  console.log(`\n${f}：规则 ${list.length} 条，重复选择器 ${dup.length} 个`);
  dup.slice(0, 14).forEach(([s, n]) => console.log(`   ${n}x  ${s.slice(0, 90)}`));
}

// 重点检查：mimi-ui.css 里的 table-maker 块与 mimi-table.css 的重名情况
const ui = byFile.get('mimi-ui.css') || [];
const tm = ui.filter((r) => r.selector.includes('table-maker'));
const mt = new Set((byFile.get('mimi-table.css') || []).map((r) => r.selector));
const shared = [...new Set(tm.map((r) => r.selector))].filter((s) => mt.has(s));
console.log(`\n=== mimi-ui.css(table-maker ${tm.length} 条) 与 mimi-table.css 重名：${shared.length} 个 ===`);
shared.slice(0, 20).forEach((s) => console.log('   ' + s.slice(0, 95)));
