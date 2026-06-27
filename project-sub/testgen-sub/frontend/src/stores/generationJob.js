import { defineStore } from 'pinia';
import { getJob, cancelJob, pauseJob, retryJob } from '../services/generationService';

export const useGenerationJobStore = defineStore('generationJob', {
  state: () => ({
    jobId: null,
    status: 'pending',
    currentPhase: 'analyze',
    progress: { analyze: 0, functional: 0, edge: 0, review: 0 },
    steps: [],
    errorMessage: null,
    agentContext: {},
    jobOptions: {},
    testTypes: [],
    pollingTimer: null,
  }),
  getters: {
    overallPercent: (s) => {
      const vals = Object.values(s.progress);
      if (!vals.length) return 0;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    },
    isTerminal: (s) => ['done', 'failed', 'cancelled'].includes(s.status),
  },
  actions: {
    async fetchJob(jobId) {
      const job = await getJob(jobId);
      this.jobId = job.id ?? job.job_id ?? jobId;
      this.status = job.status;
      this.currentPhase = job.current_phase ?? this.currentPhase;
      this.progress = job.progress ?? this.progress;
      this.steps = job.steps ?? [];
      this.errorMessage = job.error_message ?? null;
      this.agentContext = job.agent_context ?? {};
      this.jobOptions = job.options ?? {};
      this.testTypes = job.test_types ?? [];
      if (this.isTerminal) this.stopPolling();
      return job;
    },
    startPolling(jobId, intervalMs = 2000) {
      this.stopPolling();
      this.jobId = jobId;
      this.pollingTimer = setInterval(() => this.fetchJob(jobId), intervalMs);
      return this.fetchJob(jobId);
    },
    stopPolling() {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer);
        this.pollingTimer = null;
      }
    },
    async cancel() {
      await cancelJob(this.jobId);
      await this.fetchJob(this.jobId);
      this.stopPolling();
    },
    async pause() {
      await pauseJob(this.jobId);
      await this.fetchJob(this.jobId);
    },
    async retry() {
      await retryJob(this.jobId);
      return this.startPolling(this.jobId);
    },
    reset() {
      this.stopPolling();
      this.$reset();
    },
  },
});
