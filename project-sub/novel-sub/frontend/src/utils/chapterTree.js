export function sortedChapters(chapters = []) {
  return [...chapters].sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function matchChapterToOutline(chapter, title, id) {
  const ref = String(chapter?.outline_ref || '').trim();
  if (!ref) return false;
  return ref === String(id || '') || ref === String(title || '');
}

export function buildChapterTree(volumes = [], chapters = []) {
  const list = sortedChapters(chapters);
  const used = new Set();

  function takeFor(title, id) {
    return list.filter((ch) => {
      if (used.has(ch.id)) return false;
      if (!matchChapterToOutline(ch, title, id)) return false;
      used.add(ch.id);
      return true;
    });
  }

  if (!volumes.length) {
    return [{
      id: 'flat',
      title: '全部章节',
      kind: 'root',
      children: list.map((ch) => ({ ...ch, kind: 'chapter' })),
    }];
  }

  const tree = volumes.map((vol) => ({
    id: vol.id,
    title: vol.title || '未命名卷',
    kind: 'volume',
    children: (vol.groups || []).map((group) => ({
      id: group.id,
      title: group.title || '未命名章组',
      kind: 'group',
      children: [
        ...(group.sections || []).map((sec) => ({
          id: sec.id,
          title: sec.title || '未命名小节',
          kind: 'section',
          children: takeFor(sec.title, sec.id).map((ch) => ({ ...ch, kind: 'chapter' })),
        })),
        ...takeFor(group.title, group.id).map((ch) => ({ ...ch, kind: 'chapter' })),
      ],
    })),
  }));

  const leftover = list.filter((ch) => !used.has(ch.id));
  if (leftover.length) {
    tree.push({
      id: 'unlinked',
      title: '未关联大纲',
      kind: 'root',
      children: leftover.map((ch) => ({ ...ch, kind: 'chapter' })),
    });
  }
  return tree;
}

export function firstChapterId(chapters = []) {
  return sortedChapters(chapters)[0]?.id || '';
}

export function firstEmptyChapterId(chapters = [], wordCountOf = () => 0, fromId = '') {
  const list = sortedChapters(chapters);
  const fromIndex = fromId ? list.findIndex((ch) => ch.id === fromId) : -1;
  if (fromIndex >= 0 && !wordCountOf(list[fromIndex].id)) return list[fromIndex].id;
  const start = fromIndex >= 0 ? fromIndex + 1 : 0;
  for (let i = start; i < list.length; i += 1) {
    if (!wordCountOf(list[i].id)) return list[i].id;
  }
  return '';
}

export function hasChapters(chapters = []) {
  return Array.isArray(chapters) && chapters.some((ch) => ch && ch.id);
}

export function neighborChapters(chapters = [], chapterId) {
  const list = sortedChapters(chapters);
  const index = list.findIndex((ch) => ch.id === chapterId);
  return {
    prev: index > 0 ? list[index - 1] : null,
    next: index >= 0 && index < list.length - 1 ? list[index + 1] : null,
    index,
  };
}
