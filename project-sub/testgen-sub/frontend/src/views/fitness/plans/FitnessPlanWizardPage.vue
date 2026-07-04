<template>
  <PageShell title="测试计划向导">
    <el-steps :active="step" finish-status="success" align-center style="margin-bottom:24px">
      <el-step title="基本信息" />
      <el-step title="目标范围" />
      <el-step title="用例选择" />
      <el-step title="阈值" />
      <el-step title="预览" />
      <el-step title="发版标准" />
    </el-steps>

    <!-- Step 0: 基本信息 -->
    <div v-show="step === 0">
      <el-form label-width="100px">
        <el-form-item label="计划名称">
          <el-input
            v-model="form.name"
            placeholder="如：v2.3.0 发版回归计划，用于标识本次测试轮次"
          />
        </el-form-item>
        <el-form-item label="版本">
          <el-input
            v-model="form.version_tag"
            placeholder="如：v2.3.0 或 release-20250704，对应发版版本号"
          />
        </el-form-item>
        <el-form-item label="环境">
          <el-input
            v-model="form.env_name"
            placeholder="如：staging / pre-prod，描述计划默认执行环境"
          />
        </el-form-item>
      </el-form>
    </div>

    <!-- Step 1: 目标范围 -->
    <div v-show="step === 1">
      <el-alert
        type="info"
        :closable="false"
        title="目标范围说明"
        description="选择本计划需覆盖的 PRD 业务目标，用于关联验收范围与发版就绪评估。此步可选——若暂无 PRD 目标数据，可跳过并在下一步手动选用例。"
        style="margin-bottom: 16px"
      />
      <el-empty
        v-if="!prdGoals.length"
        description="暂无 PRD 目标数据。请先在「业务专题」或「PRD 指标」页配置 PRD 目标与用例关联。"
      />
      <el-checkbox-group v-else v-model="selectedGoals">
        <div v-for="g in prdGoals" :key="g.prd_goal_id" class="goal-row">
          <el-checkbox :label="g.prd_goal_id">
            <span class="goal-id">{{ g.prd_goal_id }}</span>
            <span class="goal-name">{{ g.goal_name }}</span>
            <el-tag size="small" :type="coverageTagType(g.coverage_note)" style="margin-left: 8px">
              {{ g.coverage_note || '-' }}
            </el-tag>
            <span class="goal-meta">关联 {{ g.linked_item_count ?? 0 }} 条 · P0 {{ g.linked_p0_count ?? 0 }} 条</span>
          </el-checkbox>
        </div>
      </el-checkbox-group>
      <p v-if="selectedGoals.length" class="step-hint">已选 {{ selectedGoals.length }} 个 PRD 目标</p>
    </div>

    <!-- Step 2: 用例选择 -->
    <div v-show="step === 2">
      <ItemFilterBar v-model="itemFilters" @change="onFilterChange" />
      <p class="step-hint">
        已选用例 {{ selectedItemIds.length }} 条
        <span v-if="itemTotal"> · 当前筛选共 {{ itemTotal }} 条</span>
      </p>
      <FitnessLabeledTable
        ref="itemTableRef"
        :data="candidateItems"
        :columns="wizardItemColumns"
        :page="itemPage"
        :page-size="itemPageSize"
        :total="itemTotal"
        :loading="itemsLoading"
        :table-props="{ rowKey: 'item_id' }"
        @update:page="onItemPageChange"
        @update:page-size="onItemPageSizeChange"
        @selection-change="onSelect"
      >
        <template #prefix>
          <el-table-column type="selection" width="48" reserve-selection />
        </template>
      </FitnessLabeledTable>
    </div>

    <!-- Step 3: 阈值 -->
    <div v-show="step === 3">
      <el-alert
        type="info"
        :closable="false"
        title="阈值配置说明"
        description="设置本计划的验收阈值，用于发版放行判定与完成报告对比。已预填常用默认值，可按需调整；留空的参数不会写入计划。"
        style="margin-bottom: 16px"
      />
      <el-empty v-if="!thresholdParams.length" description="暂无阈值参数定义，请检查 threshold_param_enum 枚举表" />
      <el-form v-else label-width="140px">
        <el-form-item v-for="p in thresholdParams" :key="p.param_id" :label="p.name || p.param_id">
          <div class="threshold-row">
            <el-input-number
              v-if="p.unit !== 'text'"
              v-model="thresholdValues[p.param_id]"
              :step="p.unit === 'percent' ? 1 : p.unit === 'count' ? 1 : 100"
              :min="0"
              :placeholder="p.placeholder"
            />
            <el-input
              v-else
              v-model="thresholdTextValues[p.param_id]"
              :placeholder="p.placeholder || p.name"
              style="width: 240px"
            />
            <span v-if="p.unit === 'percent'" class="threshold-unit">%</span>
            <span v-else-if="p.unit === 'ms'" class="threshold-unit">ms</span>
            <span class="threshold-hint">{{ p.placeholder }}</span>
          </div>
        </el-form-item>
      </el-form>
    </div>

    <!-- Step 4: 预览 -->
    <div v-show="step === 4">
      <el-descriptions :column="2" border style="margin-bottom: 16px">
        <el-descriptions-item label="计划名称">{{ form.name || '（未填写）' }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ form.version_tag || '-' }}</el-descriptions-item>
        <el-descriptions-item label="环境">{{ form.env_name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="用例数">{{ selectedItemIds.length }} 条</el-descriptions-item>
      </el-descriptions>

      <el-card v-if="selectedGoals.length" shadow="never" style="margin-bottom: 12px">
        <template #header>PRD 目标范围（{{ selectedGoals.length }} 个）</template>
        <ul class="preview-list">
          <li v-for="g in selectedGoalDetails" :key="g.prd_goal_id">
            {{ g.prd_goal_id }} · {{ g.goal_name }}
            <el-tag size="small" :type="coverageTagType(g.coverage_note)">{{ g.coverage_note }}</el-tag>
          </li>
        </ul>
      </el-card>

      <el-card v-if="configuredThresholds.length" shadow="never" style="margin-bottom: 12px">
        <template #header>阈值配置（{{ configuredThresholds.length }} 项）</template>
        <el-table :data="configuredThresholds" size="small">
          <el-table-column prop="name" label="参数" width="160" />
          <el-table-column prop="param_id" label="ID" width="140" />
          <el-table-column prop="param_value" label="值" />
        </el-table>
      </el-card>

      <el-card shadow="never" style="margin-bottom: 12px">
        <template #header>用例清单（前 20 条）</template>
        <el-empty v-if="!selectedItemIds.length" description="未选用例，请返回上一步选择" :image-size="48" />
        <el-table v-else :data="previewItems" size="small">
          <el-table-column prop="item_id" label="用例编码" width="180" />
          <el-table-column prop="detail_summary" label="名称" min-width="200" />
          <el-table-column prop="priority_name" label="优先级" width="88" />
          <el-table-column prop="scheme_primary_name" label="主方案" width="110" />
        </el-table>
        <p v-if="selectedItemIds.length > 20" class="step-hint">… 另有 {{ selectedItemIds.length - 20 }} 条未展示</p>
      </el-card>

      <el-card shadow="never" style="margin-bottom: 16px">
        <template #header>发版放行标准</template>
        <ul class="release-criteria">
          <li v-for="(line, i) in releaseCriteria" :key="i">{{ line }}</li>
        </ul>
      </el-card>

      <el-button :loading="exporting" @click="exportDraft">导出计划 Markdown</el-button>
      <el-button :loading="exportingHtml" @click="exportDraftHtml">导出 HTML（可打印 PDF）</el-button>
    </div>

    <!-- Step 5: 发版标准 -->
    <div v-show="step === 5">
      <el-alert type="info" :closable="false" title="发版放行标准说明" />
      <ul class="release-criteria">
        <li v-for="(line, i) in releaseCriteria" :key="i">{{ line }}</li>
      </ul>
      <p v-if="readinessSignal" class="readiness-hint">
        当前发版信号：<el-tag :type="readinessTag">{{ readinessSignal }}</el-tag>
      </p>
      <el-button type="primary" :loading="saving" :disabled="!form.name" @click="submit">创建计划</el-button>
      <el-button :loading="exporting" @click="exportDraft">导出计划 Markdown</el-button>
      <el-button :loading="exportingHtml" @click="exportDraftHtml">导出 HTML（可打印 PDF）</el-button>
    </div>

    <div style="margin-top:24px">
      <el-button v-if="step > 0" @click="step -= 1">上一步</el-button>
      <el-button v-if="step < 5" type="primary" @click="nextStep">下一步</el-button>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import ItemFilterBar from '@/components/fitness/ItemFilterBar.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import {
  RELEASE_CRITERIA,
  THRESHOLD_DEFAULTS,
  serializePlanMeta,
} from '@/constants/planReleaseCriteria.js';
import {
  createPlan,
  downloadPlanHtml,
  downloadPlanMarkdown,
  fetchEnums,
  fetchTestItems,
  fetchView,
} from '@/services/fitnessService.js';

const router = useRouter();
const step = ref(0);
const saving = ref(false);
const exporting = ref(false);
const exportingHtml = ref(false);
const form = reactive({ name: '', version_tag: '', env_name: '', plan_type: 'release' });
const selectedGoals = ref([]);
const selectedItemIds = ref([]);
const selectedItemRows = ref([]);
const prdGoals = ref([]);
const thresholdParams = ref([]);
const thresholdValues = reactive({});
const thresholdTextValues = reactive({});
const itemFilters = reactive({});
const candidateItems = ref([]);
const itemPage = ref(1);
const itemPageSize = ref(20);
const itemTotal = ref(0);
const itemsLoading = ref(false);
const itemTableRef = ref(null);
const readinessSignal = ref('');
const releaseCriteria = RELEASE_CRITERIA;

const wizardItemColumns = [
  { prop: 'item_id', label: '用例编码', width: 180 },
  { prop: 'detail_summary', label: '测试用例名称', minWidth: 200 },
  { prop: 'dimension_name', label: '维度', width: 120 },
  { prop: 'priority_name', label: '优先级', width: 88 },
  { prop: 'scheme_primary_name', label: '主方案', width: 110 },
  { prop: 'validation_primary_name', label: '主验证', width: 110 },
  { prop: 'automation_status_name', label: '自动化', width: 96 },
];

const readinessTag = computed(() => {
  const s = (readinessSignal.value || '').toUpperCase();
  if (s === 'GREEN') return 'success';
  if (s === 'YELLOW') return 'warning';
  if (s === 'RED') return 'danger';
  return 'info';
});

const selectedGoalDetails = computed(() =>
  prdGoals.value.filter(g => selectedGoals.value.includes(g.prd_goal_id)),
);

const configuredThresholds = computed(() =>
  thresholdParams.value
    .map(p => {
      if (p.unit === 'text') {
        const val = thresholdTextValues[p.param_id];
        if (!val) return null;
        return { param_id: p.param_id, name: p.name || p.param_id, param_value: val };
      }
      const val = thresholdValues[p.param_id];
      if (val === undefined || val === null || val === '') return null;
      const suffix = p.unit === 'percent' ? '%' : p.unit === 'ms' ? ' ms' : '';
      return { param_id: p.param_id, name: p.name || p.param_id, param_value: `${val}${suffix}` };
    })
    .filter(Boolean),
);

const previewItems = computed(() => selectedItemRows.value.slice(0, 20));

function coverageTagType(note) {
  if (note === 'OK') return 'success';
  if (note === 'LOW') return 'warning';
  if (note === 'GAP') return 'danger';
  return 'info';
}

function onSelect(rows) {
  selectedItemRows.value = rows;
  selectedItemIds.value = rows.map(r => r.item_id);
}

async function searchItems() {
  itemsLoading.value = true;
  try {
    const data = await fetchTestItems({
      ...itemFilters,
      page: itemPage.value,
      pageSize: itemPageSize.value,
    });
    candidateItems.value = data.list || [];
    itemTotal.value = data.total || 0;
  } finally {
    itemsLoading.value = false;
  }
}

function onFilterChange() {
  itemPage.value = 1;
  searchItems();
}

function onItemPageChange(p) {
  itemPage.value = p;
  searchItems();
}

function onItemPageSizeChange(size) {
  itemPageSize.value = size;
  itemPage.value = 1;
  searchItems();
}

async function nextStep() {
  if (step.value === 0 && !form.name.trim()) {
    ElMessage.warning('请填写计划名称');
    return;
  }
  if (step.value === 1) {
    itemPage.value = 1;
    await searchItems();
  }
  step.value += 1;
}

function buildThresholdPayload() {
  return thresholdParams.value
    .map(p => {
      if (p.unit === 'text') {
        const val = thresholdTextValues[p.param_id];
        if (!val) return null;
        return { param_id: p.param_id, param_value: 0, notes: val };
      }
      const val = thresholdValues[p.param_id];
      if (val === undefined || val === null || val === '') return null;
      return { param_id: p.param_id, param_value: val };
    })
    .filter(Boolean);
}

function buildDraftPayload() {
  return {
    ...form,
    notes: serializePlanMeta({ release_criteria: releaseCriteria }),
    scope: selectedGoals.value.map(g => ({ scope_type: 'prd_goal', scope_value: g })),
    thresholds: buildThresholdPayload(),
    item_ids: selectedItemIds.value,
  };
}

function buildExportMarkdown() {
  const lines = [
    `# 测试计划 — ${form.name}`,
    '',
    `- 版本: ${form.version_tag || '-'}`,
    `- 环境: ${form.env_name || '-'}`,
    `- 用例数: ${selectedItemIds.value.length}`,
    '',
    '## PRD 目标范围',
    '',
    ...(selectedGoalDetails.value.length
      ? selectedGoalDetails.value.map(g => `- ${g.prd_goal_id} · ${g.goal_name}`)
      : [ '- （未指定）' ]),
    '',
    '## 阈值配置',
    '',
    ...(configuredThresholds.value.length
      ? configuredThresholds.value.map(t => `- ${t.name}: ${t.param_value}`)
      : [ '- （未配置）' ]),
    '',
    '## 发版放行标准',
    '',
    ...releaseCriteria.map(line => `- ${line}`),
    '',
    '## 用例清单',
    '',
    ...selectedItemIds.value.map(id => `- ${id}`),
  ];
  return lines.join('\n');
}

async function exportDraft() {
  if (!form.name) {
    ElMessage.warning('请先填写计划名称');
    return;
  }
  exporting.value = true;
  try {
    downloadPlanMarkdown(form.name, buildExportMarkdown());
    ElMessage.success('计划 Markdown 已下载');
  } finally {
    exporting.value = false;
  }
}

async function exportDraftHtml() {
  if (!form.name) {
    ElMessage.warning('请先填写计划名称');
    return;
  }
  exportingHtml.value = true;
  try {
    const md = buildExportMarkdown();
    const body = md.split('\n').map(line => {
      if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith('- ')) return `<li>${line.slice(2)}</li>`;
      if (!line.trim()) return '';
      return `<p>${line}</p>`;
    }).join('\n');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${form.name}</title></head><body>${body}</body></html>`;
    downloadPlanHtml(form.name, html);
    ElMessage.success('HTML 已下载，可在浏览器中打印为 PDF');
  } finally {
    exportingHtml.value = false;
  }
}

async function submit() {
  if (!form.name.trim()) {
    ElMessage.warning('请填写计划名称');
    return;
  }
  if (!selectedItemIds.value.length) {
    ElMessage.warning('请至少选择一条用例');
    return;
  }
  saving.value = true;
  try {
    const plan = await createPlan(buildDraftPayload());
    ElMessage.success('计划已创建');
    router.push(`/fitness/plans/${plan.id}`);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  const goalData = await fetchView('v_metric_prd_goal_coverage', { pageSize: 100 });
  prdGoals.value = goalData.list || [];

  const enumData = await fetchEnums('threshold_param_enum');
  thresholdParams.value = enumData.list || [];
  for (const p of thresholdParams.value) {
    if (p.unit === 'text') {
      if (p.placeholder) thresholdTextValues[p.param_id] = p.placeholder;
    } else if (THRESHOLD_DEFAULTS[p.param_id] !== undefined) {
      thresholdValues[p.param_id] = THRESHOLD_DEFAULTS[p.param_id];
    }
  }

  const readiness = await fetchView('v_analysis_release_readiness', { page: 1, pageSize: 1 });
  readinessSignal.value = readiness.list?.[0]?.release_signal || readiness.list?.[0]?.signal || '';
});
</script>

<style scoped>
.release-criteria {
  margin: 12px 0 16px;
  padding-left: 20px;
  line-height: 1.8;
}
.readiness-hint {
  margin-bottom: 12px;
}
.step-hint {
  margin: 8px 0 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.goal-row {
  margin-bottom: 10px;
}
.goal-id {
  font-weight: 600;
  margin-right: 6px;
}
.goal-name {
  color: var(--el-text-color-regular);
}
.goal-meta {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.preview-list {
  margin: 0;
  padding-left: 20px;
  line-height: 2;
}
.threshold-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.threshold-unit {
  color: var(--el-text-color-secondary);
}
.threshold-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
