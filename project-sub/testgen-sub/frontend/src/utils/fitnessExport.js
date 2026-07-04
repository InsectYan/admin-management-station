/** 下载 JSON 文件 */
export function downloadJson(filename, data) {
  const blob = new Blob([ JSON.stringify(data, null, 2) ], { type: 'application/json;charset=utf-8' });
  triggerDownload(filename, blob);
}

/** 下载 CSV 文本（含 BOM） */
export function downloadCsvText(filename, csvText) {
  const blob = new Blob([ csvText ], { type: 'text/csv;charset=utf-8' });
  triggerDownload(filename, blob);
}

/** 下载 Blob（如后端返回的 CSV） */
export function downloadBlob(filename, blob) {
  triggerDownload(filename, blob);
}

function triggerDownload(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export { RISK_RELATION_TAG, riskRelationTag } from './fitnessStatusTags.js';
