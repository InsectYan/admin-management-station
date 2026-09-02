export const BASIC_AI_SCENES = [
  {
    id: 'basic',
    title: '基础信息',
    icon: 'Notebook',
    scene: 'basic',
    children: [
      {
        id: 'title',
        title: '小说名称',
        icon: 'EditPen',
        scene: 'basic.title',
        path: 'title',
        placeholder: '起个名字…',
      },
      {
        id: 'intent',
        title: '创作立意',
        icon: 'ChatLineSquare',
        scene: 'basic.intent',
        path: 'creative_intent',
        placeholder: '帮我凝练立意…',
      },
      {
        id: 'summary',
        title: '小说简介',
        icon: 'Document',
        scene: 'basic.summary',
        path: 'summary',
        placeholder: '写一段简介…',
      },
      {
        id: 'genre',
        title: '小说类型',
        icon: 'CollectionTag',
        scene: 'basic.genre',
        path: 'genre_path',
        selectable: false,
        disabledHint: '下拉选项，请在表单中手动选择',
      },
      {
        id: 'themes',
        title: '题材',
        icon: 'PriceTag',
        scene: 'basic.themes',
        path: 'theme_ids',
        selectable: false,
        disabledHint: '多选项，请在表单中手动选择',
      },
      {
        id: 'length',
        title: '篇幅',
        icon: 'Timer',
        scene: 'basic.length',
        path: 'length_id',
        selectable: false,
        disabledHint: '下拉选项，请在表单中手动选择',
      },
      {
        id: 'audience',
        title: '目标读者',
        icon: 'User',
        scene: 'basic.audience',
        path: 'audience_id',
        selectable: false,
        disabledHint: '下拉选项，请在表单中手动选择',
      },
      {
        id: 'pace',
        title: '更新节奏',
        icon: 'AlarmClock',
        scene: 'basic.pace',
        path: 'update_pace_id',
        selectable: false,
        disabledHint: '下拉选项，请在表单中手动选择',
      },
    ],
  },
];

export const WORLD_AI_SCENES = [
  {
    id: 'world',
    title: '世界观',
    icon: 'MapLocation',
    scene: 'world',
    placeholder: '按立意补一套力量体系，并给 4 个历史节点…',
    // 父级只作未选中时的整步生成，不单独出 Tab（表单没有「世界观」总览字段）
    children: [
      {
        id: 'era',
        title: '时代背景',
        icon: 'Clock',
        scene: 'world.era',
        path: 'era',
        placeholder: '写一段时代与文明阶段…',
      },
      {
        id: 'geography',
        title: '地理环境',
        icon: 'Location',
        scene: 'world.geography',
        path: 'geography',
        placeholder: '补大陆、国家、地貌…',
      },
      {
        id: 'social',
        title: '社会规则',
        icon: 'OfficeBuilding',
        scene: 'world.social',
        path: 'social_rules',
        placeholder: '写政治结构、阶级与习俗…',
      },
      {
        id: 'power',
        title: '力量体系',
        icon: 'MagicStick',
        scene: 'world.power',
        path: 'power_system',
        placeholder: '按类型写一套力量体系…',
      },
      {
        id: 'tech',
        title: '科技水平',
        icon: 'Cpu',
        scene: 'world.tech',
        path: 'technology',
        placeholder: '可选：科技或文明工具…',
      },
      {
        id: 'history',
        title: '历史概览',
        icon: 'Notebook',
        scene: 'world.history',
        path: 'history_notes',
        placeholder: '写影响剧情的重大历史…',
      },
      {
        id: 'timeline',
        title: '时间轴',
        icon: 'Histogram',
        scene: 'world.timeline',
        path: 'timeline',
        placeholder: '追加 3～6 个历史节点…',
      },
    ],
  },
];

export function buildFactionScenes(activeFaction) {
  const children = [
    {
      id: 'list',
      title: '组织列表',
      icon: 'OfficeBuilding',
      scene: 'factions.list',
      path: 'factions',
      placeholder: '按世界观补几家门派或家族…',
    },
  ];
  if (activeFaction?.id) {
    const label = activeFaction.name || '当前组织';
    children.push({
      id: 'current',
      title: label,
      icon: 'Flag',
      scene: 'factions.current',
      path: 'factions',
      placeholder: `补全「${label}」的来历与规矩…`,
    });
  }
  return [
    {
      id: 'factions',
      title: '门派组织',
      icon: 'OfficeBuilding',
      scene: 'factions',
      placeholder: '按世界观补门派、家族或国家，并标正邪…',
      children,
    },
  ];
}

export const CHARACTER_FIELD_KEYS = ['name', 'role', 'personality', 'background', 'goal', 'relations'];

export function buildCharacterScenes(activeCharacter) {
  const children = [
    {
      id: 'cast',
      title: '角色库',
      icon: 'Avatar',
      scene: 'characters.cast',
      path: 'characters',
      placeholder: '按世界观给 1 主角 2 配角 1 反派…',
    },
    {
      id: 'edges',
      title: '人物关系',
      icon: 'Share',
      scene: 'characters.edges',
      path: 'character_edges',
      placeholder: '给已有角色标宿敌或盟友…',
    },
  ];
  if (activeCharacter?.id) {
    const label = activeCharacter.name || '当前角色';
    children.push({
      id: 'current',
      title: label,
      icon: 'UserFilled',
      scene: 'characters.current',
      paths: CHARACTER_FIELD_KEYS.map((key) => `characters[${activeCharacter.id}].${key}`),
      placeholder: `补全「${label}」的性格与动机…`,
    });
  }
  return [
    {
      id: 'characters',
      title: '人物',
      icon: 'User',
      scene: 'characters',
      placeholder: '按世界观给 1 主角 2 配角 1 反派，并标宿敌…',
      children,
    },
  ];
}

