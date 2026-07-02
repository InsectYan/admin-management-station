<template>
  <PageShell title="测试完成报告" v-loading="loading">
    <template #extra>
      <el-button :loading="summarizing" @click="handleSummarize">AI 摘要</el-button>
      <el-button type="primary" :loading="exporting" @click="handleExport">导出 Markdown</el-button>
    </template>

    <el-row v-if="dimensionRates.length" :gutter="16" style="margin-bottom:16px">
      <el-col v-for="d in dimensionRates" :key="d.dimension" :span="8">
        <el-card shadow="never">
          <template #header>{{ d.dimension }}</template>
          <el-progress :percentage="d.passRate" :status="d.passRate >= 80 ? 'success' : undefined" />
          <p class="dim-caption">{{ d.passed }}/{{ d.total }} 通过</p>
        </el-card>
      </el-col>
    </el-row>

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
        <el-table-column prop="param_id" label="参数" width="160" />
        <el-table-column prop="configured" label="计划配置" />
        <el-table-column prop="notes" label="说明" />
      </el-table>
    </el-card>

    <el-table :data="resultRows" size="small">
      <el-table-column prop="item_id" label="用例" width="140" />
      <el-table-column label="结果" width="140">
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
      <el-table-column label="备注">
        <template #default="{ row }">
          <el-input v-model="row.notes" size="small" />
        </template>
      </el-table-column>
    </el-table>
    <el-button type="primary" style="margin-top:16px" :loading="saving" @click="save">保存结果</el-button>
    <el-input v-if="reportContent" v-model="reportContent" type="textarea" :rows="12" style="margin-top:16px" readonly />
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import {
  exportPlanReport,
  fetchPlan,
  fetchPlanReportStats,
  fetchTestItem,
  savePlanResults,
  summarizePlanReport,
} from '@/services/fitnessService.js';

const route = useRoute();
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

function mapAggRates(agg) {
  return Object.entries(agg || {}).map(([ label, row ]) => ({
    label,
    rate: row.total ? Math.round(100 * row.passed / row.total) : 0,
    ...row,
  }));
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
  thresholdRows.value = stats.thresholds || [];
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
  const plan = await fetchPlan(id);
  resultRows.value = (plan.items || []).map(item => {
    const existing = (plan.results || []).find(r => r.plan_item_id === item.id);
    return {
      plan_item_id: item.id,
      item_id: item.item_id,
      result_status: existing?.result_status || 'pending',
      validation_result: existing?.validation_result || '',
      notes: existing?.notes || '',
    };
  });
  await buildDimensionRates(plan);
  loading.value = false;
});

async function save() {
  saving.value = true;
  try {
    await savePlanResults(id, resultRows.value);
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
    const data = await exportPlanReport(id);
    reportContent.value = data.content;
    ElMessage.success('报告已生成');
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
.dim-caption {
  text-align: center;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-top: 8px;
}
.rate-row {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}
</style>
