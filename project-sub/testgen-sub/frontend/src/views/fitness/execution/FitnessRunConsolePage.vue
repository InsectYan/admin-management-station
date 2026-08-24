<template>
  <PageShell title="运行控制台" v-loading="loading">
    <template #extra>
      <div v-if="run" class="console-toolbar">
        <el-button
          data-testid="fitness-rerun-failed"
          size="small"
          :loading="rerunning"
          :disabled="!canRerunFailed"
          @click="handleRerunFailed"
        >
          重跑失败项
        </el-button>
        <el-button
          data-testid="fitness-export-run-log"
          size="small"
          :loading="exportingLog"
          @click="handleExportLog"
        >
          导出 JSON 日志
        </el-button>
        <el-button
          data-testid="fitness-write-plan-report"
          size="small"
          @click="showPlanDialog = true"
        >
          写入计划报告
        </el-button>
        <el-button
          v-if="run.scheme_id === 'TS-09-LOAD'"
          data-testid="fitness-analyze-load"
          size="small"
          :loading="analyzingLoad"
          @click="handleAnalyzeLoad"
        >
          压测分析
        </el-button>
        <el-button
          v-if="run.scheme_id === 'TS-10-MAN'"
          data-testid="fitness-pre-review"
          size="small"
          :loading="preReviewing"
          @click="handlePreReview"
        >
          AI 预审
        </el-button>
      </div>
    </template>
    <el-descriptions v-if="run" :column="2" border>
      <el-descriptions-item label="Run ID">{{ run.id }}</el-descriptions-item>
      <el-descriptions-item label="用例">
        <el-button
          v-if="run.item_id"
          link
          type="primary"
          data-testid="fitness-console-item-detail"
          @click="goItemDetail"
        >
          {{ run.item_id }}
        </el-button>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="状态">{{ run.status }}</el-descriptions-item>
      <el-descriptions-item label="判定">{{ run.verdict || '-' }}</el-descriptions-item>
      <el-descriptions-item label="进度" :span="2">{{ progressLabel }}</el-descriptions-item>
    </el-descriptions>

    <el-card v-if="displayPhases.length" shadow="never" style="margin-top:16px">
      <template #header>执行方案</template>
      <SchemePhaseTable :phases="displayPhases" show-verdict />
    </el-card>

    <el-row v-if="run" :gutter="16" style="margin:16px 0">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>达标率</template>
          <el-progress
            type="dashboard"
            :percentage="passRatePercent"
            :status="rateProgressStatus"
          />
          <p class="rate-caption">
            {{ passRatePercent }}%
            <template v-if="passkLabel"> · {{ passkLabel }}</template>
            <template v-else> / 阈值 {{ targetRatePercent }}%</template>
          </p>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <PassFailChart :pass-count="passCount" :fail-count="failCount" />
        </el-card>
      </el-col>
    </el-row>

    <el-progress
      v-if="run && !isTerminal"
      :percentage="progressPercent"
      :status="progressStatus"
      style="margin-bottom:16px"
    />
    <el-alert
      v-if="run?.progress?.error"
      type="error"
      :title="run.progress.error"
      :closable="false"
      style="margin-bottom:16px"
    />

    <el-tabs v-model="resultTab" style="margin-top:16px">
      <el-tab-pane label="主方案子项" name="subs">
        <p v-if="isApiCtxRun" class="tab-hint">
          内容验证子项（不含前置校验）：输入为样本 message，输出为 Agent response，判定为语义置信度；达标率仅统计本表。
        </p>
        <el-table
          :data="isApiCtxRun ? apiCtxContentRows : contentResults"
          size="small"
          row-key="sub_index"
        >
          <el-table-column type="expand">
            <template #default="{ row }">
              <div v-if="isApiCtxRun" class="expand-semantic">
                <el-descriptions :column="1" size="small" border>
                  <el-descriptions-item v-if="row.semanticView?.expectedObservation" label="期望观测">
                    {{ row.semanticView.expectedObservation }}
                  </el-descriptions-item>
                  <el-descriptions-item v-if="row.semanticView?.reasons?.length" label="判定说明">
                    {{ row.semanticView.reasons.join('；') }}
                  </el-descriptions-item>
                  <el-descriptions-item v-if="row.semanticView?.httpSummary" label="HTTP 链路">
                    {{ row.semanticView.httpSummary }}
                  </el-descriptions-item>
                  <el-descriptions-item
                    v-if="row.semanticView?.functionalVerdict"
                    label="功能性"
                  >
                    {{ row.semanticView.functionalVerdict }}
                  </el-descriptions-item>
                </el-descriptions>
              </div>
              <div v-else-if="row.sub_verdict === 'fail'" class="expand-failure">
                <RunSubResultExpand :row="row" />
              </div>
              <span v-else class="expand-ok">已通过</span>
            </template>
          </el-table-column>
          <el-table-column prop="sub_index" label="#" width="50" />
          <template v-if="isApiCtxRun">
            <el-table-column label="输入 (message)" min-width="180">
              <template #default="{ row }">
                <span class="message-cell">{{ row.semanticView?.inputMessage || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="输出 (response)" min-width="220">
              <template #default="{ row }">
                <el-tooltip
                  v-if="row.semanticView?.responseFull"
                  :content="row.semanticView.responseFull"
                  placement="top-start"
                  :show-after="300"
                  popper-class="response-tooltip"
                >
                  <span class="response-cell">{{ row.semanticView.responseExcerpt }}</span>
                </el-tooltip>
                <span v-else class="response-cell muted">{{ row.semanticView?.responseExcerpt || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="置信度" width="120">
              <template #default="{ row }">
                <el-tooltip
                  v-if="row.semanticView?.confidencePercent != null"
                  :content="semanticTooltip(row.semanticView)"
                  placement="top"
                >
                  <el-tag
                    :type="row.semanticView.verdictType"
                    size="small"
                    effect="plain"
                  >
                    {{ row.semanticView.verdictLabel }}
                  </el-tag>
                </el-tooltip>
                <el-tag
                  v-else
                  :type="row.semanticView?.verdictType || 'info'"
                  size="small"
                  effect="plain"
                >
                  {{ row.semanticView?.verdictLabel || '—' }}
                </el-tag>
              </template>
            </el-table-column>
          </template>
          <template v-else>
            <el-table-column prop="input_summary" label="输入" min-width="160" />
            <el-table-column prop="output_summary" label="输出" min-width="160" />
            <el-table-column prop="sub_verdict" label="判定" width="80">
              <template #default="{ row }">
                <FitnessStatusTag prop="sub_verdict" :row="row" />
              </template>
            </el-table-column>
          </template>
        </el-table>
      </el-tab-pane>
      <el-tab-pane v-if="isApiCtxRun" label="前置校验" name="preflight">
        <el-alert
          v-if="preflightChecks.length"
          :type="preflightOk ? 'success' : 'error'"
          :closable="false"
          style="margin-bottom:12px"
          :title="preflightOk ? '前置链路全部通过' : '前置链路存在失败，内容验证已跳过'"
        />
        <el-empty v-if="!preflightChecks.length" description="无 preflight 步骤" />
        <el-table v-else :data="preflightChecks" size="small" row-key="sub_index">
          <el-table-column prop="sub_index" label="#" width="50" />
          <el-table-column prop="input_summary" label="输入" min-width="140" />
          <el-table-column prop="output_summary" label="输出" min-width="180" />
          <el-table-column prop="sub_verdict" label="判定" width="80">
            <template #default="{ row }">
              <FitnessStatusTag prop="sub_verdict" :row="row" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane v-if="run?.secondary_run?.results?.length" label="辅方案链路" name="secondary">
        <el-table :data="run.secondary_run.results" size="small" row-key="sub_index">
          <el-table-column prop="sub_index" label="#" width="50" />
          <el-table-column prop="input_summary" label="输入" min-width="160" />
          <el-table-column prop="output_summary" label="输出" min-width="160" />
          <el-table-column prop="sub_verdict" label="判定" width="80">
            <template #default="{ row }">
              <FitnessStatusTag prop="sub_verdict" :row="row" />
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="Journey / 可观测" name="journey">
        <el-empty v-if="!journeyArtifacts.length" description="无可观测 artifact（TS-08 或含 journey 的子项）" />
        <el-collapse v-else>
          <el-collapse-item
            v-for="(art, i) in journeyArtifacts"
            :key="i"
            :title="art.summary || `#${art.sub_index} ${art.mode || 'obs'}`"
          >
            <el-descriptions v-if="art.status || art.intent" :column="2" size="small" border style="margin-bottom:8px">
              <el-descriptions-item v-if="art.status" label="status">{{ art.status }}</el-descriptions-item>
              <el-descriptions-item v-if="art.intent" label="intent">{{ art.intent }}</el-descriptions-item>
            </el-descriptions>
            <div v-if="art.response" class="journey-response">
              <div class="journey-section-title">response</div>
              <pre class="json-block journey-response-body">{{ art.response }}</pre>
            </div>
            <el-collapse v-if="art.streamEvents?.length || art.debugLog" style="margin-top:8px">
              <el-collapse-item v-if="art.streamEvents?.length" :title="`stream_events (${art.streamEvents.length})`">
                <pre class="json-block">{{ JSON.stringify(art.streamEvents, null, 2) }}</pre>
              </el-collapse-item>
              <el-collapse-item v-if="art.debugLog" title="debug_log">
                <pre class="json-block">{{ JSON.stringify(art.debugLog, null, 2) }}</pre>
              </el-collapse-item>
            </el-collapse>
            <el-collapse style="margin-top:8px">
              <el-collapse-item title="完整 JSON">
                <pre class="json-block">{{ art.json }}</pre>
              </el-collapse-item>
            </el-collapse>
          </el-collapse-item>
        </el-collapse>
      </el-tab-pane>
      <el-tab-pane label="步骤甘特图" name="steps">
        <RunStepGanttPanel
          v-if="run?.id"
          :run-id="String(run.id)"
          :initial-steps="run.steps || []"
          :live-steps="liveSteps"
          @select-trace="onSelectTrace"
        />
      </el-tab-pane>
      <el-tab-pane label="工具调度链路" name="toolchain">
        <ToolChainTracePanel
          v-if="run?.id"
          :run-id="String(run.id)"
          :initial-trace-ids="collectedTraceIds"
          :focus-trace-id="focusTraceId"
        />
      </el-tab-pane>
    </el-tabs>

    <el-card v-if="run && isTerminal" shadow="never" style="margin-top:16px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div>AI 解读失败原因</div>
            <div class="explain-sub">对比配置项、目标项与实际返回，分析失败差异（最长约 15 分钟）</div>
          </div>
          <el-button
            size="small"
            type="primary"
            :loading="explainLoading"
            :disabled="failCount === 0"
            @click="loadExplain"
          >
            解读失败原因
          </el-button>
        </div>
      </template>
      <div v-if="failCount === 0" class="explain-hint">
        全部子项已通过，无需失败解读。
      </div>
      <template v-else>
        <div v-if="explainLoading" class="explain-thinking">
          <div class="explain-thinking-title">AI 思考中…</div>
          <pre class="explain-thinking-body">{{ explainThinkingText || '正在组装对照材料并调用模型…' }}</pre>
        </div>
        <div v-else-if="explainMarkdown" class="explain-md">{{ explainMarkdown }}</div>
        <div v-else-if="explainError" class="explain-error">{{ explainError }}</div>
        <el-empty v-else :description="`共 ${failCount} 条失败子项，点击按钮由 AI 做差异分析（不改变 verdict）`" />
      </template>
    </el-card>

    <el-dialog v-model="showPlanDialog" title="写入计划报告" width="420px">
      <el-select v-model="selectedPlanId" placeholder="选择计划" filterable style="width:100%">
        <el-option
          v-for="p in planOptions"
          :key="p.id"
          :label="`${p.name} (${p.version_tag || '-'})`"
          :value="p.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="showPlanDialog = false">取消</el-button>
        <el-button type="primary" :loading="writingPlan" :disabled="!selectedPlanId" @click="handleWritePlan">
          写入
        </el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import PassFailChart from '@/components/fitness/PassFailChart.vue';
import SchemePhaseTable from '@/components/fitness/SchemePhaseTable.vue';
import FitnessStatusTag from '@/components/fitness/FitnessStatusTag.vue';
import RunSubResultExpand from '@/components/fitness/RunSubResultExpand.vue';
import ToolChainTracePanel from '@/components/observability/ToolChainTracePanel.vue';
import RunStepGanttPanel from '@/components/observability/RunStepGanttPanel.vue';
import {
  analyzeLoadRun,
  exportRunLog,
  fetchFtRun,
  fetchPlan,
  fetchPlans,
  preReviewRun,
  rerunFailedRun,
  savePlanResults,
  streamFtRun,
  streamExplainFtRun,
} from '@/services/fitnessService.js';
import { downloadJson } from '@/utils/fitnessExport.js';
import { getLlmProfileId } from '@/utils/llmProfileSession.js';
import { buildItemDetailRoute, buildRunConsoleRoute } from '@/utils/itemListQuery.js';
import { buildRunFailurePanels, truncateLogText } from '@/utils/runResultDetail.js';
import {
  mapApiCtxSemanticRows,
  formatSemanticTooltip,
} from '@/utils/apiCtxSemanticRow.js';

const TERMINAL = new Set([ 'success', 'failed', 'cancelled' ]);

function resultPhase(row) {
  const detail = row?.assertion_detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && detail.phase) {
    return detail.phase;
  }
  return null;
}

function isContentResult(row) {
  const phase = resultPhase(row);
  if (phase === 'preflight') return false;
  if (phase === 'api_case') return true;
  if (row?.sub_verdict === 'skip') return false;
  return phase == null;
}

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const run = ref(null);
const liveProgress = ref(null);
const liveSchemePhases = ref(null);
const resultTab = ref('subs');
const liveSteps = ref([]);
const focusTraceId = ref('');
const explainLoading = ref(false);
const explainMarkdown = ref('');
const explainThinkingLines = ref([]);
const explainError = ref('');
/** @type {AbortController | null} */
let explainAbort = null;
const explainThinkingText = computed(() => explainThinkingLines.value.slice(-40).join('\n'));
const rerunning = ref(false);
const exportingLog = ref(false);
const analyzingLoad = ref(false);
const preReviewing = ref(false);
const writingPlan = ref(false);
const showPlanDialog = ref(false);
const selectedPlanId = ref(null);
const planOptions = ref([]);
const failureCollapseActive = ref('');
/** @type {EventSource | null} */
let es = null;

const isTerminal = computed(() => run.value && TERMINAL.has(run.value.status));

const displayPhases = computed(() => liveSchemePhases.value || run.value?.scheme_phases || []);

const progressPercent = computed(() => {
  const p = liveProgress.value?.percent ?? run.value?.progress?.percent;
  return Number.isFinite(Number(p)) ? Number(p) : 0;
});

const passRatePercent = computed(() => {
  const rate = liveProgress.value?.pass_rate ?? run.value?.progress?.pass_rate;
  return Number.isFinite(Number(rate)) ? Number(rate) : 0;
});

const targetRatePercent = computed(() => {
  const rate = liveProgress.value?.target_rate ?? run.value?.progress?.target_rate;
  return Number.isFinite(Number(rate)) ? Number(rate) : 100;
});

const passkLabel = computed(() => {
  const p = run.value?.progress;
  if (p?.passk_M != null && p?.passk_N != null) {
    return `Pass^k M=${p.passk_M} N=${p.passk_N}`;
  }
  const thr = run.value?.validation_id === 'VS-08-PASSK';
  if (thr && run.value?.progress?.pass_count != null) {
    return `通过 ${run.value.progress.pass_count} 次`;
  }
  return '';
});

const isApiCtxRun = computed(() =>
  run.value?.progress?.execution_mode === 'api_ctx'
  || (run.value?.results || []).some(r => resultPhase(r) != null),
);

const preflightChecks = computed(() => {
  const fromProgress = run.value?.progress?.preflight_checks;
  if (Array.isArray(fromProgress) && fromProgress.length) {
    return fromProgress;
  }
  return (run.value?.results || []).filter(r => resultPhase(r) === 'preflight');
});

const preflightOk = computed(() =>
  run.value?.progress?.preflight_ok ?? preflightChecks.value.every(r => r.sub_verdict === 'pass'),
);

const contentResults = computed(() => {
  if (!isApiCtxRun.value) return run.value?.results || [];
  return (run.value?.results || []).filter(isContentResult);
});

const apiCtxContentRows = computed(() =>
  mapApiCtxSemanticRows(contentResults.value),
);

function semanticTooltip(view) {
  return formatSemanticTooltip(view || {});
}

const passCount = computed(() =>
  contentResults.value.filter(r => r.sub_verdict === 'pass').length,
);
const failCount = computed(() =>
  contentResults.value.filter(r => r.sub_verdict === 'fail').length,
);

const failurePanels = computed(() => buildRunFailurePanels(run.value?.results || []));

const runLogTail = computed(() => {
  const tail = run.value?.progress?.log_tail;
  if (!Array.isArray(tail) || !tail.length) return '';
  return tail.join('\n');
});

function formatLog(text) {
  return truncateLogText(text);
}

const journeyArtifacts = computed(() => {
  const out = [];
  for (const row of run.value?.results || []) {
    const detail = row.assertion_detail;
    const artifacts = detail?.artifacts || (typeof detail === 'object' && !Array.isArray(detail) ? detail.artifacts : null);
    const payload = artifacts?.journey || artifacts?.obs || artifacts?.http?.body;
    if (!payload) continue;

    const body = typeof payload === 'object' ? payload : {};
    const response = body.response || artifacts?.response_text || '';
    const intent = body.intent || body.debug_log?.response?.intent || '';
    const status = body.status || '';
    const summary = [
      `#${row.sub_index}`,
      status ? `status=${status}` : '',
      intent ? `intent=${intent}` : '',
      response ? `response=${String(response).slice(0, 40)}…` : '',
    ].filter(Boolean).join(' · ');

    out.push({
      sub_index: row.sub_index,
      mode: artifacts?.mode,
      summary,
      response: typeof response === 'string' ? response : '',
      intent,
      status,
      streamEvents: body.stream_events || [],
      debugLog: body.debug_log || null,
      json: JSON.stringify(payload, null, 2),
    });
  }
  return out;
});

const collectedTraceIds = computed(() => {
  const ids = new Set();
  for (const row of run.value?.results || []) {
    const wrapped = row.assertion_detail;
    const artifacts = row.artifacts
      || (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped) ? wrapped.artifacts : null);
    const tid = artifacts?.http?.trace_id || artifacts?.trace_id;
    if (tid) ids.add(String(tid));
  }
  return [ ...ids ];
});

const progressLabel = computed(() => {
  const phase = liveProgress.value?.phase ?? run.value?.progress?.phase ?? run.value?.status;
  const rate = liveProgress.value?.pass_rate ?? run.value?.progress?.pass_rate;
  const completed = liveProgress.value?.completed;
  const total = liveProgress.value?.total;
  if (completed && total) return `${phase} · ${completed}/${total} · 达标率 ${rate}%`;
  if (rate != null) return `${phase} · 达标率 ${rate}%`;
  return phase || '-';
});

const progressStatus = computed(() => {
  if (run.value?.status === 'failed') return 'exception';
  if (run.value?.status === 'success') return 'success';
  return undefined;
});

const rateProgressStatus = computed(() => {
  if (isTerminal.value && run.value?.verdict === 'pass') return 'success';
  if (isTerminal.value && run.value?.verdict === 'fail') return 'exception';
  return undefined;
});

const canRerunFailed = computed(() =>
  isTerminal.value && failCount.value > 0 && run.value?.status !== 'cancelled',
);

async function reloadRun() {
  run.value = await fetchFtRun(route.params.runId);
  liveSchemePhases.value = run.value?.scheme_phases || null;
  if (isTerminal.value) liveSteps.value = run.value?.steps || [];
  if (failurePanels.value.length) {
    failureCollapseActive.value = failurePanels.value[0].sub_index;
  }
}

function goItemDetail() {
  if (!run.value?.item_id) return;
  router.push(buildItemDetailRoute(run.value.item_id, {
    fromRun: run.value.id,
    listQuery: route.query,
  }));
}

async function loadExplain() {
  if (failCount.value === 0) {
    ElMessage.info('全部子项已通过');
    return;
  }
  if (explainAbort) {
    explainAbort.abort();
    explainAbort = null;
  }
  explainAbort = new AbortController();
  explainLoading.value = true;
  explainMarkdown.value = '';
  explainError.value = '';
  explainThinkingLines.value = [ '开始调用 AI…' ];
  try {
    const llm_profile = getLlmProfileId();
    await streamExplainFtRun(
      route.params.runId,
      {
        ...(llm_profile ? { llm_profile } : {}),
        focus: 'failed',
      },
      {
        signal: explainAbort.signal,
        onThinking: (p) => {
          const line = p?.label || p?.thinking || p?.delta || p?.phase || p?.assertion_diff_text || '';
          if (!line) return;
          const text = typeof line === 'string' ? line : JSON.stringify(line);
          explainThinkingLines.value = [ ...explainThinkingLines.value, text ].slice(-80);
        },
        onResult: (data) => {
          explainThinkingLines.value = [];
          explainMarkdown.value = data?.markdown || '';
          if (!explainMarkdown.value) {
            explainError.value = 'AI 未返回解读正文';
            ElMessage.warning(explainError.value);
          } else {
            ElMessage.success('AI 差异分析完成');
          }
        },
        onError: (e) => {
          explainThinkingLines.value = [];
          explainError.value = e?.message || '解读失败';
        },
      },
    );
  } catch (e) {
    if (e?.name === 'AbortError') return;
    explainThinkingLines.value = [];
    explainError.value = e?.message || '解读失败';
    ElMessage.error(explainError.value);
  } finally {
    explainLoading.value = false;
    explainAbort = null;
  }
}

async function handleRerunFailed() {
  rerunning.value = true;
  try {
    const next = await rerunFailedRun(route.params.runId);
    router.push(buildRunConsoleRoute(next.id, route.query));
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '重跑失败');
  } finally {
    rerunning.value = false;
  }
}

async function handleExportLog() {
  exportingLog.value = true;
  try {
    const data = await exportRunLog(route.params.runId);
    downloadJson(`fitness-run-${route.params.runId}-log.json`, data);
    ElMessage.success('日志已导出');
  } catch (e) {
    downloadJson(`fitness-run-${route.params.runId}-log.json`, run.value);
    ElMessage.warning(e?.response?.data?.message || '使用本地 run 快照导出');
  } finally {
    exportingLog.value = false;
  }
}

async function loadPlanOptions() {
  const data = await fetchPlans({ page: 1, pageSize: 100 });
  planOptions.value = data.list || [];
  selectedPlanId.value = planOptions.value[0]?.id ?? null;
}

async function handleWritePlan() {
  if (!selectedPlanId.value || !run.value) return;
  writingPlan.value = true;
  try {
    const plan = await fetchPlan(selectedPlanId.value);
    const planItem = (plan.items || []).find(i => i.item_id === run.value.item_id);
    if (!planItem) {
      ElMessage.warning('该计划不包含当前用例');
      return;
    }
    const existing = (plan.results || []).find(r => r.plan_item_id === planItem.id);
    await savePlanResults(selectedPlanId.value, [{
      plan_item_id: planItem.id,
      item_id: run.value.item_id,
      result_status: run.value.verdict === 'pass' ? 'passed' : run.value.verdict === 'fail' ? 'failed' : 'pending',
      validation_result: run.value.verdict || existing?.validation_result || '',
      notes: existing?.notes || '',
      ft_run_id: run.value.id,
    }]);
    ElMessage.success('已写入计划报告');
    showPlanDialog.value = false;
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '写入失败');
  } finally {
    writingPlan.value = false;
  }
}

