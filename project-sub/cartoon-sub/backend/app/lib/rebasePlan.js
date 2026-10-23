'use strict';

function fieldList(shot) {
  return Array.isArray(shot?.overridden_fields) ? shot.overridden_fields : [];
}

function sameBody(existing, chapter) {
  if (!existing || !chapter) return false;
  if (chapter.body_hash && existing.body_hash) return chapter.body_hash === existing.body_hash;
  return existing.body === chapter.body;
}

function keepsProductionText(shot) {
  const fields = fieldList(shot);
  return fields.includes('dialogue') || fields.includes('description');
}

function withOverride(shot, payload) {
  const fields = new Set(fieldList(shot));
  if (payload.description != null && payload.description !== shot.description) fields.add('description');
  if (payload.dialogue != null && payload.dialogue !== shot.dialogue) fields.add('dialogue');
  return [ ...fields ];
}

module.exports = {
  sameBody,
  keepsProductionText,
  withOverride,
};