export const OUTLINE_AI_SCENES = [
  {
    id: 'outline',
    title: '大纲',
    icon: 'Reading',
    scene: 'outline',
    placeholder: '按长篇拆三卷，每卷两个章组…',
    children: [
      {
        id: 'volumes',
        title: '分卷结构',
        icon: 'FolderOpened',
        scene: 'outline.volumes',
        path: 'volumes',
        placeholder: '拆卷、章组与小节标题…',
      },
      {
        id: 'words',
        title: '字数分配',
        icon: 'Coin',
        scene: 'outline.words',
        path: 'word_targets',
        placeholder: '按篇幅把字数分到卷/组/节…',
      },
    ],
  },
];

export const CONTENT_AI_SCENES = [
  {
    id: 'content',
    title: '章节目录',
    icon: 'CollectionTag',
    scene: 'content',
    placeholder: '按大纲小节生成章节标题，并标正反派场次…',
    children: [
      {
        id: 'chapters',
        title: '章节列表',
        icon: 'Document',
        scene: 'content.chapters',
        path: 'chapters',
        placeholder: '按大纲小节生成章节标题…',
      },
      {
        id: 'faction',
        title: '场次倾向',
        icon: 'Flag',
        scene: 'content.faction',
        path: 'faction',
        placeholder: '给现有章节标正派/反派/中立场次…',
      },
    ],
  },
];

export const CHAPTER_AI_SCENES = [
  {
    id: 'chapter',
    title: '单章正文',
    icon: 'EditPen',
    scene: 'chapter',
    placeholder: '按本章标题和大纲写这一章正文…',
    children: [
      {
        id: 'body',
        title: '本章正文',
        icon: 'Document',
        scene: 'chapter.body',
        path: 'body',
        placeholder: '只写当前这一章，不要带出全书…',
      },
    ],
  },
];

export const ORCHESTRATE_AI_SCENES = [
  {
    id: 'orchestrate',
    title: '开书计划',
    icon: 'Guide',
    scene: 'orchestrate',
    placeholder: '男频东方玄幻，凡人流，反派是宗门执事…',
    children: [
      {
        id: 'plan-basic',
        title: '基础信息',
        icon: 'EditPen',
        scene: 'orchestrate.basic',
        path: 'tasks',
        taskPath: 'plan.basic',
        placeholder: '先拆基础信息这一步…',
      },
      {
        id: 'plan-world',
        title: '世界观',
        icon: 'MapLocation',
        scene: 'orchestrate.world',
        path: 'tasks',
        taskPath: 'plan.world',
        placeholder: '计划里什么时候补世界观…',
      },
      {
        id: 'plan-factions',
        title: '门派组织',
        icon: 'OfficeBuilding',
        scene: 'orchestrate.factions',
        path: 'tasks',
        taskPath: 'plan.factions',
        placeholder: '世界观完成后再拆门派…',
      },
      {
        id: 'plan-characters',
        title: '人物',
        icon: 'User',
        scene: 'orchestrate.characters',
        path: 'tasks',
        taskPath: 'plan.characters',
        placeholder: '门派齐了再拆人物…',
      },
      {
        id: 'plan-outline',
        title: '大纲',
        icon: 'Reading',
        scene: 'orchestrate.outline',
        path: 'tasks',
        taskPath: 'plan.outline',
        placeholder: '人物齐了再拆大纲…',
      },
      {
        id: 'plan-content',
        title: '章节',
        icon: 'CollectionTag',
        scene: 'orchestrate.content',
        path: 'tasks',
        taskPath: 'plan.content',
        placeholder: '大纲齐了再拆章节…',
      },
      {
        id: 'plan-bodies',
        title: '正文',
        icon: 'EditPen',
        scene: 'orchestrate.bodies',
        path: 'tasks',
        taskPath: 'plan.bodies',
        placeholder: '目录齐了再写第一章正文…',
      },
    ],
  },
];

export function decoratePlanScenes(scenes, tasks) {
  if (!Array.isArray(tasks) || !tasks.length) return scenes;
  return (scenes || []).map((group) => ({
    ...group,
    children: (group.children || []).map((child) => {
      const task = tasks.find((row) => row.path === child.taskPath);
      if (!task) return child;
      const blocked = (task.depends_on || []).some((depId) => {
        const dep = tasks.find((row) => row.id === depId);
        return dep && dep.status !== 'skip' && dep.status !== 'applied';
      });
      if (!blocked) return child;
      const first = tasks.find((row) => row.id === task.depends_on[0]);
      return {
        ...child,
        selectable: false,
        disabledHint: `请先完成「${first?.path || '前置步骤'}」`,
      };
    }),
  }));
}

export function isSelectableScene(node) {
  return Boolean(node) && node.selectable !== false;
}

export function collectPaths(node) {
  if (!node) return [];
  if (node.children?.length) {
    return node.children.filter(isSelectableScene).flatMap(collectPaths);
  }
  if (!isSelectableScene(node)) return [];
  if (Array.isArray(node.paths) && node.paths.length) {
    return node.paths.filter(Boolean);
  }
  return node.path ? [node.path] : [];
}

export function findSceneNode(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const hit = findSceneNode(node.children, id);
    if (hit) return hit;
  }
  return null;
}
