<template>
  <div v-loading="loading">
    <div v-if="showDimensionChart" class="dimension-chart">
      <h4 class="chart-title">维度自动化覆盖率 Top</h4>
      <div v-for="row in chartRows" :key="row.dimension_id" class="chart-row">
        <span class="chart-label">{{ row.dimension_name || row.dimension_id }}</span>
        <el-progress
          :percentage="Number(row.auto_coverage_pct) || 0"
          :stroke-width="16"
          :text-inside="true"
        />
      </div>
    </div>
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

const showDimensionChart = computed(() => (route.params.tab || 'dimensions') === 'dimensions');
const chartRows = computed(() =>
  [ ...rows.value ]
    .sort((a, b) => (Number(b.auto_coverage_pct) || 0) - (Number(a.auto_coverage_pct) || 0))
    .slice(0, 8),
);

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

<style scoped>
.dimension-chart {
  margin-bottom: 20px;
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}
.chart-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}
.chart-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.chart-label {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
