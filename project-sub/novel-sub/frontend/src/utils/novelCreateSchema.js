export const WIZARD_STEPS = [
  { step: 1, key: 'basic', title: '基础信息' },
  { step: 2, key: 'world', title: '世界观设定' },
  { step: 3, key: 'factions', title: '门派组织' },
  { step: 4, key: 'characters', title: '人物设定' },
  { step: 5, key: 'outline', title: '篇幅大纲' },
  { step: 6, key: 'content', title: '章节目录', hint: '编排章节标题、顺序与场次倾向，不含门派设定' },
];

export const WIZARD_STEP_MAX = WIZARD_STEPS.length;

export function createBasicInfoForm() {
  return {
    title: '',
    creative_intent: '',
    novel_type: '',
    genre: '',
    genre_subcategory: '',
    genre_category_id: null,
    genre_subcategory_id: null,
    genre_path: [],
    length_id: null,
    audience_id: null,
    update_pace_id: null,
    theme_ids: [],
    themes: [],
    summary: '',
    target_audience: '',
    update_cadence: '',
    author_name: '',
    cover_url: '',
    status: 'draft',
    progress_status: 'ongoing',
    progress_percent: 0,
  };
}

export function parseTargetAudience(value) {
  if (Array.isArray(value)) return value[0] || '';
  if (!value) return '';
  return String(value).split(',')[0].trim();
}

export function novelToBasicForm(novel = {}) {
  const genre_category_id = novel.genre_category_id || null;
  const genre_subcategory_id = novel.genre_subcategory_id || null;
  const genre_path = [];
  if (genre_category_id) genre_path.push(genre_category_id);
  if (genre_subcategory_id) genre_path.push(genre_subcategory_id);
  return {
    ...createBasicInfoForm(),
    title: novel.title || '',
    creative_intent: novel.creative_intent || '',
    novel_type: novel.novel_type || '',
    genre: novel.genre || '',
    genre_subcategory: novel.genre_subcategory || '',
    genre_category_id,
    genre_subcategory_id,
    genre_path,
    length_id: novel.length_id || null,
    audience_id: novel.audience_id || null,
    update_pace_id: novel.update_pace_id || null,
    theme_ids: Array.isArray(novel.theme_ids) ? [...novel.theme_ids] : [],
    themes: Array.isArray(novel.themes) ? [...novel.themes] : [],
    summary: novel.summary || '',
    target_audience: parseTargetAudience(novel.target_audience),
    update_cadence: novel.update_cadence || '',
    author_name: novel.author_name || '',
    cover_url: novel.cover_url || '',
    status: novel.status || 'draft',
    progress_status: novel.progress_status || 'ongoing',
    progress_percent: novel.progress_percent ?? 0,
  };
}

export function basicFormToPayload(form) {
  const [categoryId, subcategoryId] = Array.isArray(form.genre_path) ? form.genre_path : [];
  return {
    title: form.title?.trim(),
    creative_intent: form.creative_intent?.trim() || null,
    summary: form.summary?.trim() || null,
    author_name: form.author_name?.trim() || null,
    cover_url: form.cover_url?.trim() || null,
    status: form.status || 'draft',
    progress_status: form.progress_status || 'ongoing',
    progress_percent: form.progress_percent ?? 0,
    genre_category_id: categoryId || form.genre_category_id || null,
    genre_subcategory_id: subcategoryId || form.genre_subcategory_id || null,
    length_id: form.length_id || null,
    audience_id: form.audience_id || null,
    update_pace_id: form.update_pace_id || null,
    theme_ids: Array.isArray(form.theme_ids) ? form.theme_ids : [],
  };
}

export function validateBasicStep(form) {
  if (!form.title?.trim()) {
    return '请输入小说名称';
  }
  return '';
}

export function createUid(prefix = 'n') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createWorldForm() {
  return {
    era: '',
    geography: '',
    social_rules: '',
    power_system: '',
    technology: '',
    history_notes: '',
    timeline: [],
  };
}

export function createTimelineNode(data = {}) {
  return {
    id: data.id || createUid('t'),
    year: data.year || '',
    event: data.event || '',
  };
}

export function createCharacter(data = {}) {
  return {
    id: data.id || createUid('c'),
    name: data.name || '',
    role: data.role || 'support',
    personality: data.personality || '',
    background: data.background || '',
    goal: data.goal || '',
    relations: data.relations || '',
    faction_id: data.faction_id || '',
  };
}

export function createCharacterEdge(data = {}) {
  return {
    id: data.id || createUid('e'),
    source: data.source || '',
    target: data.target || '',
    relation: data.relation || 'ally',
    label: data.label || '',
  };
}

