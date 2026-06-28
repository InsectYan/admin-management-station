<template>
  <div v-loading="loading">
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
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
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
const loading = ref(false);
const rows = ref([]);
const columns = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

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
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.tab, () => {
  page.value = 1;
  load();
}, { immediate: true });

onMounted(load);
</script>
