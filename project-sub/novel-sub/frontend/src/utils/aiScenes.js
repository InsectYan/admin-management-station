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

export function isSelectableScene(node) {
  return Boolean(node) && node.selectable !== false;
}

export function collectPaths(node) {
  if (!node) return [];
  if (node.children?.length) {
    return node.children.filter(isSelectableScene).flatMap(collectPaths);
  }
  if (!isSelectableScene(node)) return [];
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
