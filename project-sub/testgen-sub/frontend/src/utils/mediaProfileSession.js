/** 与主应用 menu-master/frontend/src/composables/useMediaProfile.js 键名一致 */
export const MEDIA_PROFILE_ID_KEY = 'ams-media-profile-id';

export function getMediaProfileId() {
  try {
    const id = sessionStorage.getItem(MEDIA_PROFILE_ID_KEY);
    return id || undefined;
  } catch {
    return undefined;
  }
}
