import { ref, watch } from 'vue';

const STORAGE_KEY = 'ams-nav-collapsed';

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStored(collapsed) {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

export function useNavCollapse() {
  const collapsed = ref(readStored());

  watch(collapsed, writeStored);

  function toggleCollapsed() {
    collapsed.value = !collapsed.value;
  }

  return { collapsed, toggleCollapsed };
}
