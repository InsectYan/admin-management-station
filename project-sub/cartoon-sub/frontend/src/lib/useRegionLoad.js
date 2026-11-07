import { inject, ref } from 'vue';

export function useRegionLoad(options = {}) {
  const track = inject('cartoon-region-load', null);
  const loading = ref(false);
  if (options.immediate && !track) loading.value = true;

  async function run(work) {
    if (track) return track(work);
    loading.value = true;
    try {
      return await work();
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    covered: Boolean(track),
    run,
  };
}
