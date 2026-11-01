import { onMounted, ref } from 'vue';
import { fetchStylePresets } from '../services/novelService.js';

let cache = null;
let pending = null;

export function useStylePresets() {
  const presets = ref(cache || []);

  async function load() {
    if (cache) {
      presets.value = cache;
      return cache;
    }
    if (!pending) {
      pending = fetchStylePresets()
        .then((list) => {
          cache = Array.isArray(list) ? list : [];
          return cache;
        })
        .catch((err) => {
          pending = null;
          throw err;
        });
    }
    presets.value = await pending;
    return presets.value;
  }

  onMounted(() => {
    load().catch(() => {});
  });

  return { presets, load };
}
