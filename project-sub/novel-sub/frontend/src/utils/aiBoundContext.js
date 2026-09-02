function findById(list, id) {
  if (id == null || id === '') return null;
  return (list || []).find((item) => String(item.id) === String(id)) || null;
}

function themeNamesFrom(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .map((name) => String(name || '').trim())
    .filter(Boolean);
}

export function basicContextForAgent(form = {}, enums = {}) {
  const [pathCat, pathSub] = Array.isArray(form.genre_path) ? form.genre_path : [];
  const catId = form.genre_category_id || pathCat;
  const subId = form.genre_subcategory_id || pathSub;
  const cat = findById(enums.genres, catId);
  const sub = cat
    ? findById(cat.children, subId)
    : (enums.genres || [])
      .flatMap((item) => item.children || [])
      .find((item) => String(item.id) === String(subId));
  const genre = form.genre || cat?.name || '';
  const genre_subcategory = form.genre_subcategory || sub?.name || '';
  const themeIds = new Set((form.theme_ids || []).map(String));
  const fromIds = (enums.themes || [])
    .filter((item) => themeIds.has(String(item.id)))
    .map((item) => item.name);
  const themes = [...new Set([...themeNamesFrom(form.themes), ...fromIds])];
  const length = findById(enums.lengths, form.length_id);
  const audience = findById(enums.audiences, form.audience_id);
  const pace = findById(enums.update_paces, form.update_pace_id);
  const next = {
    title: form.title || '',
    creative_intent: form.creative_intent || '',
    summary: form.summary || '',
    genre,
    genre_subcategory,
    genre_label: [genre, genre_subcategory].filter(Boolean).join(' / '),
    themes,
    novel_type: form.novel_type || length?.name || '',
    target_audience: form.target_audience || audience?.name || '',
    update_cadence: form.update_cadence || pace?.name || '',
  };
  if (length) {
    next.length = {
      name: length.name,
      min_words: length.min_words,
      max_words: length.max_words,
    };
  }
  return next;
}
