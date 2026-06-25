import { defineStore } from 'pinia';
import { listTestCases } from '../services/testCaseService';

export const useTestSuiteStore = defineStore('testSuite', {
  state: () => ({
    cases: [],
    filters: { job_id: null, module: '', type: '', priority: '', status: '' },
    loading: false,
  }),
  getters: {
    filteredCases(state) {
      return state.cases.filter((tc) => {
        const { module, type, priority, status } = state.filters;
        if (module && tc.module !== module) return false;
        if (type && tc.type !== type) return false;
        if (priority && tc.priority !== priority) return false;
        if (status && tc.status !== status) return false;
        return true;
      });
    },
  },
  actions: {
    async loadCases(params = {}) {
      this.loading = true;
      try {
        const result = await listTestCases(params);
        this.cases = Array.isArray(result) ? result : result?.items ?? [];
      } finally {
        this.loading = false;
      }
    },
    setFilters(filters) {
      this.filters = { ...this.filters, ...filters };
    },
  },
});