export const CHARACTER_RELATION_OPTIONS = [
  { value: 'ally', label: '盟友' },
  { value: 'enemy', label: '宿敌' },
  { value: 'mentor', label: '师徒' },
  { value: 'family', label: '亲族' },
  { value: 'love', label: '情愫' },
];

export function createOutlineSection(data = {}) {
  return {
    id: data.id || createUid('s'),
    title: data.title || '',
    word_target: data.word_target ?? 0,
  };
}

export function createOutlineGroup(data = {}) {
  return {
    id: data.id || createUid('g'),
    title: data.title || '',
    word_target: data.word_target ?? 0,
    sections: (data.sections || []).map(createOutlineSection),
  };
}

export function createOutlineVolume(data = {}) {
  return {
    id: data.id || createUid('v'),
    title: data.title || '',
    word_target: data.word_target ?? 0,
    groups: (data.groups || []).map(createOutlineGroup),
  };
}

export function createOutlineForm() {
  return { volumes: [] };
}

export const FACTION_KIND_OPTIONS = [
  { value: 'sect', label: '门派' },
  { value: 'clan', label: '家族' },
  { value: 'nation', label: '国家' },
  { value: 'force', label: '势力' },
  { value: 'other', label: '其他' },
];

export const FACTION_ALIGNMENT_OPTIONS = [
  { value: 'righteous', label: '正' },
  { value: 'evil', label: '邪' },
  { value: 'neutral', label: '中立' },
];

export function createFaction(data = {}) {
  return {
    id: data.id || createUid('f'),
    name: data.name || '',
    kind: data.kind || 'sect',
    alignment: data.alignment || 'neutral',
    description: data.description || '',
    rules: data.rules || '',
    headquarters: data.headquarters || '',
    member_ids: Array.isArray(data.member_ids) ? [...data.member_ids] : [],
  };
}

export function createChapterItem(data = {}) {
  return {
    id: data.id || createUid('ch'),
    title: data.title || '',
    faction: data.faction || 'hero',
    order: data.order ?? 1,
    status: data.status || 'draft',
    outline_ref: data.outline_ref || '',
  };
}

export function createContentForm() {
  return { chapters: [] };
}

export function parseSettingJson(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

export function settingToForms(setting = {}) {
  const s = parseSettingJson(setting);
  const world = { ...createWorldForm(), ...(s.world || {}) };
  world.timeline = (world.timeline || []).map(createTimelineNode);

  return {
    worldForm: world,
    characters: (s.characters || []).map(createCharacter),
    characterEdges: (s.character_edges || []).map(createCharacterEdge),
    outlineForm: {
      volumes: (s.outline?.volumes || []).map(createOutlineVolume),
    },
    contentForm: {
      chapters: (s.chapters || []).map((ch, idx) => createChapterItem({ ...ch, order: ch.order ?? idx + 1 })),
    },
    factions: (s.factions || []).map(createFaction),
  };
}

export function buildSettingPatch({
  worldForm, characters, characterEdges, outlineForm, contentForm, factions,
}) {
  return {
    world: worldForm ? { ...worldForm } : undefined,
    factions: factions ? [...factions] : undefined,
    characters: characters ? [...characters] : undefined,
    character_edges: characterEdges ? [...characterEdges] : undefined,
    outline: outlineForm ? { volumes: outlineForm.volumes || [] } : undefined,
    chapters: contentForm ? [...(contentForm.chapters || [])] : undefined,
  };
}

export function buildStepSettingPatch(step, forms) {
  switch (step) {
    case 2:
      return { world: { ...forms.worldForm } };
    case 3:
      return { factions: [...(forms.factions || [])] };
    case 4:
      return {
        characters: [...forms.characters],
        character_edges: [...(forms.characterEdges || [])],
      };
    case 5:
      return { outline: { volumes: forms.outlineForm.volumes || [] } };
    case 6:
      return { chapters: [...(forms.contentForm.chapters || [])] };
    default:
      return {};
  }
}

export function countOutlineWords(outlineForm) {
  let total = 0;
  for (const vol of outlineForm.volumes || []) {
    total += Number(vol.word_target) || 0;
    for (const group of vol.groups || []) {
      total += Number(group.word_target) || 0;
      for (const sec of group.sections || []) {
        total += Number(sec.word_target) || 0;
      }
    }
  }
  return total;
}

export const CHARACTER_ROLE_OPTIONS = [
  { value: 'main', label: '主角' },
  { value: 'support', label: '配角' },
  { value: 'villain', label: '反派' },
];

export const CHAPTER_FACTION_OPTIONS = [
  { value: 'hero', label: '正派' },
  { value: 'villain', label: '反派' },
  { value: 'neutral', label: '中立' },
];
