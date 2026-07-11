<template>
  <PageShell :title="plan?.name || '计划详情'" v-loading="loading">
    <template #extra>
      <el-button @click="router.push('/fitness/plans')">返回</el-button>
      <el-button
        type="primary"
        :loading="launching"
        :disabled="!launchItemIds.length || plan?.status === 'running'"
        @click="handleLaunch"
      >
        批量执行{{ launchLabelSuffix }}
      </el-button>
      <el-button type="primary" plain @click="router.push(`/fitness/plans/${id}/report`)">完整报告</el-button>
    </template>

    <el-descriptions v-if="plan" :column="2" border>
      <el-descriptions-item label="版本">{{ plan.version_tag || '-' }}</el-descriptions-item>
      <el-descriptions-item label="环境">{{ plan.env_name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <FitnessStatusTag prop="status" :row="plan" />
      </el-descriptions-item>
      <el-descriptions-item label="用例数">{{ plan.items?.length || 0 }}</el-descriptions-item>
    </el-descriptions>
    
    <el-alert
      v-if="runSummary"
      type="info"
      :closable="false"
      style="margin: 16px 0"
      :title="`通过 ${runSummary.passed} · 失败 ${runSummary.failed} · 跳过 ${runSummary.skipped} · 待执行 ${runSummary.pending}`"
    />

    <el-card v-if="reportStats" shadow="never" style="margin-bottom: 16px">
      <template #header>
        <div class="card-header">
          <span>完成报告摘要</span>
          <div class="card-actions">
            <el-button size="small" :loading="exporting" @click="handleExportReport">导出 Markdown</el-button>
            <el-button size="small" :loading="summarizing" @click="handleSummarize">AI 摘要</el-button>
          </div>
        </div>
      </template>
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="stat-block">
            <div class="stat-label">整体通过率</div>
            <div class="stat-value">{{ reportStats.totals?.pass_rate ?? 0 }}%</div>
            <div class="stat-sub">{{ reportStats.totals?.passed }}/{{ reportStats.totals?.items }} 通过</div>
          </div>
        </el-col>
        <el-col :span="6">
          <div class="stat-block">
            <div class="stat-label">执行达标率</div>
            <div class="stat-value">{{ complianceRate }}%</div>
            <div class="stat-sub">已执行 {{ executedCount }} 条</div>
          </div>
        </el-col>
        <el-col :span="12">
          <div v-if="dimensionRates.length" class="dim-rates">
            <div v-for="d in dimensionRates" :key="d.dimension" class="dim-rate-row">
              <span>{{ d.dimension }}</span>
              <el-progress :percentage="d.passRate" :stroke-width="10" />
            </div>
          </div>
          <span v-else class="muted">暂无维度统计</span>
        </el-col>
      </el-row>
      <el-input
        v-if="reportPreview"
        v-model="reportPreview"
        type="textarea"
        :rows="6"
        readonly
        style="margin-top: 12px"
      />
    </el-card>

    <el-form v-if="plan?.status !== 'running'" label-width="100px" style="margin-top: 12px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="执行环境">
            <el-select v-model="envId" placeholder="选择环境" style="width: 100%">
              <el-option
                v-for="e in envs"
                :key="e.id"
                :label="e.name + (e.is_default ? ' (默认)' : '')"
                :value="e.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="执行状态">
            <el-select v-model="statusFilter" placeholder="全部状态" clearable style="width: 100%">
              <el-option label="全部" value="" />
              <el-option
                v-for="opt in resultStatusOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>

    <p v-if="filteredTableRows.length" class="filter-hint">
      显示 {{ filteredTableRows.length }} / {{ tableRows.length }} 条
      <span v-if="selectedRows.length"> · 已选 {{ selectedRows.length }} 条</span>
    </p>

    <el-divider />
    <el-table
      ref="tableRef"
      :data="filteredTableRows"
      size="small"
      row-key="item_id"
      :max-height="400"
      @selection-change="selectedRows = $event"
    >
      <el-table-column type="selection" width="48" reserve-selection />
      <el-table-column prop="item_id" label="用例 ID" width="160" show-overflow-tooltip />
      <el-table-column prop="item_name" label="用例名称" min-width="220" show-overflow-tooltip />
      <el-table-column prop="scheme_primary_id" label="TS" width="120" />
      <el-table-column label="结果" width="100">
        <template #default="{ row }">
          <FitnessStatusTag prop="result_status" :row="row" />
        </template>
      </el-table-column>
      <el-table-column label="VS 判定" width="100">
        <template #default="{ row }">
          <FitnessStatusTag prop="validation_result" :row="row" />
        </template>
      </el-table-column>
      <el-table-column label="Run" width="80">
        <template #default="{ row }">
          <el-button v-if="row.ft_run_id" link @click="router.push(`/fitness/execution/runs/${row.ft_run_id}`)">
            #{{ row.ft_run_id }}
          </el-button>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button type="primary" link @click="router.push(`/fitness/assets/items/${row.item_id}`)">资产</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-card v-if="plan && scopeGoals.length" shadow="never" style="margin-top: 16px">
      <template #header>PRD 目标范围</template>
      <ul class="meta-list">
        <li v-for="s in scopeGoals" :key="s.id">{{ s.scope_value }}</li>
      </ul>
    </el-card>

    <el-card shadow="never" style="margin-top: 12px">
      <template #header>
        <div class="card-header">
          <span>阈值配置</span>
          <div class="card-actions">
            <el-button size="small" @click="openAddThreshold">添加</el-button>
            <el-button size="small" type="primary" :loading="savingThresholds" @click="saveThresholds">保存</el-button>
          </div>
        </div>
      </template>
      <el-empty v-if="!editableThresholds.length" description="暂无阈值，可按计划方向添加所需指标" />
      <el-table v-else :data="editableThresholds" size="small">
        <el-table-column prop="param_id" label="参数 ID" width="180" />
        <el-table-column label="参数名" width="140">
          <template #default="{ row }">{{ thresholdNameMap[row.param_id] || '-' }}</template>
        </el-table-column>
        <el-table-column label="配置值" min-width="160">
          <template #default="{ row }">
            <el-input-number
              v-if="thresholdUnitMap[row.param_id] !== 'text'"
              v-model="row.param_value"
              :min="0"
              :step="thresholdUnitMap[row.param_id] === 'percent' ? 1 : thresholdUnitMap[row.param_id] === 'ms' ? 100 : 1"
              size="small"
              style="width: 140px"
            />
            <el-input v-else v-model="row.notes" size="small" placeholder="文本说明" />
          </template>
        </el-table-column>
        <el-table-column label="实际值" width="100">
          <template #default="{ row }">
            <span v-if="thresholdActualMap[row.param_id] != null">
              {{ thresholdActualMap[row.param_id] }}{{ thresholdUnitMap[row.param_id] === 'percent' ? '%' : '' }}
            </span>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="达标" width="80">
          <template #default="{ row }">
            <el-tag v-if="thresholdMetMap[row.param_id] === true" type="success" size="small">是</el-tag>
            <el-tag v-else-if="thresholdMetMap[row.param_id] === false" type="danger" size="small">否</el-tag>
            <span v-else class="muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ $index }">
            <el-button link type="danger" @click="removeThreshold($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="plan" shadow="never" style="margin-top: 12px">
      <template #header>发版放行标准</template>
      <ul class="meta-list">
        <li v-for="(line, i) in planMeta.release_criteria" :key="i">{{ line }}</li>
      </ul>
    </el-card>

    <el-dialog v-model="addThresholdVisible" title="添加阈值" width="420px">
      <el-form label-width="100px">
        <el-form-item label="参数">
          <el-select v-model="newThresholdParamId" placeholder="选择指标" style="width: 100%">
            <el-option
              v-for="p in availableThresholdParams"
              :key="p.param_id"
              :label="`${p.name || p.param_id} (${p.param_id})`"
              :value="p.param_id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addThresholdVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!newThresholdParamId" @click="confirmAddThreshold">确定</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import FitnessStatusTag from '@/components/fitness/FitnessStatusTag.vue';
import { parsePlanMeta, THRESHOLD_DEFAULTS } from '@/constants/planReleaseCriteria.js';
import { STATUS_FILTER_OPTIONS } from '@/utils/fitnessStatusTags.js';
import {
  exportPlanReport,
  fetchEnums,
  fetchEnvironments,
  fetchPlan,
  fetchPlanReportStats,
  fetchPlanRuns,
  launchPlan,
  summarizePlanReport,
  updatePlan,
} from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const loading = ref(false);
const launching = ref(false);
const plan = ref(null);
const runSummary = ref(null);
const envs = ref([]);
const envId = ref(null);
const statusFilter = ref('');
const selectedRows = ref([]);
const tableRef = ref(null);
const reportStats = ref(null);
const reportPreview = ref('');
const exporting = ref(false);
const summarizing = ref(false);
const savingThresholds = ref(false);
const editableThresholds = ref([]);
const thresholdParams = ref([]);
const addThresholdVisible = ref(false);
const newThresholdParamId = ref('');
let pollTimer = null;

const resultStatusOptions = STATUS_FILTER_OPTIONS.result_status;

const planMeta = computed(() => parsePlanMeta(plan.value?.notes));

const scopeGoals = computed(() =>
  (plan.value?.scope || []).filter(s => s.scope_type === 'prd_goal'),
);

const thresholdNameMap = computed(() =>
  Object.fromEntries(thresholdParams.value.map(p => [ p.param_id, p.name ])),
);

const thresholdUnitMap = computed(() =>
  Object.fromEntries(thresholdParams.value.map(p => [ p.param_id, p.unit ])),
);

const thresholdActualMap = computed(() => {
  const map = {};
  for (const t of reportStats.value?.thresholds || []) {
    if (t.actual != null) map[t.param_id] = t.actual;
  }
  return map;
});

const thresholdMetMap = computed(() => {
  const map = {};
  for (const t of reportStats.value?.thresholds || []) {
    if (t.met != null) map[t.param_id] = t.met;
  }
  return map;
});

const dimensionRates = computed(() =>
  Object.entries(reportStats.value?.by_dimension || {}).map(([ dimension, row ]) => ({
    dimension,
    passRate: row.total ? Math.round(100 * row.passed / row.total) : 0,
  })),
);

const executedCount = computed(() => {
  const totals = reportStats.value?.totals;
  if (!totals) return 0;
  return (totals.passed || 0) + (totals.failed || 0);
});

const complianceRate = computed(() => {
  const totals = reportStats.value?.totals;
  if (!totals || !executedCount.value) return 0;
  return Math.round(100 * (totals.passed || 0) / executedCount.value);
});

const availableThresholdParams = computed(() => {
  const used = new Set(editableThresholds.value.map(t => t.param_id));
  return thresholdParams.value.filter(p => !used.has(p.param_id));
});

const tableRows = computed(() => {
  const items = plan.value?.items || [];
  const results = plan.value?.results || [];
  return items.map(item => {
    const result = results.find(r => r.plan_item_id === item.id);
    return {
      ...item,
      result_status: result?.result_status || 'pending',
      validation_result: result?.validation_result || '',
      ft_run_id: result?.ft_run_id || null,
    };
  });
});

const filteredTableRows = computed(() => {
  if (!statusFilter.value) return tableRows.value;
  return tableRows.value.filter(r => r.result_status === statusFilter.value);
});

const launchItemIds = computed(() => {
  if (selectedRows.value.length) {
    return selectedRows.value.map(r => r.item_id);
  }
  return filteredTableRows.value.map(r => r.item_id);
});

const launchLabelSuffix = computed(() => {
  const count = launchItemIds.value.length;
  if (!count) return '';
  if (selectedRows.value.length) return ` (${selectedRows.value.length} 条已选)`;
  if (statusFilter.value) return ` (${count} 条${statusFilter.value})`;
  return ` (${count} 条)`;
});

watch(statusFilter, () => {
  tableRef.value?.clearSelection?.();
  selectedRows.value = [];
});

async function loadReportStats() {
  try {
    reportStats.value = await fetchPlanReportStats(id);
  } catch {
    reportStats.value = null;
  }
}

function syncEditableThresholds() {
  editableThresholds.value = (plan.value?.thresholds || []).map(t => ({
    param_id: t.param_id,
    param_value: Number(t.param_value) || 0,
    notes: t.notes || '',
  }));
}

async function reload() {
  plan.value = await fetchPlan(id);
  runSummary.value = await fetchPlanRuns(id);
  syncEditableThresholds();
  await loadReportStats();
}

function openAddThreshold() {
  newThresholdParamId.value = '';
  addThresholdVisible.value = true;
}

function confirmAddThreshold() {
  const param = thresholdParams.value.find(p => p.param_id === newThresholdParamId.value);
  if (!param) return;
  const defaultVal = THRESHOLD_DEFAULTS[param.param_id];
  editableThresholds.value.push({
    param_id: param.param_id,
    param_value: param.unit === 'text' ? 0 : (defaultVal ?? 0),
    notes: param.unit === 'text' ? (param.placeholder || '') : '',
  });
  addThresholdVisible.value = false;
}

function removeThreshold(index) {
  editableThresholds.value.splice(index, 1);
}

function buildThresholdPayload() {
  return editableThresholds.value
    .filter(t => t.param_id)
    .map(t => {
      const unit = thresholdUnitMap.value[t.param_id];
      if (unit === 'text') {
        return { param_id: t.param_id, param_value: 0, notes: t.notes || '' };
      }
      return { param_id: t.param_id, param_value: t.param_value, notes: t.notes || '' };
    });
}

async function saveThresholds() {
  savingThresholds.value = true;
  try {
    plan.value = await updatePlan(id, { thresholds: buildThresholdPayload() });
    syncEditableThresholds();
    await loadReportStats();
    ElMessage.success('阈值已保存');
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '保存失败');
  } finally {
    savingThresholds.value = false;
  }
}

async function handleExportReport() {
  exporting.value = true;
  try {
    const data = await exportPlanReport(id);
    reportPreview.value = data.content || '';
    ElMessage.success('报告已生成');
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '导出失败');
  } finally {
    exporting.value = false;
  }
}

