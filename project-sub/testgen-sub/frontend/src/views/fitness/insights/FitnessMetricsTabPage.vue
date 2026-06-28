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
  dimensions: 'v_metric_dimension_summary',
  'prd-goals': 'v_metric_prd_goal_coverage',
  automation: 'v_metric_automation_coverage',
  'risk-guard': 'v_metric_risk_guard_coverage',
  priority: 'v_metric_priority_distribution',
  'station-role': 'v_metric_station_role_matrix',
};

const route = useRoute();
const loading = ref(false);
const rows = ref([]);
const columns = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

async function load() {
  const tab = route.params.tab || 'dimensions';
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
