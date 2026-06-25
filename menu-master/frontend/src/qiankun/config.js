const SUBAPP_ENTRY_MAP = {
  'novel-app': import.meta.env.VITE_SUBAPP_NOVEL_ENTRY,
  'testgen-app': import.meta.env.VITE_SUBAPP_TESTGEN_ENTRY,
};

function normalizeEntry(entry) {
  if (!entry) return '';
  if (entry.startsWith('//') || entry.startsWith('http://') || entry.startsWith('https://')) {
    return entry;
  }
  if (entry.startsWith('/')) {
    return entry;
  }
  return `//${entry.replace(/^\/+/, '')}`;
}

export function resolveSubAppEntry(microappName, menuEntry) {
  if (menuEntry) {
    return normalizeEntry(menuEntry);
  }
  const configured = SUBAPP_ENTRY_MAP[microappName];
  if (configured) {
    return normalizeEntry(configured);
  }
  return `/subapps/${microappName}/`;
}

export function buildActiveRule(routePrefix) {
  return `/media/${routePrefix}`;
}

export function buildBasename(routePrefix) {
  return `/media/${routePrefix}`;
}

export function buildMenuPath(routePrefix) {
  return `/media/${routePrefix}`;
}
