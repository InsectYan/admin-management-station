export const WIZARD_STEPS = [
  { step: 1, key: 'basic', title: '基础信息' },
  { step: 2, key: 'world', title: '世界观设定' },
  { step: 3, key: 'characters', title: '人物设定' },
  { step: 4, key: 'outline', title: '篇幅大纲' },
  { step: 5, key: 'content', title: '内容组织' },
];

export function createBasicInfoForm() {
  return {
    title: '',
    creative_intent: '',
    novel_type: '',
    genre: '',
    summary: '',
    target_audience: [],
    update_cadence: '',
    author_name: '',
    cover_url: '',
    status: 'draft',
    progress_status: 'ongoing',
    progress_percent: 0,
  };
}

export function parseTargetAudience(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

export function serializeTargetAudience(list) {
  if (!list?.length) return '';
  return list.join(',');
}

export function novelToBasicForm(novel = {}) {
  return {
    ...createBasicInfoForm(),
    title: novel.title || '',
    creative_intent: novel.creative_intent || '',
    novel_type: novel.novel_type || '',
    genre: novel.genre || '',
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
  return {
    title: form.title?.trim(),
    creative_intent: form.creative_intent?.trim() || null,
    novel_type: form.novel_type || null,
    genre: form.genre || null,
    summary: form.summary?.trim() || null,
    target_audience: serializeTargetAudience(form.target_audience),
    update_cadence: form.update_cadence || null,
    author_name: form.author_name?.trim() || null,
    cover_url: form.cover_url?.trim() || null,
    status: 'draft',
    progress_status: form.progress_status || 'ongoing',
    progress_percent: form.progress_percent ?? 0,
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
  };
}

export function buildSettingPatch({ worldForm, characters, characterEdges, outlineForm, contentForm }) {
  return {
    world: worldForm ? { ...worldForm } : undefined,
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
      return {
        characters: [...forms.characters],
        character_edges: [...(forms.characterEdges || [])],
      };
    case 4:
      return { outline: { volumes: forms.outlineForm.volumes || [] } };
    case 5:
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
