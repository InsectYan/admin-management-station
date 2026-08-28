'use strict';

const GENERATABLE_FIELDS = ['title', 'creative_intent', 'summary'];

function slimCatalog(tree = {}) {
  return {
    genres: (tree.genres || []).map((cat) => ({
      id: cat.id,
      name: cat.name,
      children: (cat.children || []).map((child) => ({ id: child.id, name: child.name })),
    })),
    themes: (tree.themes || []).map((item) => ({ id: item.id, name: item.name })),
    audiences: (tree.audiences || []).map((item) => ({ id: item.id, name: item.name })),
    lengths: (tree.lengths || []).map((item) => ({ id: item.id, name: item.name })),
    update_paces: (tree.update_paces || []).map((item) => ({ id: item.id, name: item.name })),
  };
}

function filterGeneratableFields(fields) {
  return (Array.isArray(fields) ? fields : []).filter((key) => GENERATABLE_FIELDS.includes(key));
}

function sanitizePatch(raw, _catalog, allowedFields) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const allow = new Set(
    filterGeneratableFields(allowedFields && allowedFields.length ? allowedFields : GENERATABLE_FIELDS),
  );
  const out = {};
  for (const key of GENERATABLE_FIELDS) {
    if (!allow.has(key) || source[key] === undefined || source[key] === null) continue;
    const text = String(source[key]).trim();
    if (text) out[key] = text.slice(0, key === 'title' ? 200 : 4000);
  }
  return out;
}

function unwrapSkill(data = {}) {
  const output = data.output && typeof data.output === 'object' ? data.output : {};
  return {
    reply: data.reply || output.reply || output.summary || data.text || '',
    thinking: data.thinking || output.thinking || '',
    patch: output.patch && typeof output.patch === 'object' ? output.patch : (data.patch || {}),
    sparks: Array.isArray(output.sparks) ? output.sparks : (data.sparks || []),
    suggested_fields: Array.isArray(output.suggested_fields) ? output.suggested_fields : [],
    target_fields: Array.isArray(output.target_fields) ? output.target_fields : [],
  };
}

function digestHistory(messages = [], limit = 10) {
  return messages
    .filter((row) => row.role !== 'thinking')
    .slice(-limit)
    .map((row) => ({
      role: row.role,
      content: String(row.content || '').slice(0, 400),
    }));
}

module.exports = {
  GENERATABLE_FIELDS,
  filterGeneratableFields,
  slimCatalog,
  sanitizePatch,
  unwrapSkill,
  digestHistory,
};
