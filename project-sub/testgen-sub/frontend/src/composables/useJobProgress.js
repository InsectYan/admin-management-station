import { onMounted, onUnmounted, watch, unref } from 'vue';
import { useGenerationJobStore } from '../stores/generationJob';

export function useJobProgress(jobIdRef) {
  const store = useGenerationJobStore();

  function start(id) {
    if (id) store.startPolling(id);
  }

  onMounted(() => {
    start(unref(jobIdRef));
  });

  onUnmounted(() => {
    store.stopPolling();
  });

  watch(
    () => unref(jobIdRef),
    (id, prev) => {
      if (id && id !== prev) start(id);
    },
  );

  return { store };
}
