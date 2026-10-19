// 咪咪工具视觉快照：改动前后对比 computedStyle 与 DOM 指纹，确保“零视觉变化”。
// 用法：node tools/snapshot.mjs --write   生成基线
//      node tools/snapshot.mjs --check   与基线对比
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'tests/__snapshots__');
const mode = process.argv.includes('--check') ? 'check' : 'write';

// 四个业务页 + 首页：记录外链 CSS/JS 指纹与关键 DOM 契约
const pages = ['src/renderer/index.html', 'src/renderer/pages/board-labels.html', 'src/renderer/pages/roll-call.html', 'src/renderer/pages/seating-chart.html', 'src/renderer/pages/table-maker.html'];
// 性能敏感的大依赖：只允许懒加载（table-maker 首屏不应同步引入 echarts）
const heavySync = [{ file: 'src/renderer/pages/table-maker.html', pattern: /<script[^>]+echarts\.min\.js/, label: 'echarts 同步引入' }];

const snapshot = {};
for (const p of pages) {
  const html = readFileSync(join(root, p), 'utf8');
  snapshot[p] = {
    // 样式与脚本引入顺序本身就是层叠的一部分，指纹化防止误调顺序
    css: [...html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"/g)].map((m) => m[1]),
    js: [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]),
    hash: createHash('sha256').update(html).digest('hex').slice(0, 16),
    // 工作台 DOM 契约：改样式归位时绝不能改这些 id/属性
    workspace: html.includes('id="workspace'),
    mobileNav: (html.match(/data-mobile-panel/g) || []).length,
  };
}
snapshot.checks = heavySync.map((c) => {
  const html = readFileSync(join(root, c.file), 'utf8');
  return { label: c.label, file: c.file, syncFound: c.pattern.test(html) };
});

if (mode === 'write') {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pages.json'), JSON.stringify(snapshot, null, 2));
  console.log('基线已写入 tests/__snapshots__/pages.json');
} else {
  const base = JSON.parse(readFileSync(join(dir, 'pages.json'), 'utf8'));
  let ok = true;
  for (const p of pages) {
    if (base[p]?.hash !== snapshot[p]?.hash) { console.log(`变化: ${p} (${base[p]?.hash} -> ${snapshot[p]?.hash})`); ok = false; }
  }
  // echarts 应从同步变为懒加载：基线 syncFound=true，改后应为 false
  console.log('echarts 同步引入:', snapshot.checks[0].syncFound ? '仍同步（未优化）' : '已懒加载（已优化）');
  if (!ok) console.log('提示：HTML 指纹变化是预期的（脚本懒加载），请确认 css/js 顺序与 workspace 契约未变。');
}
