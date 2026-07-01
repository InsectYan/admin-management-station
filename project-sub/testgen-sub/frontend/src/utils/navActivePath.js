import { navMenus } from '@/config/navMenu.js';

function flattenNavLeaves(nodes, acc = []) {
  for (const node of nodes) {
    if (node.path) acc.push(node);
    if (node.children?.length) flattenNavLeaves(node.children, acc);
  }
  return acc;
}

const navLeaves = flattenNavLeaves(navMenus);

function matchesPrefix(path, prefix) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function matchesAliases(path, aliases = []) {
  return aliases.some(alias => matchesPrefix(path, alias));
}

/**
 * 根据当前路由解析侧栏应高亮的 menu index
 */
export function resolveNavActivePath(path) {
  const projectDetail = path.match(/^\/projects\/[^/]+\/(environments|variables|monitoring|sync)/);
  if (projectDetail) return '/projects';
  if (path.match(/^\/projects\/[^/]+\/edit/)) return '/projects';
  if (path === '/projects/new') return '/projects';

  const sorted = [ ...navLeaves ].sort((a, b) => {
    const lenA = Math.max(
      (a.activePrefix || a.path).length,
      ...(a.activeAliases || []).map(s => s.length),
    );
    const lenB = Math.max(
      (b.activePrefix || b.path).length,
      ...(b.activeAliases || []).map(s => s.length),
    );
    return lenB - lenA;
  });

  for (const leaf of sorted) {
    const prefix = leaf.activePrefix || leaf.path;
    if (matchesPrefix(path, prefix) || matchesAliases(path, leaf.activeAliases)) {
      return leaf.path;
    }
  }

  if (path.startsWith('/fitness')) return '/fitness/dashboard';
  if (path.startsWith('/testgen') || path.startsWith('/scope') || path.startsWith('/suite')) {
    return '/testgen/scope';
  }
  if (path.startsWith('/projects')) return '/projects';
  return path;
}
