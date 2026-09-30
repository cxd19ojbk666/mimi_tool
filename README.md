# 咪咪大王工具箱

## Electron 桌面版

项目已封装为 Electron 桌面应用。首次构建前先安装依赖：

```bash
npm install
```

本地运行：

```bash
npm start
```

构建 macOS ARM64 版（`.app` 会在 `dist/mac-arm64` 中，同时生成 DMG 和 ZIP）：

```bash
npm run build:mac
```

构建 Windows x64 版（同时生成 NSIS 安装版和便携版 EXE）：

```bash
npm run build:win
```

构建结果统一位于 `dist` 目录。正式对外发布前，建议分别配置 Apple Developer ID 和 Windows 代码签名证书。

项目源码统一放在 `src`，根目录只保留项目说明、依赖清单和构建配置。

## 目录结构

```text
.
├── assets/                  # 应用图标等品牌资源
├── src/
│   ├── main/                # Electron 主进程
│   │   └── main.js
│   └── renderer/            # 渲染进程与页面资源
│       ├── index.html       # 工具箱首页
│       ├── pages/           # 各业务工具页面
│       ├── scripts/         # 共享前端脚本
│       └── styles/          # 共享样式
├── dist/                    # 构建产物（不提交）
├── package.json
└── README.md
```

`src/renderer` 是所有“咪咪大王”工具的公共 UI 层。业务页只保留自己的画布、表单和业务逻辑。

## 点名器

从工具箱或桌面菜单进入“咪咪大王点名器”。支持手动粘贴名单，以及离线导入 `.xlsx`、`.txt`、`.csv`、`.tsv` 文件；Excel 可选择工作表。推荐使用“姓名、性别、小组”表头，纯姓名可一行一个，旧版 `.xls` 请先另存为 `.xlsx`。

可按男女生或指定小组点名，也可随机抽取整组。开启“已点过暂不重复”后，两种抽取方式共用本轮记录；已有成员被点到的小组暂不参加整组抽取。支持撤回上次、开启新一轮和导出记录，数据自动保存在本机。

点名器全部样式统一放在 `mimi-ui.css`，使用 `mimi-common.js` 和 `mimi-workspace.js` 的公共品牌、消息提示及侧栏交互。名单解析与抽取算法由 `MimiCommon.roster` 提供，点名交互在 `mimi-workspace.js` 中按页面标记挂载，不使用独立的点名脚本或样式文件。

## 做表格

从工具箱或桌面菜单进入“咪咪大王做表格”。支持离线导入多个 `.xlsx`、`.csv`、`.tsv` 和 `.txt` 文件，也能粘贴名单或多列表格；每个 Excel 工作表会独立成为一张 `df` 数据表。提供四项任务：多表智能匹配、名单对比、脏表格整理和成绩可视化。

智能匹配与名单对比可选择一个主表及任意多张参与表，添加多个匹配列，并分别勾选每张表要输出的字段。例如将语文、数学、英语三张成绩表按“学号＋班级”一次汇总。智能匹配保留主表行数，为每张参与表给出已匹配、未匹配、空键或重复冲突状态，不会对重复键静默取第一条；名单对比汇总各表的匹配键，标出缺失、重复和已勾选同名字段的内容变化。空匹配键也会单列待检查。

Excel 表格支持多级表头和合并单元格；如自动识别有误，可在数据表的“表头设置”中调整起始行与层数。多表结果会重建表头层级，并继承所选来源列的常用单元格样式、数字格式、列宽、行高与表头合并区域。纯 CSV/TSV/TXT 输入沿用主表的文本文件格式导出；只要参与表中有 XLSX，结果会导出为 XLSX，以容纳格式信息。原文件不会被覆盖。公式会以 Excel 保存的计算结果写入新表；未缓存结果的公式会提示重新计算并保存。工作簿中的图形、图表和复杂条件格式不会复制到新的结果表。

界面按“选择任务 → 添加数据 → 设置规则 → 查看结果”组织。导入数据前仅显示任务和入口；数据足够后才显示规则与底部生成按钮。输出字段和匹配选项可按需展开，保存与导出放在结果预览旁。

表格整理支持清除空白、删除空行空列及重复记录；成绩分析会生成成绩分布、各科平均分和学生排名三张 ECharts 图表。处理结果可预览、存为新数据表并导出。

## 文件

- `src/renderer/styles/mimi-ui.css`：设计变量、通用控件、三栏工作台和响应式规则。
- `src/renderer/scripts/mimi-common.js`：品牌文案、通用操作名称、消息提示及备份下载。
- `src/renderer/scripts/mimi-workspace.js`：侧栏折叠、栏宽调整、移动端导航及状态持久化。

## HTML 契约

```html
<link rel="stylesheet" href="../styles/mimi-ui.css">
<script src="../scripts/mimi-workspace.js"></script>

<main class="workspace" id="workspace">
  <aside class="panel left left-panel" id="leftPanel"
    data-workspace-panel="left" data-mobile-panel-name="setup"></aside>
  <section class="panel center"
    data-workspace-panel="center" data-mobile-panel-name="canvas"></section>
  <aside class="panel right right-panel" id="rightPanel"
    data-workspace-panel="right" data-mobile-panel-name="edit"></aside>
  <div class="panel-resizer left" id="leftResizer" role="separator" tabindex="0"></div>
  <div class="panel-resizer right" id="rightResizer" role="separator" tabindex="0"></div>
</main>
```

侧栏开关使用 `hideLeft` / `showLeft` / `hideRight` / `showRight` ID。移动端导航按钮使用 `data-mobile-panel`，值必须与目标面板的 `data-mobile-panel-name` 相同。

## 接入行为

```js
const controller = MimiWorkspace.mount({
  read: () => uiState,
  write: () => saveUiState(),
  toast: message => showToast(message),
  labels: {left: '设置栏', right: '编辑栏'},
  onMobilePanel: panel => console.log(panel)
});
```

`read` 返回的对象由页面自行持久化，可包含 `leftWidth`、`rightWidth`、`leftHidden` 和 `rightHidden`。这使共享组件不依赖任何一个业务页的存储方式。

## 维护规则

1. 通用外观只修改 `src/renderer/styles/mimi-ui.css`，不得复制回业务 HTML。
2. 通用工作台交互只修改 `src/renderer/scripts/mimi-workspace.js`。
3. 业务页样式应以画布或业务组件为作用域，避免重新定义 `.btn`、`.panel`、`.field` 等公共类。
4. 新工具使用相同 DOM 契约，仅通过变量和 `mount` 选项定制。

## 通用内容约定

两个页面均加载 `src/renderer/scripts/mimi-common.js`，在页面脚本开始时调用
`MimiCommon.init({action:'做板贴',subject:'板贴'})`（排座位使用 `排座位`）。
标题统一为“咪咪大王 + 动作”，副标题统一为“咪的汪给咪做的 + 工具名称 + 工具”。

公共按钮使用 `data-mimi-action="backup|restore|clear|export"`，统一显示“备份 / 恢复 / 清空 / 导出”。
清空按钮使用 `.btn.danger`，通过 `title` 和 `aria-label` 说明作用范围。
单格式导出保留“导出 PNG”等格式名称，多格式导出使用“导出”菜单。
业务状态和清空后的恢复方式由各页面负责。

`MimiCommon.toast(message)` 统一显示 4 秒提示；`MimiCommon.backup(data)`
统一生成“页面标题-备份-日期.json”并提示“备份已下载”。旧备份的数据结构及本地存储键保持兼容。
`MimiCommon.download(blob,name)` 共用下载和临时 URL 释放逻辑。
