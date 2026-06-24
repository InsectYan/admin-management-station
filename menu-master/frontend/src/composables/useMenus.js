import { onMounted, ref } from 'vue';
import { fetchMenus, fetchRootMenus } from '../services/menuService.js';

export function useMenus() {
  const menus = ref([]);
  const rootMenus = ref([]);
  const loading = ref(true);
  const error = ref(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const [tree, roots] = await Promise.all([fetchMenus(), fetchRootMenus()]);
      menus.value = tree;
      rootMenus.value = roots;
    } catch (err) {
      error.value = err.message || '加载菜单失败';
    } finally {
      loading.value = false;
    }
  }

  onMounted(load);

  return { menus, rootMenus, loading, error, reload: load };
}
