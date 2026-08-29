/** 与主应用 menu-master/frontend/src/composables/useMediaProfile.js 键名一致 */
export const MEDIA_PROFILE_ID_KEY = 'ams-media-profile-id';

/**
 * 每次调用非文本模型前读取侧栏「多模态」选中的 profile。
 * @returns {string|undefined}
 */
export function getMediaProfileId() {
  try {
    const id = sessionStorage.getItem(MEDIA_PROFILE_ID_KEY);
    return id || undefined;
  } catch {
    return undefined;
  }
}
