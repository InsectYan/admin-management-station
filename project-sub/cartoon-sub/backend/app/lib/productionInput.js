'use strict';

function productionInput(project, extra = {}) {
  const packageId = String(project?.package_id || '').trim();
  const rawVersion = project?.package_version;
  const hasVersion = rawVersion != null && String(rawVersion).trim() !== '';
  const copyId = extra.copy_block_id != null && String(extra.copy_block_id).trim() !== ''
    ? String(extra.copy_block_id).trim()
    : '';
  const hasPackage = Boolean(packageId || hasVersion);
  if (hasPackage && copyId) {
    const err = new Error('故事包和本地文案不能同时作为输入');
    err.status = 400;
    throw err;
  }
  const fields = { content_type: project?.content_type || '' };
  if (hasPackage) {
    fields.package_id = packageId;
    if (hasVersion) fields.package_version = Number(rawVersion);
  }
  if (copyId) fields.copy_block_id = copyId;
  return fields;
}

module.exports = { productionInput };
