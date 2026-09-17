import { onBeforeUnmount, ref } from 'vue';
import { deployStreamUrl, fetchDeployLogs } from '../services/opsDeployService.js';

const TERMINAL = new Set(['success', 'failed', 'aborted']);

export function useDeployStream() {
  const connected = ref(false);
  let source = null;
  let retries = 0;
  let timer = null;
  let lastId = 0;
  let closed = false;

  function close() {
    closed = true;
    connected.value = false;
    if (timer) clearTimeout(timer);
    source?.close();
    source = null;
  }

  function bind(es, handlers) {
    es.addEventListener('log', (ev) => {
      try {
        const line = JSON.parse(ev.data);
        if (line?.id) lastId = Math.max(lastId, Number(line.id));
        handlers.onLog?.(line);
      } catch { /* ignore */ }
    });
    es.addEventListener('status', (ev) => {
      try {
        const job = JSON.parse(ev.data);
        handlers.onStatus?.(job);
        if (TERMINAL.has(job?.status)) close();
      } catch { /* ignore */ }
    });
    es.addEventListener('end', (ev) => {
      try {
        handlers.onEnd?.(JSON.parse(ev.data));
      } catch {
        handlers.onEnd?.({});
      }
      close();
    });
    es.onerror = () => {
      es.close();
      connected.value = false;
      if (closed || retries >= 8) return;
      const wait = 2 ** retries * 1000;
      retries += 1;
      timer = setTimeout(() => reconnect(handlers), wait);
    };
  }

  async function reconnect(handlers) {
    if (closed) return;
    try {
      const data = await fetchDeployLogs(handlers.jobId, { after: lastId || undefined });
      for (const line of data.list || []) {
        if (line?.id) lastId = Math.max(lastId, Number(line.id));
        handlers.onLog?.(line);
      }
    } catch { /* 继续重连 */ }
    open(handlers);
  }

  function open(handlers) {
    if (closed) return;
    source?.close();
    source = new EventSource(deployStreamUrl(handlers.jobId, lastId || undefined));
    connected.value = true;
    bind(source, handlers);
  }

  function start(jobId, handlers = {}) {
    close();
    closed = false;
    retries = 0;
    lastId = Number(handlers.after || 0);
    open({ jobId, ...handlers });
  }

  onBeforeUnmount(close);

  return { connected, start, close };
}