async function handleSummarize() {
  summarizing.value = true;
  try {
    const data = await summarizePlanReport(id);
    reportPreview.value = data.markdown || data.summary || '';
    ElMessage.success('AI 摘要已生成');
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '摘要失败');
  } finally {
    summarizing.value = false;
  }
}

async function handleLaunch() {
  const itemIds = launchItemIds.value;
  if (!itemIds.length) {
    ElMessage.warning('没有可执行的用例');
    return;
  }
  launching.value = true;
  try {
    await launchPlan(id, {
      env_id: envId.value,
      skip_unlaunchable: true,
      item_ids: itemIds,
    });
    ElMessage.success(`已启动 ${itemIds.length} 条用例的批量执行`);
    await reload();
    startPolling();
  } catch (e) {
    ElMessage.error(e.response?.data?.message || e.message || '启动失败');
  } finally {
    launching.value = false;
  }
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    await reload();
    if (plan.value?.status !== 'running') stopPolling();
  }, 3000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const [ envData, enumData ] = await Promise.all([
      fetchEnvironments({ pageSize: 50 }),
      fetchEnums('threshold_param_enum'),
    ]);
    envs.value = envData.list || [];
    thresholdParams.value = enumData.list || [];
    envId.value = envs.value.find(e => e.is_default)?.id ?? envs.value[0]?.id ?? null;
    await reload();
    if (plan.value?.status === 'running') startPolling();
  } finally {
    loading.value = false;
  }
});

onUnmounted(stopPolling);
</script>

<style scoped>
.meta-list {
  margin: 0;
  padding-left: 20px;
  line-height: 1.8;
}
.filter-hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-actions {
  display: flex;
  gap: 8px;
}
.stat-block {
  text-align: center;
}
.stat-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.stat-value {
  font-size: 28px;
  font-weight: 600;
  margin: 4px 0;
}
.stat-sub {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.dim-rates {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dim-rate-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px;
  align-items: center;
  font-size: 13px;
}
.muted {
  color: var(--el-text-color-placeholder);
}
</style>
