'use strict';

const ITEM_SCHEME_FALLBACK_JOINS = `
  LEFT JOIN test_category_minor_scheme cms ON cms.category_minor_id = t.category_minor_id
  LEFT JOIN test_scheme_enum ts_fb ON ts_fb.scheme_id = cms.scheme_primary_id
  LEFT JOIN test_validation_enum vs_fb ON vs_fb.validation_id = cms.validation_primary_id
`;

const ITEM_SCHEME_FALLBACK_SELECT = `
  cms.scheme_primary_id AS _fallback_scheme_id,
  cms.validation_primary_id AS _fallback_validation_id,
  ts_fb.name AS _fallback_scheme_name,
  vs_fb.name AS _fallback_validation_name
`;

/** @param {Record<string, unknown> | null | undefined} row */
function applyMinorSchemeFallback(row) {
  if (!row) return row;
  if (!row.scheme_primary_id && row._fallback_scheme_id) {
    row.scheme_primary_id = row._fallback_scheme_id;
  }
  if (!row.validation_primary_id && row._fallback_validation_id) {
    row.validation_primary_id = row._fallback_validation_id;
  }
  if (!row.scheme_primary_name && row._fallback_scheme_name) {
    row.scheme_primary_name = row._fallback_scheme_name;
  }
  if (!row.validation_primary_name && row._fallback_validation_name) {
    row.validation_primary_name = row._fallback_validation_name;
  }
  delete row._fallback_scheme_id;
  delete row._fallback_validation_id;
  delete row._fallback_scheme_name;
  delete row._fallback_validation_name;
  return row;
}

/** @param {Record<string, unknown>[]} rows */
function applyMinorSchemeFallbackAll(rows) {
  return rows.map(applyMinorSchemeFallback);
}

module.exports = {
  ITEM_SCHEME_FALLBACK_JOINS,
  ITEM_SCHEME_FALLBACK_SELECT,
  applyMinorSchemeFallback,
  applyMinorSchemeFallbackAll,
};
