/* 四个工具共用的界面偏好控制器。默认创建设置面板，也可绑定已有对话框。
 * read/write 适配业务状态；controls 适配旧控件名称，保留原存储键和备份格式。
 */
(function (global) {
  'use strict';

  // 默认偏好：与现有两处设置面板的默认值保持一致。
  var DEFAULTS = { font: 'round', scale: 'normal', compact: false, reduceMotion: false, confirmDanger: true };

  function normalize(saved, defaults) {
    saved = saved || {};
    const prefs = Object.assign({}, defaults, saved);
    prefs.font = ['round', 'hand', 'clear'].includes(saved.font) ? saved.font : defaults.font;
    prefs.scale = ['small', 'normal', 'large'].includes(saved.scale) ? saved.scale : defaults.scale;
    Object.keys(defaults).forEach(key => {
      if (typeof defaults[key] === 'boolean') prefs[key] = saved[key] === undefined ? defaults[key] : !!saved[key];
    });
    return prefs;
  }

  function mount(options = {}) {
    const defaults = Object.assign({}, DEFAULTS, options.defaults);
    const key = options.key || 'mimi-appearance-v1';
    let prefs;
    try { prefs = normalize(JSON.parse(localStorage.getItem(key) || '{}'), defaults); }
    catch { prefs = Object.assign({}, defaults); }
    const controls = Object.assign({ font: 'mimiFont', scale: 'mimiScale', compact: 'mimiCompact', reduceMotion: 'mimiReduceMotion', confirmDanger: 'mimiConfirmDanger' }, options.controls);
    const dialogId = options.dialogId || 'mimiSettingsDialog';
    let dialog = document.getElementById(dialogId);
    if (!dialog) {
      if (options.dialogId) throw Error('MimiSettings: settings dialog not found');
      dialog = document.createElement('dialog');
      dialog.id = dialogId;
      dialog.setAttribute('aria-labelledby', 'mimiSettingsTitle');
      dialog.innerHTML = `<div class="mimi-settings-shell">
        <div class="mimi-settings-head"><div><h2 id="mimiSettingsTitle">我的设置</h2><p>调整操作界面的显示方式，修改后即时生效。</p></div><button class="btn mimi-settings-close" type="button" data-mimi-close-settings aria-label="关闭设置">×</button></div>
        <div class="mimi-settings-body">
          <section class="mimi-settings-section"><div class="mimi-settings-kicker"><b>界面字体</b><span>即时预览</span></div><div class="mimi-settings-choices">
            <label><input type="radio" name="mimiFont" value="round"><span><strong>圆润</strong><small>活泼亲切</small></span></label>
            <label><input type="radio" name="mimiFont" value="hand"><span><strong>手写</strong><small>粉笔板书</small></span></label>
            <label><input type="radio" name="mimiFont" value="clear"><span><strong>清晰</strong><small>利落易读</small></span></label>
          </div></section>
          <section class="mimi-settings-section"><div class="mimi-settings-kicker"><b>文字大小</b><span>全局缩放</span></div><div class="mimi-settings-choices">
            <label><input type="radio" name="mimiScale" value="small"><span><strong>小号</strong><small>显示更多内容</small></span></label>
            <label><input type="radio" name="mimiScale" value="normal"><span><strong>标准</strong><small>平衡舒适</small></span></label>
            <label><input type="radio" name="mimiScale" value="large"><span><strong>大号</strong><small>更轻松阅读</small></span></label>
          </div></section>
          <section class="mimi-settings-section"><div class="mimi-settings-kicker"><b>界面偏好</b><span>自动保存</span></div>
            <label class="mimi-settings-toggle"><span><b>紧凑布局</b><small>减少留白，显示更多内容</small></span><input id="mimiCompact" type="checkbox"></label>
            <label class="mimi-settings-toggle"><span><b>减少动态效果</b><small>减少动画和过渡</small></span><input id="mimiReduceMotion" type="checkbox"></label>
          </section>
        </div>
        <div class="mimi-settings-foot"><small>设置已保存在此设备</small><button class="btn" type="button" data-mimi-reset-settings>恢复默认</button></div>
      </div>`;
      document.body.append(dialog);
    }
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

    function get() {
      const current = options.read ? options.read() : prefs;
      return Object.assign(current, normalize(current, defaults));
    }
    function save(next) {
      prefs = next;
      if (options.write) options.write(next);
      else { try { localStorage.setItem(key, JSON.stringify(next)); } catch {} }
    }

    // 把偏好写入 <html data-*>，全站 CSS 只认这组属性。
    function apply(syncForm, prefs = get()) {
      var root = document.documentElement;
      root.dataset.font = prefs.font;
      root.dataset.scale = prefs.scale;
      root.dataset.density = prefs.compact ? 'compact' : 'comfortable';
      root.dataset.motion = prefs.reduceMotion ? 'reduced' : 'full';
      if (syncForm !== false) syncFormValues(prefs);
      options.onApply?.(prefs);
    }

    function syncFormValues(prefs = get()) {
      ['font', 'scale'].forEach(key => {
        const input = dialog.querySelector(`input[name="${controls[key]}"][value="${prefs[key]}"]`);
        if (input) input.checked = true;
      });
      Object.entries(controls).forEach(([key, id]) => {
        if (key === 'font' || key === 'scale') return;
        const input = document.getElementById(id);
        if (input) input.checked = !!prefs[key];
      });
    }
    function pull() {
      const prefs = get();
      ['font', 'scale'].forEach(key => {
        prefs[key] = dialog.querySelector(`input[name="${controls[key]}"]:checked`)?.value || defaults[key];
      });
      Object.entries(controls).forEach(([key, id]) => {
        if (key === 'font' || key === 'scale') return;
        const input = document.getElementById(id);
        if (input) prefs[key] = input.checked;
      });
      apply(false);
      save(prefs);
    }
    function reset() {
      const next = Object.assign({}, defaults);
      apply(true, next);
      save(next);
    }
    document.addEventListener('click', event => {
      if (event.target.closest(options.open || '[data-mimi-open-settings]')) { syncFormValues(); dialog.showModal(); }
      if (event.target.closest(options.close || '[data-mimi-close-settings]')) dialog.close();
      if (event.target.closest(options.reset || '[data-mimi-reset-settings]')) reset();
    });
    dialog.addEventListener('change', pull);

    apply(true);
    return { get, apply, pull, sync: syncFormValues, reset };
  }

  global.MimiSettings = Object.freeze({ mount: mount, DEFAULTS: DEFAULTS });
})(window);
