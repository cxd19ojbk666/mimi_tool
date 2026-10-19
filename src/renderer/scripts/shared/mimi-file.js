// 共享：文本文件解码与大小守卫（点名器与做表格此前各写一份，此处统一）。
// 详细中文注释：BOM 优先，其次 UTF-8，失败回退 GB18030；逻辑与原两处实现完全一致。
(function (global) {
  'use strict';
  // 按 BOM/UTF-8/GB18030 顺序解码 ArrayBuffer。
  function decodeText(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le').decode(buffer);
    if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be').decode(buffer);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { return new TextDecoder('gb18030').decode(buffer); }
  }
  // 文件大小守卫：超限抛错，文案由调用方传入以保留原提示。
  function assertFileSize(file, limit, message) {
    if (file.size > limit) throw new Error(message);
  }
  global.MimiFile = Object.freeze({ decodeText, assertFileSize });
})(typeof window !== 'undefined' ? window : globalThis);
