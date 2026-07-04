import { onMounted, onUnmounted, watch, unref } from 'vue';
import { useApiTemplateGenJobStore } from '../stores/apiTemplateGenJob';

export function useApiTemplateGenProgress(jobIdRef) {
  const store = useApiTemplateGenJobStore();

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
