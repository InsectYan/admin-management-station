<template>
  <PageShell title="测试完成报告" v-loading="loading">
    <template #extra>
      <el-button @click="router.push(`/fitness/plans/${id}`)">返回计划详情</el-button>
      <el-button :loading="summarizing" @click="handleSummarize">AI 摘要</el-button>
      <el-button :loading="saving" @click="save">保存结果</el-button>
      <el-button type="primary" :loading="exporting" @click="handleExport">导出 Markdown</el-button>
    </template>

    <div v-if="dimensionRates.length" class="dimension-stack" style="margin-bottom:16px">
      <el-card v-for="d in dimensionRates" :key="d.dimension" shadow="never" class="dimension-card">
        <template #header>{{ d.dimension }}</template>
        <el-progress :percentage="d.passRate" :status="d.passRate >= 80 ? 'success' : undefined" />
        <p class="dim-caption">{{ d.passed }}/{{ d.total }} 通过</p>
      </el-card>
    </div>

    <el-row v-if="schemeRates.length || validationRates.length" :gutter="16" style="margin-bottom:16px">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>TS 方案通过率</template>
          <div v-for="s in schemeRates" :key="s.label" class="rate-row">
            <span>{{ s.label }}</span>
            <el-progress :percentage="s.rate" :stroke-width="14" />
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>VS 验证通过率</template>
          <div v-for="v in validationRates" :key="v.label" class="rate-row">
            <span>{{ v.label }}</span>
            <el-progress :percentage="v.rate" :stroke-width="14" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card v-if="thresholdRows.length" shadow="never" style="margin-bottom:16px">
      <template #header>阈值对比</template>
      <el-table :data="thresholdRows" size="small">
        <el-table-column label="参数" min-width="200">
          <template #default="{ row }">
            <div>{{ resolveThresholdName(row) }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="configured" label="计划配置" width="120" />
        <el-table-column label="实际值" width="100">
          <template #default="{ row }">
            <span v-if="row.actual != null">{{ row.actual }}{{ thresholdUnitSuffix(row) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="达标" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.met === true" type="success" size="small">是</el-tag>
            <el-tag v-else-if="row.met === false" type="danger" size="small">否</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="notes" label="说明" />
      </el-table>
    </el-card>

    <div class="result-filter-bar">
      <span class="result-filter-label">结果筛选</span>
      <el-checkbox-group v-model="statusFilter">
        <el-checkbox
          v-for="opt in statusFilterOptions"
          :key="opt.value"
          :label="opt.value"
        >
          {{ opt.label }}（{{ statusCounts[opt.value] || 0 }}）
        </el-checkbox>
      </el-checkbox-group>
      <el-button link type="primary" @click="statusFilter = []">全部</el-button>
      <span class="result-filter-hint">当前 {{ filteredResultRows.length }}/{{ resultRows.length }} 条；导出按当前筛选</span>
    </div>

    <el-table :data="filteredResultRows" size="small" class="exec-table" max-height="500">
      <el-table-column label="测试用例名称" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <div
            class="item-name-link"
            @click="router.push(`/fitness/assets/items/${encodeURIComponent(row.item_id)}`)"
          >
            {{ row.item_name || row.item_id }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="Path" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <code v-if="row.api_path" class="path-cell">{{ row.api_path }}</code>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="期望" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.expected_observation || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="入参" min-width="160">
        <template #default="{ row }">
          <el-tooltip v-if="row.input_json" placement="top" :show-after="400">
            <template #content>
              <pre class="json-tip">{{ row.input_json }}</pre>
            </template>
            <code class="json-cell">{{ truncateText(row.input_json, 80) }}</code>
          </el-tooltip>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="失败原因" min-width="160">
        <template #default="{ row }">
          <el-tooltip v-if="row.fail_reason" placement="top" :show-after="400">
            <template #content>
              <pre class="json-tip">{{ row.fail_reason }}</pre>
            </template>
            <span class="fail-cell">{{ truncateText(row.fail_reason, 80) }}</span>
          </el-tooltip>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="结果" width="130">
        <template #default="{ row }">
          <el-select v-model="row.result_status" size="small">
            <el-option label="通过" value="passed" />
            <el-option label="失败" value="failed" />
            <el-option label="跳过" value="skipped" />
            <el-option label="待执行" value="pending" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="VS 判定" width="140">
        <template #default="{ row }">
          <el-input v-model="row.validation_result" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="备注" width="140">
        <template #default="{ row }">
          <el-input v-model="row.notes" size="small" />
        </template>
      </el-table-column>
    </el-table>
    <el-input v-if="reportContent" v-model="reportContent" type="textarea" :rows="12" style="margin-top:16px" readonly />
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import {
  downloadPlanMarkdown,
  exportPlanReport,
  fetchEnums,
  fetchPlan,
  fetchPlanReportStats,
  fetchTestItem,
  savePlanResults,
  summarizePlanReport,
} from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const loading = ref(false);
const saving = ref(false);
const exporting = ref(false);
const summarizing = ref(false);
const resultRows = ref([]);
const reportContent = ref('');
const dimensionRates = ref([]);
const schemeRates = ref([]);
const validationRates = ref([]);
const thresholdRows = ref([]);
const thresholdNameMap = ref({});
const thresholdUnitMap = ref({});
const planName = ref('');
/** 空数组 = 全部；有值则只显示/导出勾选状态 */
const statusFilter = ref([]);

const statusFilterOptions = [
  { label: '通过', value: 'passed' },
  { label: '失败', value: 'failed' },
  { label: '跳过', value: 'skipped' },
  { label: '待执行', value: 'pending' },
];

const statusCounts = computed(() => {
  const counts = { passed: 0, failed: 0, skipped: 0, pending: 0 };
  for (const row of resultRows.value) {
    const key = row.result_status || 'pending';
    if (counts[key] != null) counts[key] += 1;
    else counts.pending += 1;
  }
  return counts;
});

const filteredResultRows = computed(() => {
  const selected = statusFilter.value || [];
  if (!selected.length) return resultRows.value;
  const allow = new Set(selected);
  return resultRows.value.filter(r => allow.has(r.result_status || 'pending'));
});

function truncateText(text, max) {
  const s = String(text || '');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function resolveThresholdName(row) {
  if (row.param_name && row.param_name !== row.param_id) return row.param_name;
  return thresholdNameMap.value[row.param_id] || row.param_name || row.param_id;
}

function thresholdUnitSuffix(row) {
  const unit = row.unit || thresholdUnitMap.value[row.param_id];
  if (unit === 'percent'
    || String(row.param_id || '').startsWith('rate_')
    || String(row.param_id || '').startsWith('block_')
    || String(row.param_id || '').startsWith('error_rate_')) {
    return '%';
  }
  if (unit === 'ms') return 'ms';
  return '';
}

function mapAggRates(agg) {
  return Object.entries(agg || {}).map(([ label, row ]) => ({
    label,
    rate: row.total ? Math.round(100 * row.passed / row.total) : 0,
    ...row,
  }));
}

function mergeExecutionRows(stats) {
  const execByPlanItem = Object.fromEntries(
    (stats.execution_rows || []).map(r => [ String(r.plan_item_id), r ]),
  );
  if (!Object.keys(execByPlanItem).length) return;
  resultRows.value = resultRows.value.map(row => {
    const exec = execByPlanItem[String(row.plan_item_id)];
    if (!exec) return row;
    return {
      ...row,
      item_name: exec.item_name || row.item_name,
      expected_observation: exec.expected_observation || row.expected_observation || '',
      input_json: exec.input_json || row.input_json || '',
      api_path: exec.api_path || row.api_path || '',
      fail_reason: exec.fail_reason || row.fail_reason || '',
    };
  });
}

async function loadThresholdEnums() {
  try {
    const enumData = await fetchEnums('threshold_param_enum');
    const list = enumData.list || enumData || [];
    thresholdNameMap.value = Object.fromEntries(list.map(p => [ p.param_id, p.name || p.param_id ]));
    thresholdUnitMap.value = Object.fromEntries(list.map(p => [ p.param_id, p.unit ]));
  } catch {
    // ignore
  }
}

async function loadStats() {
  const stats = await fetchPlanReportStats(id);
  dimensionRates.value = Object.entries(stats.by_dimension || {}).map(([ dimension, row ]) => ({
    dimension,
    total: row.total,
    passed: row.passed,
    passRate: row.total ? Math.round(100 * row.passed / row.total) : 0,
  }));
  schemeRates.value = mapAggRates(stats.by_scheme);
  validationRates.value = mapAggRates(stats.by_validation);
  thresholdRows.value = (stats.thresholds || []).map(t => ({
    ...t,
    param_name: (t.param_name && t.param_name !== t.param_id)
      ? t.param_name
      : (thresholdNameMap.value[t.param_id] || t.param_name || t.param_id),
    unit: t.unit || thresholdUnitMap.value[t.param_id] || null,
  }));
  mergeExecutionRows(stats);
  return stats;
}

async function enrichMissingItemFields() {
  const missing = resultRows.value.filter(r => !r.expected_observation || !r.item_name || r.item_name === r.item_id || !r.api_path);
  if (!missing.length) return;
  await Promise.all(missing.slice(0, 40).map(async row => {
    try {
      const item = await fetchTestItem(row.item_id);
      row.item_name = item.item_name || row.item_name;
      if (!row.expected_observation && item.expected_observation) {
        row.expected_observation = item.expected_observation;
      }
      if (!row.input_json && item.test_input_example) {
        row.input_json = typeof item.test_input_example === 'string'
          ? item.test_input_example
          : JSON.stringify(item.test_input_example);
      }
      if (!row.api_path && item.endpoint_path) {
        const method = (item.http_method || 'GET').toUpperCase();
        let path = String(item.endpoint_path).trim();
        try {
          if (/^https?:\/\//i.test(path)) {
            const u = new URL(path);
            path = u.pathname + (u.search || '');
          }
        } catch { /* keep */ }
        if (!path.startsWith('/')) path = `/${path}`;
        row.api_path = `${method} ${path}`;
      }
    } catch {
      // ignore
    }
  }));
}

async function buildDimensionRates(plan) {
  await loadStats();
  if (dimensionRates.value.length) return;
  const rows = resultRows.value;
  const dimMap = {};
  for (const row of rows) {
    let dim = row._dimension;
    if (!dim) {
      try {
        const item = await fetchTestItem(row.item_id);
        dim = item.dimension_name || item.dimension_id || '未知';
        row._dimension = dim;
      } catch {
        dim = '未知';
      }
    }
    if (!dimMap[dim]) dimMap[dim] = { dimension: dim, total: 0, passed: 0 };
    dimMap[dim].total += 1;
    if (row.result_status === 'passed') dimMap[dim].passed += 1;
  }
  dimensionRates.value = Object.values(dimMap).map(d => ({
    ...d,
    passRate: d.total ? Math.round(100 * d.passed / d.total) : 0,
  }));
}

onMounted(async () => {
  loading.value = true;
  try {
    await loadThresholdEnums();
    const plan = await fetchPlan(id);
    planName.value = plan.name || `plan-${id}`;
    resultRows.value = (plan.items || []).map(item => {
      const existing = (plan.results || []).find(r => Number(r.plan_item_id) === Number(item.id));
      return {
        plan_item_id: item.id,
        item_id: item.item_id,
        item_name: item.item_name || item.item_id,
        expected_observation: item.expected_observation || '',
        input_json: item.test_input_example
          ? (typeof item.test_input_example === 'string'
            ? item.test_input_example
            : JSON.stringify(item.test_input_example))
          : '',
        api_path: '',
        fail_reason: '',
        result_status: existing?.result_status || 'pending',
        validation_result: existing?.validation_result || '',
        notes: existing?.notes || '',
      };
    });
    await buildDimensionRates(plan);
    await enrichMissingItemFields();
  } finally {
    loading.value = false;
  }
});

async function save() {
  saving.value = true;
  try {
    await savePlanResults(id, resultRows.value.map(row => ({
      plan_item_id: row.plan_item_id,
      result_status: row.result_status,
      validation_result: row.validation_result,
      notes: row.notes,
    })));
    ElMessage.success('已保存');
    const plan = await fetchPlan(id);
    await buildDimensionRates(plan);
  } finally {
    saving.value = false;
  }
}

async function handleExport() {
  exporting.value = true;
  try {
    const selected = statusFilter.value || [];
    const payload = selected.length ? { result_statuses: selected } : {};
    const data = await exportPlanReport(id, payload);
    reportContent.value = data.content;
    const suffix = selected.length
      ? `_${selected.map(s => ({ passed: '通过', failed: '失败', skipped: '跳过', pending: '待执行' }[s] || s)).join('_')}`
      : '';
    downloadPlanMarkdown(
      `${planName.value || data.plan?.name || `plan-${id}`}${suffix}`,
      data.content || '',
    );
    ElMessage.success(selected.length ? '已按筛选结果导出' : '报告已生成并下载');
  } finally {
    exporting.value = false;
  }
}

async function handleSummarize() {
  summarizing.value = true;
  try {
    const data = await summarizePlanReport(id);
    reportContent.value = data.summary || data.markdown || data.content || JSON.stringify(data, null, 2);
    ElMessage.success('AI 摘要已生成');
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '摘要失败');
  } finally {
    summarizing.value = false;
  }
}
</script>

<style scoped>
.dimension-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dimension-card {
  width: 100%;
}
.dim-caption {
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}
.rate-row {
  display: grid;
  grid-template-columns: minmax(80px, 140px) 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}
.result-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
.result-filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.result-filter-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.json-cell,
.fail-cell,
.path-cell {
  font-size: 12px;
  word-break: break-all;
}
.json-cell,
.fail-cell {
  cursor: help;
}
.json-tip {
  margin: 0;
  max-width: 480px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
}
.exec-table :deep(.el-table__cell) {
  vertical-align: top;
}
.item-name-link {
  color: var(--el-color-primary);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item-name-link:hover {
  text-decoration: underline;
}
</style>
