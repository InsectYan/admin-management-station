export function applyBasicPatch(form, patch = {}) {
  if (!form || !patch || typeof patch !== 'object') return;
  if (patch.title !== undefined) form.title = String(patch.title);
  if (patch.creative_intent !== undefined) form.creative_intent = String(patch.creative_intent);
  if (patch.summary !== undefined) form.summary = String(patch.summary);
}
