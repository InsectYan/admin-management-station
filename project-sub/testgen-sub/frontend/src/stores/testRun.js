import { defineStore } from 'pinia';
import { getRun, cancelRun, getRunResults } from '../services/testRunService.js';

const TERMINAL = new Set(['success', 'failed', 'cancelled']);

export const useTestRunStore = defineStore('testRun', {
  state: () => ({
    runId: null,
    status: 'pending',
    progress: 0,
    metrics: [],
    logTail: '',
    summary: { running: 0, success: 0, failed: 0, total: 0 },
    items: [],
    mode: 'functional',
    perfAnalysis: null,
    perfAnalysisStatus: 'none',
    pollingTimer: null,
    runDetail: null,
  }),

  getters: {
    isTerminal: (s) => TERMINAL.has(s.status),
  },

  actions: {
    async fetchRun(runId) {
      const data = await getRun(runId);
      this.runId = runId;
      this.status = data.status;
      this.progress = data.progress ?? 0;
      this.metrics = data.metrics ?? [];
      this.logTail = data.log_tail ?? '';
      this.summary = data.summary ?? this.summary;
      this.items = data.items ?? [];
      this.mode = data.mode ?? 'functional';
      this.perfAnalysisStatus = data.perf_analysis_status ?? 'none';
      this.perfAnalysis = data.perf_analysis ?? null;
      this.runDetail = data;
      return data;
    },

    async fetchResults(runId) {
      const data = await getRunResults(runId);
      this.perfAnalysis = data.perf_analysis ?? null;
      this.perfAnalysisStatus = data.perf_analysis_status ?? 'none';
      return data;
    },

    startPolling(runId, intervalMs = 2000) {
      this.stopPolling();
      this.runId = runId;
      const tick = async () => {
        try {
          await this.fetchRun(runId);
          if (this.isTerminal) this.stopPolling();
        } catch {
          /* ignore transient errors while polling */
        }
      };
      tick();
      this.pollingTimer = setInterval(tick, intervalMs);
    },

    stopPolling() {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }
    },

    async cancel() {
      if (!this.runId) return;
      await cancelRun(this.runId);
      await this.fetchRun(this.runId);
    },

    reset() {
      this.stopPolling();
      this.runId = null;
      this.status = 'pending';
      this.progress = 0;
      this.metrics = [];
      this.logTail = '';
      this.summary = { running: 0, success: 0, failed: 0, total: 0 };
      this.items = [];
      this.perfAnalysis = null;
      this.perfAnalysisStatus = 'none';
      this.runDetail = null;
    },
  },
});