async function handleAnalyzeLoad() {
  analyzingLoad.value = true;
  try {
    const data = await analyzeLoadRun(route.params.runId);
    explainMarkdown.value = data.markdown || data.summary || JSON.stringify(data, null, 2);
    ElMessage.success('压测分析完成');
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '分析失败');
  } finally {
    analyzingLoad.value = false;
  }
}

async function handlePreReview() {
  preReviewing.value = true;
  try {
    const data = await preReviewRun(route.params.runId);
    explainMarkdown.value = data.markdown || JSON.stringify(data, null, 2);
    ElMessage.success('预审完成');
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '预审失败');
  } finally {
    preReviewing.value = false;
  }
}

function closeStream() {
  if (es) {
    es.close();
    es = null;
  }
}

function onSelectTrace(traceId) {
  focusTraceId.value = traceId;
  resultTab.value = 'toolchain';
}

function upsertLiveStep(payload) {
  const key = payload.step_id || `${payload.step_index}-${payload.started_at}`;
  const idx = liveSteps.value.findIndex(s =>
    (s.step_id && s.step_id === payload.step_id)
    || (`${s.step_index}-${s.started_at}` === key),
  );
  if (idx >= 0) {
    liveSteps.value[idx] = { ...liveSteps.value[idx], ...payload };
  } else {
    liveSteps.value.push(payload);
  }
}

