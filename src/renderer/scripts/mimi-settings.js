/* 咪咪工具共享：界面偏好设置（字体 / 字号 / 紧凑 / 动效 / 危险确认）的唯一行为源。
 * 可在页面放置约定结构的设置对话框；未放置时会自动创建共享设置侧栏。
 * 约定：对话框 id="mimiSettingsDialog"，内部单选 name="mimiFont" / name="mimiScale"，
 * 开关 id="mimiCompact" / "mimiReduceMotion" / "mimiConfirmDanger" / "mimiShowLabels"(可选)，
 * 打开按钮 [data-mimi-open-settings]，关闭按钮 [data-mimi-close-settings]，重置按钮 [data-mimi-reset-settings]。
 * 详细中文注释：保持与排座位、做板贴原有逻辑一致，仅抽取为公共模块。 */
(function (global) {
  'use strict';

  // 默认偏好：与现有两处设置面板的默认值保持一致。
  var DEFAULTS = { font: 'round', scale: 'normal', compact: false, reduceMotion: false, confirmDanger: true, showLabels: true };

  // 读取本地保存的偏好，损坏时回退到默认值。
  function load(key) {
    try {
      var saved = JSON.parse(localStorage.getItem(key) || '{}') || {};
      return {
        font: ['round', 'hand', 'clear'].includes(saved.font) ? saved.font : DEFAULTS.font,
        scale: ['small', 'normal', 'large'].includes(saved.scale) ? saved.scale : DEFAULTS.scale,
        compact: !!saved.compact,
        reduceMotion: !!saved.reduceMotion,
        confirmDanger: saved.confirmDanger === undefined ? DEFAULTS.confirmDanger : !!saved.confirmDanger,
        showLabels: saved.showLabels === undefined ? DEFAULTS.showLabels : !!saved.showLabels
      };
    }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }

  // 挂载统一设置。options: { key, onLabelsChange }
  function mount(options) {
    options = options || {};
    var key = options.key || 'mimi-appearance-v1';
    var prefs = load(key);

    // The newer tools share a settings sheet; older tools keep their existing dialogs.
    if (!document.getElementById('mimiSettingsDialog')) {
      var dialog = document.createElement('dialog');
      dialog.id = 'mimiSettingsDialog';
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
      dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
    }

    // 把偏好写入 <html data-*>，全站 CSS 只认这组属性。
    function apply(syncForm) {
      var root = document.documentElement;
      root.dataset.font = prefs.font;
      root.dataset.scale = prefs.scale;
      root.dataset.density = prefs.compact ? 'compact' : 'comfortable';
      root.dataset.motion = prefs.reduceMotion ? 'reduced' : 'full';
      if (syncForm !== false) syncFormValues();
      if (typeof options.onLabelsChange === 'function') options.onLabelsChange(!prefs.showLabels);
    }

    // 把当前偏好回填到对话框控件。
    function syncFormValues() {
      var font = document.querySelector('input[name="mimiFont"][value="' + prefs.font + '"]');
      var scale = document.querySelector('input[name="mimiScale"][value="' + prefs.scale + '"]');
      if (font) font.checked = true;
      if (scale) scale.checked = true;
      ['Compact', 'ReduceMotion', 'ConfirmDanger', 'ShowLabels'].forEach(function (name) {
        var el = document.getElementById('mimi' + name);
        if (el) el.checked = !!prefs[name.charAt(0).toLowerCase() + name.slice(1)];
      });
    }

    // 从对话框读回偏好并持久化。
    function pull() {
      var font = document.querySelector('input[name="mimiFont"]:checked');
      var scale = document.querySelector('input[name="mimiScale"]:checked');
      prefs.font = (font && font.value) || 'round';
      prefs.scale = (scale && scale.value) || 'normal';
      ['compact', 'reduceMotion', 'confirmDanger', 'showLabels'].forEach(function (k) {
        var id = 'mimi' + k.charAt(0).toUpperCase() + k.slice(1);
        var el = document.getElementById(id);
        if (el) prefs[k] = el.checked;
      });
      try { localStorage.setItem(key, JSON.stringify(prefs)); } catch (e) {}
      apply(false);
    }

    // 打开 / 关闭 / 重置：全部走事件委托，页面无需写 JS。
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-mimi-open-settings]')) { syncFormValues(); document.getElementById('mimiSettingsDialog').showModal(); }
      if (e.target.closest('[data-mimi-close-settings]')) document.getElementById('mimiSettingsDialog').close();
      if (e.target.closest('[data-mimi-reset-settings]')) { prefs = Object.assign({}, DEFAULTS); try { localStorage.setItem(key, JSON.stringify(prefs)); } catch (err) {} apply(true);  }
    });
    document.addEventListener('change', function (e) {
      if (e.target.closest('#mimiSettingsDialog')) pull();
    });

    apply(true);
    return { get: function () { return prefs; }, apply: apply, pull: pull };
  }

  global.MimiSettings = Object.freeze({ mount: mount, DEFAULTS: DEFAULTS });
})(window);
