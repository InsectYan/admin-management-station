import { defineStore } from 'pinia';
import { getJob, cancelJob, pauseJob, retryJob } from '../services/generationService';

export const useGenerationJobStore = defineStore('generationJob', {
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
    pollingTimer: null,
  }),
  getters: {
    totalConfigured: (s) => {
      const schemes = s.agentContext?.scheme_targets || s.jobOptions?.scheme_targets || [];
      const fromSchemes = schemes.reduce((sum, t) => sum + (Number(t.count) || 0), 0);
      if (fromSchemes > 0) return fromSchemes;
      const targets = s.agentContext?.target_states || [];
      return targets.reduce((sum, t) => sum + (Number(t.count) || 0), 0);
    },
    totalProduced: (s) => {
      const fromCtx = s.agentContext?.total_produced;
      if (fromCtx != null && !Number.isNaN(Number(fromCtx))) {
        return Number(fromCtx);
      }
      const targets = s.agentContext?.target_states || [];
      return targets.reduce((sum, t) => sum + (Number(t.produced) || 0), 0);
    },
    /** 顶部进度条：已写入条数 / 目标总条数 */
    overallPercent() {
      const total = this.totalConfigured;
      if (!total) return 0;
      return Math.min(100, Math.round((this.totalProduced / total) * 100));
    },
    currentTarget: (s) => s.agentContext?.current_target || null,
    targetStates: (s) => s.agentContext?.target_states || [],
    schemeTargets: (s) => s.agentContext?.scheme_targets || s.jobOptions?.scheme_targets || [],
    isTerminal: (s) => [ 'done', 'partial', 'failed', 'cancelled' ].includes(s.status),
    isActive: (s) => [ 'waiting', 'running', 'paused', 'pending' ].includes(s.status),
    /** 任务结束且已有入库条数时可查看用例库（含取消/失败保留数据） */
    canViewResults(s) {
      const produced = s.agentContext?.total_produced != null
        ? Number(s.agentContext.total_produced)
        : (s.agentContext?.target_states || []).reduce((sum, t) => sum + (Number(t.produced) || 0), 0);
      if (!produced) return false;
      return [ 'done', 'partial', 'cancelled', 'failed' ].includes(s.status);
    },
    /** 各目标已执行轮次的最大值 */
    totalRoundAttempts(s) {
      const targets = s.agentContext?.target_states || [];
      if (!targets.length) {
        return Number(s.agentContext?.current_target?.round_attempts || 0);
      }
      return Math.max(...targets.map(t => Number(t.round_attempts || t.attempt || 0)), 0);
    },
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
      this.projectCode = job.project_code ?? '';
      this.projectName = job.project_name ?? '';
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
