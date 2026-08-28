import { computed, ref } from 'vue';
import { fetchNovelEnums } from '../services/enumService.js';

const enums = ref({
  genres: [],
  themes: [],
  audiences: [],
  lengths: [],
  update_paces: [],
});
const loaded = ref(false);
const loading = ref(false);
const loadError = ref('');

export function useNovelEnums() {
  async function load(force = false) {
    if (loaded.value && !force) return enums.value;
    loading.value = true;
    loadError.value = '';
    try {
      const data = await fetchNovelEnums();
      enums.value = {
        genres: data?.genres || [],
        themes: data?.themes || [],
        audiences: data?.audiences || [],
        lengths: data?.lengths || [],
        update_paces: data?.update_paces || [],
      };
      loaded.value = true;
    } catch (err) {
      loadError.value = err?.message || '枚举加载失败';
    } finally {
      loading.value = false;
    }
    return enums.value;
  }

  const genreCascaderOptions = computed(() => (
    enums.value.genres.map((cat) => ({
      value: cat.id,
      label: cat.name,
      children: (cat.children || []).map((child) => ({
        value: child.id,
        label: child.name,
      })),
    }))
  ));

  return {
    enums,
    loading,
    loadError,
    load,
    genreCascaderOptions,
  };
}

export function genrePathFromNovel(novel = {}) {
  const path = [];
  if (novel.genre_category_id) path.push(novel.genre_category_id);
  if (novel.genre_subcategory_id) path.push(novel.genre_subcategory_id);
  return path;
}

export function applyGenrePath(form, path = []) {
  const [categoryId, subcategoryId] = Array.isArray(path) ? path : [];
  form.genre_path = path || [];
  form.genre_category_id = categoryId || null;
  form.genre_subcategory_id = subcategoryId || null;
}
