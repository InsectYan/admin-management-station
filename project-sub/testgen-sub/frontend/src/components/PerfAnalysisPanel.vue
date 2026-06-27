<template>
  <el-card v-if="report" shadow="never" class="testgen-perf-analysis">
    <template #header>
      <div class="testgen-perf-analysis-header">
        <span>性能瓶颈分析</span>
        <el-tag :type="riskTagType">{{ report.risk_level || 'unknown' }}</el-tag>
      </div>
    </template>
    <p v-if="report.summary" class="testgen-perf-summary">{{ report.summary }}</p>
    <el-table v-if="report.bottlenecks?.length" :data="report.bottlenecks" size="small" border>
      <el-table-column prop="area" label="领域" width="120" />
      <el-table-column prop="severity" label="严重度" width="90">
        <template #default="{ row }">
          <el-tag :type="severityType(row.severity)" size="small">{{ row.severity }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="evidence" label="证据" min-width="180" show-overflow-tooltip />
      <el-table-column prop="recommendation" label="建议" min-width="180" show-overflow-tooltip />
    </el-table>
    <div v-if="report.optimization_priority?.length" class="testgen-perf-priority">
      <strong>优化优先级：</strong>
      <el-tag v-for="(item, i) in report.optimization_priority" :key="i" size="small" style="margin: 4px">
        {{ item }}
      </el-tag>
    </div>
  </el-card>
  <el-empty v-else-if="status === 'pending'" description="性能分析进行中…" />
  <el-empty v-else-if="status === 'failed'" description="性能分析失败" />
  <el-empty v-else description="暂无 Agent 分析报告（非性能 run 或未触发）" />
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  report: { type: Object, default: null },
  status: { type: String, default: 'none' },
});

const riskTagType = computed(() => {
  const map = { low: 'success', medium: 'warning', high: 'danger' };
  return map[props.report?.risk_level] || 'info';
});

function severityType(sev) {
  const map = { low: 'info', medium: 'warning', high: 'danger' };
  return map[sev] || 'info';
}
</script>

<style scoped>
.testgen-perf-analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.testgen-perf-summary {
  margin: 0 0 12px;
  color: var(--el-text-color-regular);
}
.testgen-perf-priority {
  margin-top: 12px;
}
</style>
