import { onMounted, onUnmounted, watch, toRef } from 'vue';
import { useRouter } from 'vue-router';
import { useTestRunStore } from '../stores/testRun.js';

const TERMINAL = ['success', 'failed', 'cancelled'];

export function useTestRunProgress(runId) {
  const store = useTestRunStore();
  const router = useRouter();
  const idRef = toRef(runId);

  onMounted(() => {
    if (idRef.value) store.startPolling(idRef.value);
  });

  onUnmounted(() => {
    store.stopPolling();
  });

  watch(idRef, (id) => {
    if (id) store.startPolling(id);
  });

  watch(
    () => store.status,
    (s) => {
      if (TERMINAL.includes(s) && idRef.value) {
        router.push({ name: 'test-run-results', params: { runId: idRef.value } });
      }
    },
  );

  return { store };
}
