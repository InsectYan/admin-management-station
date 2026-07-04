<template>
  <div v-loading="loading" class="tool-chain-panel">
    <el-alert
      v-if="!health?.jaeger_reachable"
      type="warning"
      :closable="false"
      title="Jaeger 不可达"
      description="请确认 deploy 栈已启动 jaeger 与 otel-collector，且被测 Agent 已开启 OTEL_EXPORT_MODE=local。"
      style="margin-bottom:12px"
    />

    <div v-if="!traceIds.length && !loading" class="empty-hint">
      <el-empty description="本次运行未采集到 trace_id（需被测 Agent 开启 OTEL 并在响应头返回 X-Trace-Id）" />
    </div>

    <el-card v-if="agentLogs.length" shadow="never" style="margin-bottom:12px">
      <template #header>Agent Skill 审计（BFF 侧）</template>
      <el-table :data="agentLogs" size="small">
        <el-table-column prop="skill" label="Skill" width="160" />
        <el-table-column prop="action" label="Action" width="120" />
        <el-table-column label="Tools" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="t in (row.tools || [])" :key="t.name" size="small" style="margin:2px">
              {{ t.name }}
            </el-tag>
            <span v-if="!(row.tools || []).length">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="duration_ms" label="耗时" width="80">
          <template #default="{ row }">{{ row.duration_ms != null ? `${row.duration_ms}ms` : '—' }}</template>
        </el-table-column>
        <el-table-column prop="ok" label="结果" width="70">
          <template #default="{ row }">
            <el-tag :type="row.ok ? 'success' : 'danger'" size="small">{{ row.ok ? 'ok' : 'fail' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Trace" width="90">
          <template #default="{ row }">
            <el-button v-if="row.trace_id" link type="primary" size="small" @click="selectTrace(row.trace_id)">
              {{ shortId(row.trace_id) }}
            </el-button>
            <span v-else>—</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <template v-if="traceIds.length">
      <div class="trace-tabs">
        <el-radio-group v-model="activeTraceId" size="small" @change="loadActiveTrace">
          <el-radio-button
            v-for="tid in traceIds"
            :key="tid"
            :value="tid"
          >
            {{ shortId(tid) }}
          </el-radio-button>
        </el-radio-group>
        <el-button size="small" :loading="loading" @click="reload">刷新链路</el-button>
      </div>

      <el-descriptions v-if="activeTrace" :column="3" border size="small" style="margin:12px 0">
        <el-descriptions-item label="Trace ID">{{ activeTrace.trace_id }}</el-descriptions-item>
        <el-descriptions-item label="Span 数">{{ activeTrace.span_count }}</el-descriptions-item>
        <el-descriptions-item label="服务">{{ (activeTrace.services || []).join(', ') || '—' }}</el-descriptions-item>
      </el-descriptions>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>工具调度链（pi.tool）</template>
            <el-empty v-if="!toolChain.length" description="无 pi.tool span（可能为 reasoning 模型或未启用 OTEL）" />
            <el-timeline v-else>
              <el-timeline-item
                v-for="step in toolChain"
                :key="step.span_id"
                :type="step.status === 'error' ? 'danger' : 'success'"
                :timestamp="`${step.duration_ms}ms`"
                placement="top"
              >
                <div class="tool-step">
                  <span class="tool-order">#{{ step.order }}</span>
                  <el-tag size="small" type="info">{{ step.tool }}</el-tag>
                  <span class="tool-name">{{ step.name }}</span>
                </div>
              </el-timeline-item>
            </el-timeline>
          </el-card>
        </el-col>
        <el-col :span="12">
          <el-card shadow="never">
            <template #header>全链路 Span 瀑布</template>
            <div class="span-waterfall">
              <div
                v-for="span in waterfallSpans"
                :key="span.span_id"
                class="span-row"
                :style="{ paddingLeft: `${span.depth * 16 + 8}px` }"
              >
                <span class="span-kind" :class="`kind-${span.kind}`">{{ span.kind }}</span>
                <span class="span-op">{{ span.operation_name }}</span>
                <span class="span-dur">{{ span.duration_ms }}ms</span>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-collapse v-if="activeTrace" style="margin-top:12px">
        <el-collapse-item title="原始 Span JSON" name="raw">
          <pre class="json-block">{{ rawJson }}</pre>
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import {
  fetchObservabilityHealth,
  fetchRunAgentAudit,
  fetchRunTraces,
  fetchTrace,
} from '@/services/observabilityService.js';

const props = defineProps({
  runId: { type: String, required: true },
  /** 预提取的 trace_id 列表（来自 run results artifacts） */
  initialTraceIds: { type: Array, default: () => [] },
  /** 从甘特图跳转聚焦的 trace */
  focusTraceId: { type: String, default: '' },
});

const loading = ref(false);
const health = ref(null);
const traceIds = ref([]);
const activeTraceId = ref('');
const activeTrace = ref(null);
const errors = ref([]);
const agentLogs = ref([]);

const toolChain = computed(() => activeTrace.value?.tool_chain || []);

const waterfallSpans = computed(() => {
  const spans = activeTrace.value?.spans || [];
  if (!spans.length) return [];
  const byId = new Map(spans.map(s => [ s.span_id, s ]));
  const depthOf = (span, seen = new Set()) => {
    if (!span.parent_span_id || seen.has(span.span_id)) return 0;
    seen.add(span.span_id);
    const parent = byId.get(span.parent_span_id);
    return parent ? 1 + depthOf(parent, seen) : 0;
  };
  return spans
    .map(s => ({ ...s, depth: depthOf(s) }))
    .sort((a, b) => a.start_time_ms - b.start_time_ms);
});

const rawJson = computed(() => (activeTrace.value ? JSON.stringify(activeTrace.value, null, 2) : ''));

function shortId(id) {
  return id ? `${id.slice(0, 8)}…` : '—';
}

function selectTrace(traceId) {
  if (!traceId) return;
  const tid = String(traceId).toLowerCase();
  if (!traceIds.value.includes(tid)) traceIds.value.push(tid);
  activeTraceId.value = tid;
  loadActiveTrace();
}

async function loadAgentAudit() {
  if (!props.runId) return;
  try {
    const data = await fetchRunAgentAudit(props.runId);
    agentLogs.value = data?.logs || [];
    for (const log of agentLogs.value) {
      if (log.trace_id && !traceIds.value.includes(log.trace_id)) {
        traceIds.value.push(String(log.trace_id).toLowerCase());
      }
    }
  } catch {
    agentLogs.value = [];
  }
}

async function loadActiveTrace() {
  if (!activeTraceId.value) return;
  loading.value = true;
  try {
    activeTrace.value = await fetchTrace(activeTraceId.value);
  } catch {
    activeTrace.value = null;
  } finally {
    loading.value = false;
  }
}

async function reload() {
  if (!props.runId) return;
  loading.value = true;
  try {
    const data = await fetchRunTraces(props.runId);
    traceIds.value = data.trace_ids?.length ? data.trace_ids : traceIds.value;
    errors.value = data.errors || [];
    if (data.traces?.length) {
      activeTraceId.value = data.traces[0].trace_id;
      activeTrace.value = data.traces[0];
    } else if (traceIds.value.length) {
      activeTraceId.value = traceIds.value[0];
      await loadActiveTrace();
    }
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  health.value = await fetchObservabilityHealth().catch(() => null);
  traceIds.value = [ ...new Set(props.initialTraceIds.filter(Boolean).map(String)) ];
  await loadAgentAudit();
  if (props.focusTraceId) {
    selectTrace(props.focusTraceId);
  } else if (traceIds.value.length) {
    activeTraceId.value = traceIds.value[0];
    await loadActiveTrace();
  } else if (props.runId) {
    await reload();
  }
});

watch(() => props.runId, async () => {
  await loadAgentAudit();
  await reload();
});

watch(() => props.focusTraceId, tid => {
  if (tid) selectTrace(tid);
});
</script>

<style scoped>
.tool-chain-panel {
  min-height: 120px;
}
.trace-tabs {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.tool-step {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-order {
  font-weight: 600;
  color: var(--el-text-color-secondary);
  min-width: 24px;
}
.tool-name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.span-waterfall {
  max-height: 360px;
  overflow: auto;
  font-size: 12px;
}
.span-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}
.span-kind {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  min-width: 48px;
  text-align: center;
}
.kind-tool { background: #e1f3d8; color: #529b2e; }
.kind-pipeline { background: #d9ecff; color: #337ecc; }
.kind-agent { background: #fdf6ec; color: #b88230; }
.kind-http { background: #f4f4f5; color: #606266; }
.kind-worker { background: #fde2e2; color: #c45656; }
.kind-other { background: #f4f4f5; color: #909399; }
.span-op {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.span-dur {
  color: var(--el-text-color-secondary);
  min-width: 56px;
  text-align: right;
}
.json-block {
  font-size: 11px;
  max-height: 280px;
  overflow: auto;
  background: var(--el-fill-color-light);
  padding: 8px;
  border-radius: 4px;
}
</style>
