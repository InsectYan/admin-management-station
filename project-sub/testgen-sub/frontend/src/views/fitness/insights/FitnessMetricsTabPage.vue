<template>
  <div v-loading="loading">
    <div v-if="showDimensionChart" class="chart-panel">
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

    <div v-if="showPriorityPie" class="chart-panel">
      <h4 class="chart-title">优先级分布</h4>
      <div class="pie-legend">
        <div v-for="slice in prioritySlices" :key="slice.label" class="pie-slice">
          <span class="pie-dot" :style="{ background: slice.color }" />
          <span>{{ slice.label }}: {{ slice.count }} ({{ slice.pct }}%)</span>
        </div>
      </div>
      <div class="pie-bar">
        <div
          v-for="slice in prioritySlices"
          :key="slice.label + '-bar'"
          class="pie-segment"
          :style="{ width: slice.pct + '%', background: slice.color }"
          :title="`${slice.label} ${slice.pct}%`"
        />
      </div>
    </div>

    <div v-if="showStationHeatmap" class="chart-panel">
      <h4 class="chart-title">六站 × 业务角色热力矩阵</h4>
      <div class="heatmap">
        <div class="heatmap-header">
          <span class="heatmap-corner" />
          <span v-for="role in heatmapRoles" :key="role" class="heatmap-col">{{ role }}</span>
        </div>
        <div v-for="station in heatmapStations" :key="station" class="heatmap-row">
          <span class="heatmap-row-label">{{ station }}</span>
          <span
            v-for="role in heatmapRoles"
            :key="`${station}-${role}`"
            class="heatmap-cell"
            :style="{ background: heatColor(heatmapMap[`${station}|${role}`]) }"
            :title="`${station} × ${role}: ${heatmapMap[`${station}|${role}`] || 0}`"
          >
            {{ heatmapMap[`${station}|${role}`] || 0 }}
          </span>
        </div>
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

const PIE_COLORS = [ '#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399' ];

const route = useRoute();
const loading = ref(false);
const rows = ref([]);
const columns = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const tab = computed(() => route.params.tab || 'dimensions');
const showDimensionChart = computed(() => tab.value === 'dimensions');
const showPriorityPie = computed(() => tab.value === 'priority');
const showStationHeatmap = computed(() => tab.value === 'station-role');

const chartRows = computed(() =>
  [ ...rows.value ]
    .sort((a, b) => (Number(b.auto_coverage_pct) || 0) - (Number(a.auto_coverage_pct) || 0))
    .slice(0, 8),
);

const prioritySlices = computed(() => {
  const sum = rows.value.reduce((acc, r) => acc + (Number(r.item_count) || 0), 0) || 1;
  return rows.value.map((r, i) => {
    const count = Number(r.item_count) || 0;
    return {
      label: r.priority_name || r.priority_id || `P${i}`,
      count,
      pct: Math.round(100 * count / sum),
      color: PIE_COLORS[i % PIE_COLORS.length],
    };
  });
});

const heatmapStations = computed(() => {
  const set = new Set(rows.value.map(r => r.station_id).filter(Boolean));
  return [ ...set ].sort();
});

const heatmapRoles = computed(() => {
  const set = new Set(rows.value.map(r => r.role_scope_id).filter(Boolean));
  return [ ...set ].sort();
});

const heatmapMap = computed(() => {
  const map = {};
  for (const r of rows.value) {
    map[`${r.station_id}|${r.role_scope_id}`] = Number(r.item_count) || 0;
  }
  return map;
});

const heatMax = computed(() => {
  const vals = Object.values(heatmapMap.value);
  return vals.length ? Math.max(...vals) : 1;
});

function heatColor(count) {
  const n = Number(count) || 0;
  const ratio = n / heatMax.value;
  const alpha = 0.15 + ratio * 0.75;
  return `rgba(64, 158, 255, ${alpha.toFixed(2)})`;
}

async function load() {
  const view = VIEW_MAP[tab.value];
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
.chart-panel {
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
}
.pie-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
  font-size: 13px;
}
.pie-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
}
.pie-bar {
  display: flex;
  height: 18px;
  border-radius: 4px;
  overflow: hidden;
}
.pie-segment {
  min-width: 2px;
  transition: width 0.3s;
}
.heatmap {
  font-size: 12px;
}
.heatmap-header,
.heatmap-row {
  display: grid;
  grid-template-columns: 80px repeat(auto-fit, minmax(48px, 1fr));
  gap: 4px;
  margin-bottom: 4px;
}
.heatmap-corner {
  display: block;
}
.heatmap-col,
.heatmap-row-label {
  text-align: center;
  font-weight: 600;
}
.heatmap-cell {
  text-align: center;
  padding: 6px 2px;
  border-radius: 4px;
}
</style>
