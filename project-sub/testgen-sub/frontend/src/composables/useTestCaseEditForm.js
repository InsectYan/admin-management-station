import { ref, reactive, watch } from 'vue';
import { getTestCase, updateTestCase } from '../services/testCaseService.js';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export function useTestCaseEditForm(caseIdRef) {
  const loading = ref(false);
  const saving = ref(false);
  const activeStep = ref(0);

  const form = reactive({
    title: '',
    module: '',
    type: 'functional',
    priority: 'medium',
    tags: [],
    preconditions: '',
    steps: [],
    expected: '',
    http_config: {
      method: 'GET',
      url: '',
      headers: {},
      body: null,
      assertions: [],
    },
  });

  async function load(id) {
    if (!id) return;
    loading.value = true;
    try {
      const tc = await getTestCase(id);
      form.title = tc.title || '';
      form.module = tc.module || '';
      form.type = tc.type || 'functional';
      form.priority = tc.priority || 'medium';
      form.tags = Array.isArray(tc.tags) ? [...tc.tags] : [];
      form.preconditions = tc.preconditions || '';
      form.steps = Array.isArray(tc.steps) ? [...tc.steps] : [];
      form.expected = tc.expected || '';
      form.http_config = {
        method: tc.http_config?.method || 'GET',
        url: tc.http_config?.url || '',
        headers: tc.http_config?.headers || {},
        body: tc.http_config?.body ?? null,
        assertions: Array.isArray(tc.http_config?.assertions)
          ? [...tc.http_config.assertions]
          : [],
      };
    } finally {
      loading.value = false;
    }
  }

  watch(
    caseIdRef,
    (id) => {
      if (id) load(id);
    },
    { immediate: true },
  );

  function validate() {
    if (!form.title?.trim()) return '标题必填';
    const method = (form.http_config.method || 'GET').toUpperCase();
    if (!HTTP_METHODS.includes(method)) return 'HTTP 方法无效';
    return null;
  }

  async function save(id) {
    const err = validate();
    if (err) throw new Error(err);
    saving.value = true;
    try {
      const payload = {
        title: form.title,
        module: form.module,
        type: form.type,
        priority: form.priority,
        tags: form.tags,
        preconditions: form.preconditions,
        steps: form.steps,
        expected: form.expected,
        http_config: {
          ...form.http_config,
          method: (form.http_config.method || 'GET').toUpperCase(),
        },
      };
      return await updateTestCase(id, payload);
    } finally {
      saving.value = false;
    }
  }

  return {
    form,
    loading,
    saving,
    activeStep,
    load,
    save,
    validate,
    HTTP_METHODS,
  };
}
