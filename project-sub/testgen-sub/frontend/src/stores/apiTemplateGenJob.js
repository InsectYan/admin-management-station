import { defineStore } from 'pinia';
import {
  getApiTemplateJob,
  cancelApiTemplateJob,
  retryApiTemplateJob,
} from '../services/apiTemplateGenService';

export const useApiTemplateGenJobStore = defineStore('apiTemplateGenJob', {
  state: () => ({
    jobId: null,
    status: 'pending',
    currentPhase: 'analyze',
    progress: { overall_percent: 0, analyze: 0, generate: 0, review: 0 },
    steps: [],
    errorMessage: null,
    agentContext: {},
    jobOptions: {},
    projectCode: '',
    projectName: '',
    importStatus: 'pending',
    importedCount: 0,
    pollingTimer: null,
  }),
  getters: {
    overallPercent: (s) => {
      const fromProgress = s.progress?.overall_percent;
      if (fromProgress != null && !Number.isNaN(Number(fromProgress))) {
        return Math.round(Number(fromProgress));
      }
      const fromCtx = s.agentContext?.overall_percent;
      if (fromCtx != null && !Number.isNaN(Number(fromCtx))) {
        return Math.round(Number(fromCtx));
      }
      return 0;
    },
    generatedTemplates: (s) => s.agentContext?.generated_templates || [],
    templatesCount: (s) => s.agentContext?.templates_count ?? (s.agentContext?.generated_templates?.length || 0),
    isTerminal: (s) => [ 'done', 'failed', 'cancelled' ].includes(s.status),
    isImported: (s) => s.importStatus === 'imported',
  },
  actions: {
    async fetchJob(jobId) {
      const job = await getApiTemplateJob(jobId);
      this.jobId = job.id ?? job.job_id ?? jobId;
      this.status = job.status;
      this.currentPhase = job.current_phase ?? this.currentPhase;
      this.progress = job.progress ?? this.progress;
      this.steps = job.steps ?? [];
      this.errorMessage = job.error_message ?? null;
      this.agentContext = job.agent_context ?? {};
      this.jobOptions = job.options ?? {};
      this.projectCode = job.project_code ?? '';
      this.projectName = job.project_name ?? '';
      this.importStatus = job.import_status ?? 'pending';
      this.importedCount = job.imported_count ?? 0;
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
      await cancelApiTemplateJob(this.jobId);
      await this.fetchJob(this.jobId);
      this.stopPolling();
    },
    async retry() {
      await retryApiTemplateJob(this.jobId);
      return this.startPolling(this.jobId);
    },
    reset() {
      this.stopPolling();
      this.$reset();
    },
  },
});
