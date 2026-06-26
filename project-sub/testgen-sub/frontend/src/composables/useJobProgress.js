import { onMounted, onUnmounted, watch, unref } from 'vue';
import { useRouter } from 'vue-router';
import { useGenerationJobStore } from '../stores/generationJob';

export function useJobProgress(jobIdRef) {
  const store = useGenerationJobStore();
  const router = useRouter();

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

  watch(
    () => store.status,
    (status) => {
      const id = unref(jobIdRef);
      if (status === 'done' && id) {
        router.push({ name: 'test-suite', query: { job_id: id } });
      }
    },
  );

  return { store };
}
