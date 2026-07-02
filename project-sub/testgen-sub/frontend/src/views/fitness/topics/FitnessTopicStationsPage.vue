<template>
  <PageShell title="六站专题">
    <p class="topic-desc">六站（Station）维度测试资产分布 — 数据来自 v_metric_station_role_matrix。</p>
    <div v-if="matrixRows.length" class="heatmap-wrap">
      <div class="heatmap-row heatmap-head">
        <span class="cell label">站 \ 端</span>
        <span v-for="role in roles" :key="role" class="cell">{{ role }}</span>
      </div>
      <div v-for="station in stations" :key="station" class="heatmap-row">
        <span class="cell label">{{ station }}</span>
        <span
          v-for="role in roles"
          :key="`${station}-${role}`"
          class="cell data"
          :style="{ background: heat(cellCount(station, role)) }"
        >
          {{ cellCount(station, role) }}
        </span>
      </div>
    </div>
    <el-button type="primary" link @click="router.push('/fitness/insights/metrics/station-role')">查看六站指标</el-button>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchView } from '@/services/fitnessService.js';

const router = useRouter();
const matrixRows = ref([]);

const stations = computed(() => [ ...new Set(matrixRows.value.map(r => r.station_id)) ].sort());
const roles = computed(() => [ ...new Set(matrixRows.value.map(r => r.role_scope_id)) ].sort());
const maxCount = computed(() => Math.max(1, ...matrixRows.value.map(r => Number(r.item_count) || 0)));

function cellCount(station, role) {
  const row = matrixRows.value.find(r => r.station_id === station && r.role_scope_id === role);
  return Number(row?.item_count) || 0;
}

function heat(count) {
  const ratio = count / maxCount.value;
  return `rgba(64, 158, 255, ${0.15 + ratio * 0.75})`;
}

onMounted(async () => {
  const data = await fetchView('v_metric_station_role_matrix', { pageSize: 200 });
  matrixRows.value = data.list || [];
});
</script>

<style scoped>
.topic-desc {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin-bottom: 16px;
}
.heatmap-wrap {
  margin-bottom: 16px;
  font-size: 13px;
}
.heatmap-row {
  display: flex;
}
.cell {
  flex: 1;
  min-width: 56px;
  text-align: center;
  padding: 8px 4px;
  border: 1px solid var(--el-border-color-lighter);
}
.cell.label {
  flex: 0 0 72px;
  font-weight: 600;
  background: var(--el-fill-color-light);
}
.heatmap-head .cell {
  font-weight: 600;
  background: var(--el-fill-color-light);
}
</style>
