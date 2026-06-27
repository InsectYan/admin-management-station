/** sessionStorage 键名 — 与子应用 utils/llmProfileSession.js 保持一致 */
export const LLM_PROFILE_ID_KEY = 'ams-llm-profile-id';
export const LLM_PROFILE_BY_MENU_KEY = 'ams-llm-profile-by-menu';

export function readLlmProfileId() {
  try {
    return sessionStorage.getItem(LLM_PROFILE_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function writeLlmProfileId(profileId) {
  try {
    sessionStorage.setItem(LLM_PROFILE_ID_KEY, profileId || '');
  } catch {
    /* ignore quota / private mode */
  }
}

function readProfileByMenu() {
  try {
    return JSON.parse(sessionStorage.getItem(LLM_PROFILE_BY_MENU_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeProfileByMenu(map) {
  try {
    sessionStorage.setItem(LLM_PROFILE_BY_MENU_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/**
 * 主菜单切换时：保存离开菜单的模型选择，并恢复目标菜单的历史选择。
 * @returns {string} 切换后应使用的 profile id
 */
export function syncProfileForMenuChange(prevMenuKey, nextMenuKey, currentProfileId) {
  const map = readProfileByMenu();

  if (prevMenuKey && currentProfileId) {
    map[prevMenuKey] = currentProfileId;
  }

  writeProfileByMenu(map);

  const nextProfile = (nextMenuKey && map[nextMenuKey]) || currentProfileId || '';
  if (nextProfile) {
    writeLlmProfileId(nextProfile);
  }

  return nextProfile;
}

export function persistProfileForMenu(menuKey, profileId) {
  writeLlmProfileId(profileId);
  if (!menuKey) return;

  const map = readProfileByMenu();
  map[menuKey] = profileId;
  writeProfileByMenu(map);
}
