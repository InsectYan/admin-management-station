<template>
  <div v-loading="loading" class="step-gantt">
    <div class="gantt-toolbar">
      <el-tag v-if="liveCount" type="info" size="small">实时 {{ liveCount }} 步</el-tag>
      <el-button size="small" :loading="loading" @click="reload">刷新</el-button>
    </div>

    <el-empty v-if="!displaySteps.length && !loading" description="暂无执行步骤（TS-05-CHAIN 等多步引擎会逐步记录）" />

    <div v-else class="gantt-chart">
      <div
        v-for="step in displaySteps"
        :key="stepKey(step)"
        class="gantt-row"
        :class="`status-${step.status}`"
      >
        <div class="gantt-label">
          <span class="step-idx">#{{ step.step_index + 1 }}</span>
          <el-tag size="small" :type="sourceTag(step.source)">{{ step.source }}</el-tag>
          <span class="step-name">{{ step.step_name || step.runner }}</span>
        </div>
        <div class="gantt-bar-wrap">
          <div
            class="gantt-bar"
            :style="barStyle(step)"
            :title="`${step.duration_ms ?? '?'}ms`"
          >
            <span class="bar-text">{{ step.duration_ms != null ? `${step.duration_ms}ms` : '…' }}</span>
          </div>
        </div>
        <div class="gantt-meta">
          <el-tag :type="statusTag(step.status)" size="small">{{ step.status }}</el-tag>
          <el-button
            v-if="step.trace_id"
            link
            type="primary"
            size="small"
            @click="$emit('select-trace', step.trace_id)"
          >
            trace
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { fetchRunSteps } from '@/services/observabilityService.js';

const props = defineProps({
  runId: { type: String, required: true },
  /** SSE 推送的实时步骤 */
  liveSteps: { type: Array, default: () => [] },
  /** getRun 返回的 steps */
  initialSteps: { type: Array, default: () => [] },
});

defineEmits([ 'select-trace' ]);

const loading = ref(false);
const persistedSteps = ref([]);

const liveCount = computed(() => props.liveSteps.length);

const displaySteps = computed(() => {
  const map = new Map();
  for (const s of persistedSteps.value) {
    const key = s.id || `${s.step_index}-${s.started_at}`;
    map.set(key, { ...s });
  }
  for (const s of props.liveSteps) {
    const key = s.step_id || `${s.step_index}-${s.started_at}`;
    const prev = map.get(key) || {};
    map.set(key, { ...prev, ...s });
  }
  return [ ...map.values() ].sort((a, b) => (a.step_index ?? 0) - (b.step_index ?? 0));
});

const maxDuration = computed(() => {
  const vals = displaySteps.value.map(s => Number(s.duration_ms) || 0);
  return Math.max(...vals, 1);
});

function stepKey(step) {
  return step.id || step.step_id || `${step.step_index}-${step.step_name}`;
}

function barStyle(step) {
  const dur = Number(step.duration_ms) || 0;
  const pct = step.status === 'running'
    ? 30
    : Math.max(8, Math.round((dur / maxDuration.value) * 100));
  return { width: `${pct}%` };
}

function sourceTag(source) {
  if (source === 'explore') return 'warning';
  if (source === 'config') return '';
  return 'info';
}

function statusTag(status) {
  if (status === 'pass') return 'success';
  if (status === 'fail') return 'danger';
  if (status === 'running') return 'warning';
  return 'info';
}

async function reload() {
  if (!props.runId) return;
  loading.value = true;
  try {
    const data = await fetchRunSteps(props.runId);
    persistedSteps.value = data?.steps || [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (props.initialSteps?.length) {
    persistedSteps.value = props.initialSteps;
  } else {
    reload();
  }
});

watch(() => props.runId, reload);
watch(() => props.initialSteps, val => {
  if (val?.length) persistedSteps.value = val;
}, { deep: true });
</script>

<style scoped>
.step-gantt {
  min-height: 80px;
}
.gantt-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.gantt-row {
  display: grid;
  grid-template-columns: 220px 1fr 100px;
  gap: 8px;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}
.gantt-label {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}
.step-idx {
  font-weight: 600;
  min-width: 24px;
}
.step-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gantt-bar-wrap {
  background: var(--el-fill-color-light);
  border-radius: 4px;
  height: 22px;
  overflow: hidden;
}
.gantt-bar {
  height: 100%;
  background: var(--el-color-primary-light-5);
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  min-width: 40px;
  transition: width 0.3s ease;
}
.status-pass .gantt-bar { background: var(--el-color-success-light-5); }
.status-fail .gantt-bar { background: var(--el-color-danger-light-5); }
.status-running .gantt-bar { background: var(--el-color-warning-light-5); }
.bar-text {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}
.gantt-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
}
</style>
