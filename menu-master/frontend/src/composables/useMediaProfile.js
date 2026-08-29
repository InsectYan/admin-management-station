/** sessionStorage 键名 — 与子应用 utils/mediaProfileSession.js 保持一致 */
export const MEDIA_PROFILE_ID_KEY = 'ams-media-profile-id';
export const MEDIA_PROFILE_BY_MENU_KEY = 'ams-media-profile-by-menu';

export function readMediaProfileId() {
  try {
    return sessionStorage.getItem(MEDIA_PROFILE_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function writeMediaProfileId(profileId) {
  try {
    sessionStorage.setItem(MEDIA_PROFILE_ID_KEY, profileId || '');
  } catch {
    /* ignore quota / private mode */
  }
}

function readProfileByMenu() {
  try {
    return JSON.parse(sessionStorage.getItem(MEDIA_PROFILE_BY_MENU_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeProfileByMenu(map) {
  try {
    sessionStorage.setItem(MEDIA_PROFILE_BY_MENU_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function syncMediaProfileForMenuChange(prevMenuKey, nextMenuKey, currentProfileId) {
  const map = readProfileByMenu();

  if (prevMenuKey && currentProfileId) {
    map[prevMenuKey] = currentProfileId;
  }

  writeProfileByMenu(map);

  const nextProfile = (nextMenuKey && map[nextMenuKey]) || currentProfileId || '';
  if (nextProfile) {
    writeMediaProfileId(nextProfile);
  }

  return nextProfile;
}

export function persistMediaProfileForMenu(menuKey, profileId) {
  writeMediaProfileId(profileId);
  if (!menuKey) return;

  const map = readProfileByMenu();
  map[menuKey] = profileId;
  writeProfileByMenu(map);
}