function startStream() {
  closeStream();
  es = streamFtRun(route.params.runId, async payload => {
    if (payload.event_type === 'step') {
      upsertLiveStep(payload);
      return;
    }
    if (payload.scheme_phases) {
      liveSchemePhases.value = payload.scheme_phases;
    }
    liveProgress.value = payload;
    if (payload.status && TERMINAL.has(payload.status)) {
      await reloadRun();
      closeStream();
    } else if (payload.phase === 'done' || payload.phase === 'failed') {
      await reloadRun();
      closeStream();
    }
  });
}

onMounted(async () => {
  loading.value = true;
  try {
    await reloadRun();
    await loadPlanOptions();
    if (!isTerminal.value) startStream();
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  closeStream();
  if (explainAbort) {
    explainAbort.abort();
    explainAbort = null;
  }
});
</script>

<style scoped>
.console-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.rate-caption {
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin-top: 8px;
}
.json-block {
  margin: 0;
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  font-size: 12px;
  overflow: auto;
  max-height: 320px;
}
.explain-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: normal;
}
.explain-md {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.6;
}
.explain-hint {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.explain-thinking {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  padding: 12px;
  background: var(--el-fill-color-lighter);
}
.explain-thinking-title {
  font-size: 13px;
  color: var(--el-color-primary);
  margin-bottom: 8px;
}
.explain-thinking-body {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
}
.explain-error {
  color: var(--el-color-danger);
  font-size: 13px;
  white-space: pre-wrap;
}
.tab-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin: 0 0 8px;
}
.message-cell,
.response-cell {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.response-cell {
  cursor: help;
  color: var(--el-text-color-primary);
}
.response-cell.muted {
  color: var(--el-text-color-secondary);
  cursor: default;
}
.expand-semantic {
  padding: 8px 12px 12px;
}
.journey-section-title {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}
.journey-response-body {
  max-height: 240px;
  white-space: pre-wrap;
}
</style>

<style>
.response-tooltip {
  max-width: 480px;
  white-space: pre-wrap;
  line-height: 1.5;
}
</style>
