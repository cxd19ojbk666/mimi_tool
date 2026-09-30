/* 咪咪工具共享：界面偏好设置（字体 / 字号 / 紧凑 / 动效 / 危险确认）的唯一行为源。
 * 各工具只需在页面放置约定结构的设置对话框，即可获得统一行为。
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
    try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(key) || '{}')); }
    catch (e) { return Object.assign({}, DEFAULTS); }
  }

  // 挂载统一设置。options: { key, onLabelsChange, toast }
  function mount(options) {
    options = options || {};
    var key = options.key || 'mimi-appearance-v1';
    var toast = options.toast || (global.MimiCommon && global.MimiCommon.toast) || function () {};
    var prefs = load(key);

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
      if (e.target.closest('[data-mimi-reset-settings]')) { prefs = Object.assign({}, DEFAULTS); try { localStorage.setItem(key, JSON.stringify(prefs)); } catch (err) {} apply(true); toast('已恢复默认设置'); }
    });
    document.addEventListener('change', function (e) {
      if (e.target.closest('#mimiSettingsDialog')) pull();
    });

    apply(true);
    return { get: function () { return prefs; }, apply: apply, pull: pull };
  }

  global.MimiSettings = Object.freeze({ mount: mount, DEFAULTS: DEFAULTS });
})(window);
