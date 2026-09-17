# 咪咪工具共享组件

这个目录是所有“咪咪大王”工具的公共 UI 层。业务页只保留自己的画布、表单和业务逻辑。

## 文件

- `mimi-ui.css`：设计变量、通用控件、三栏工作台和响应式规则。
- `mimi-workspace.js`：侧栏折叠、栏宽调整、移动端导航及状态持久化。

## HTML 契约

```html
<link rel="stylesheet" href="../共享组件/mimi-ui.css">
<script src="../共享组件/mimi-workspace.js"></script>

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

1. 通用外观只修改 `mimi-ui.css`，不得复制回业务 HTML。
2. 通用工作台交互只修改 `mimi-workspace.js`。
3. 业务页样式应以画布或业务组件为作用域，避免重新定义 `.btn`、`.panel`、`.field` 等公共类。
4. 新工具使用相同 DOM 契约，仅通过变量和 `mount` 选项定制。
