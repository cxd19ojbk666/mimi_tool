// 共享：本地存储安全读写（统一 try/catch 与失败提示）。
// 详细中文注释：所有业务页不得直调 localStorage，必须走这里。
(function (global) {
  'use strict';
  // 安全读取 JSON，失败返回 fallback（存储不可用/数据损坏都不抛错）。
  function safeRead(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  // 安全写入 JSON，返回是否成功（无痕模式等场景会失败）。
  function safeWrite(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  global.MimiStorage = Object.freeze({ safeRead, safeWrite });
})(typeof window !== 'undefined' ? window : globalThis);
