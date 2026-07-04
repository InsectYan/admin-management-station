<template>
  <PageShell title="可观测性专题">
    <p class="topic-desc">OpenTelemetry 工具调度链路与 Journey / 字段可观测测试覆盖。</p>
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="24">
        <el-card shadow="never">
          <template #header>OTel 采集栈状态</template>
          <el-descriptions v-if="otelHealth" :column="3" border size="small">
            <el-descriptions-item label="查询启用">{{ otelHealth.enabled ? '是' : '否' }}</el-descriptions-item>
            <el-descriptions-item label="Jaeger">{{ otelHealth.jaeger_reachable ? '可达' : '不可达' }}</el-descriptions-item>
            <el-descriptions-item label="Query URL">{{ otelHealth.jaeger_query_url || '—' }}</el-descriptions-item>
          </el-descriptions>
          <el-skeleton v-else :rows="2" animated />
        </el-card>
      </el-col>
    </el-row>
    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>维度自动化</template>
          <div v-for="row in dimRows" :key="row.dimension_id" class="bar-row">
            <span>{{ row.dimension_name || row.dimension_id }}</span>
            <el-progress :percentage="Number(row.auto_coverage_pct) || 0" :stroke-width="12" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>发版就绪</template>
          <p v-if="readiness">
            信号：<el-tag :type="signalTag">{{ readiness.release_signal || readiness.signal || '—' }}</el-tag>
          </p>
          <p>P0 待建：{{ readiness?.p0_auto_todo ?? '—' }}</p>
          <el-button link type="primary" @click="router.push('/fitness/insights/analysis/readiness')">分析详情</el-button>
        </el-card>
      </el-col>
    </el-row>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchView } from '@/services/fitnessService.js';
import { fetchObservabilityHealth } from '@/services/observabilityService.js';

const router = useRouter();
const dimRows = ref([]);
const readiness = ref(null);
const otelHealth = ref(null);

const signalTag = computed(() => {
  const s = (readiness.value?.release_signal || readiness.value?.signal || '').toUpperCase();
  if (s === 'GREEN') return 'success';
  if (s === 'YELLOW') return 'warning';
  if (s === 'RED') return 'danger';
  return 'info';
});

onMounted(async () => {
  const [ dim, ready, health ] = await Promise.all([
    fetchView('v_metric_dimension_summary', { pageSize: 8 }),
    fetchView('v_analysis_release_readiness', { page: 1, pageSize: 1 }),
    fetchObservabilityHealth().catch(() => null),
  ]);
  dimRows.value = dim.list || [];
  readiness.value = ready.list?.[0] || null;
  otelHealth.value = health;
});
</script>

<style scoped>
.topic-desc {
  color: var(--el-text-color-secondary);
  margin-bottom: 16px;
}
.bar-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}
</style>
