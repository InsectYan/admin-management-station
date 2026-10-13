import { ref, watch } from 'vue';

const STORAGE_KEY = 'ams-nav-collapsed';

function readStored() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

export function useNavCollapse() {
  const collapsed = ref(readStored());
  watch(collapsed, (value) => {
    try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch { /* ignore */ }
  });
  function toggleCollapsed() { collapsed.value = !collapsed.value; }
  return { collapsed, toggleCollapsed };
}
