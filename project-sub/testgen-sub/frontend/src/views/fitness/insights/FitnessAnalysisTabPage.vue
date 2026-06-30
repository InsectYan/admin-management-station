<template>
  <div v-loading="loading">
    <el-alert
      v-if="isReadinessTab && readinessP0Todo > 0"
      type="warning"
      :closable="false"
      style="margin-bottom:12px"
    >
      <template #title>
        P0 待建 {{ readinessP0Todo }} 项 — 请优先配置自动化
      </template>
      <el-button
        type="primary"
        link
        data-testid="fitness-readiness-config-link"
        @click="goP0Config"
      >
        前往用例配置
      </el-button>
    </el-alert>
    <FitnessLabeledTable
      :data="rows"
      :columns="columns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="load"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { fetchView } from '@/services/fitnessService.js';

const VIEW_MAP = {
  readiness: 'v_analysis_release_readiness',
  'p0-blockers': 'v_analysis_p0_blockers_todo',
  'risk-gap': 'v_analysis_risk_gap',
  'scheme-matrix': 'v_analysis_scheme_validation_matrix',
  'dimension-automation': 'v_analysis_dimension_automation',
};

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const rows = ref([]);
const columns = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const p0ConfigItemId = ref('');

const isReadinessTab = computed(() => (route.params.tab || 'readiness') === 'readiness');
const readinessP0Todo = computed(() => Number(rows.value[0]?.p0_auto_todo) || 0);

async function load() {
  const tab = route.params.tab || 'readiness';
  const view = VIEW_MAP[tab];
  if (!view) return;
  loading.value = true;
  try {
    const data = await fetchView(view, { page: page.value, pageSize: pageSize.value });
    rows.value = data.list || [];
    columns.value = data.columns || [];
    total.value = data.total || 0;
    if (isReadinessTab.value && readinessP0Todo.value > 0) {
      const blockers = await fetchView('v_analysis_p0_blockers_todo', { page: 1, pageSize: 1 });
      p0ConfigItemId.value = blockers.list?.[0]?.item_id || '';
    }
  } finally {
    loading.value = false;
  }
}

function goP0Config() {
  if (p0ConfigItemId.value) {
    router.push(`/fitness/assets/items/${encodeURIComponent(p0ConfigItemId.value)}/config`);
    return;
  }
  router.push({ path: '/fitness/assets/items', query: { is_p0_blocker: 'true' } });
}

watch(() => route.params.tab, () => {
  page.value = 1;
  load();
}, { immediate: true });

onMounted(load);
</script>
