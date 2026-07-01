<template>
  <PageShell title="运行控制台" v-loading="loading">
    <template #extra>
      <div v-if="run" class="console-toolbar">
        <el-button
          v-if="run.item_id"
          size="small"
          type="primary"
          data-testid="fitness-console-back-detail"
          @click="goItemDetail"
        >
          用例详情
        </el-button>
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
      <el-descriptions-item label="TS">{{ run.scheme_id }}</el-descriptions-item>
      <el-descriptions-item label="VS">{{ run.validation_id || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ run.status }}</el-descriptions-item>
      <el-descriptions-item label="判定">{{ run.verdict || '-' }}</el-descriptions-item>
      <el-descriptions-item label="进度" :span="2">{{ progressLabel }}</el-descriptions-item>
    </el-descriptions>

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
      <el-tab-pane label="子项结果" name="subs">
        <el-table :data="run?.results||[]" size="small">
          <el-table-column prop="sub_index" label="#" width="50" />
          <el-table-column prop="input_summary" label="输入" min-width="160" />
          <el-table-column prop="output_summary" label="输出" min-width="160" />
          <el-table-column prop="sub_verdict" label="判定" width="80">
            <template #default="{ row }">
              <el-tag :type="row.sub_verdict === 'pass' ? 'success' : 'danger'" size="small">
                {{ row.sub_verdict }}
              </el-tag>
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
            :title="`#${art.sub_index} ${art.mode || 'obs'}`"
          >
            <pre class="json-block">{{ art.json }}</pre>
          </el-collapse-item>
        </el-collapse>
      </el-tab-pane>
    </el-tabs>

    <el-card v-if="run && isTerminal" shadow="never" style="margin-top:16px">
      <template #header>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span>AI 解读</span>
          <el-button size="small" type="primary" :loading="explainLoading" @click="loadExplain">
            解读失败原因
          </el-button>
        </div>
      </template>
      <div v-if="explainMarkdown" class="explain-md">{{ explainMarkdown }}</div>
      <el-empty v-else description="点击按钮生成解读（不改变 verdict）" />
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
  explainFtRun,
} from '@/services/fitnessService.js';
import { downloadJson } from '@/utils/fitnessExport.js';
import { buildItemDetailRoute, buildRunConsoleRoute } from '@/utils/itemListQuery.js';

const TERMINAL = new Set([ 'success', 'failed', 'cancelled' ]);

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const run = ref(null);
const liveProgress = ref(null);
const resultTab = ref('subs');
const explainLoading = ref(false);
const explainMarkdown = ref('');
const rerunning = ref(false);
const exportingLog = ref(false);
const analyzingLoad = ref(false);
const preReviewing = ref(false);
const writingPlan = ref(false);
const showPlanDialog = ref(false);
const selectedPlanId = ref(null);
const planOptions = ref([]);
/** @type {EventSource | null} */
let es = null;

const isTerminal = computed(() => run.value && TERMINAL.has(run.value.status));

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

const passCount = computed(() =>
  (run.value?.results || []).filter(r => r.sub_verdict === 'pass').length,
);
const failCount = computed(() =>
  (run.value?.results || []).filter(r => r.sub_verdict === 'fail').length,
);

const journeyArtifacts = computed(() => {
  const out = [];
  for (const row of run.value?.results || []) {
    const detail = row.assertion_detail;
    const artifacts = detail?.artifacts;
    const payload = artifacts?.journey || artifacts?.obs || artifacts?.http?.body;
    if (payload) {
      out.push({
        sub_index: row.sub_index,
        mode: artifacts?.mode,
        json: JSON.stringify(payload, null, 2),
      });
    }
  }
  return out;
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
}

function goItemDetail() {
  if (!run.value?.item_id) return;
  router.push(buildItemDetailRoute(run.value.item_id, {
    fromRun: run.value.id,
    listQuery: route.query,
  }));
}

async function loadExplain() {
  explainLoading.value = true;
  try {
    const data = await explainFtRun(route.params.runId);
    explainMarkdown.value = data.markdown || '';
  } catch (e) {
    explainMarkdown.value = e?.response?.data?.message || e.message || '解读失败';
  } finally {
    explainLoading.value = false;
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

function startStream() {
  closeStream();
  es = streamFtRun(route.params.runId, async payload => {
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

onBeforeUnmount(closeStream);
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
.explain-md {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.6;
}
</style>
