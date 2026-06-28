<template>
  <PageShell title="测试项库" table-layout>
    <ItemFilterBar
      :model-value="filters"
      @update:model-value="applyFilters"
      @change="onFilterChange"
      @clear="onFilterClear"
    />
    <div class="items-toolbar">
      <el-button :disabled="!selectedRows.length" @click="openAddToPlan">加入计划 ({{ selectedRows.length || 0 }})</el-button>
      <el-button :disabled="!selectedRows.length" @click="copyCommands">复制自动化命令</el-button>
      <el-button :loading="exporting" @click="exportJson">导出 JSON</el-button>
      <el-button :loading="exporting" @click="exportCsv">导出 CSV</el-button>
    </div>
    <FitnessLabeledTable
      :data="list"
      :columns="itemColumns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      :table-props="{ rowKey: 'item_id' }"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="loadData"
      @selection-change="selectedRows = $event"
    >
      <template #prefix>
        <el-table-column type="selection" width="48" reserve-selection />
      </template>
      <template #col-execution_status="{ row }">
        <el-tag :type="executionStatusTagType(row.execution_status)" size="small">
          {{ row.execution_status_name || '未执行' }}
        </el-tag>
      </template>
      <template #col-dimension_name="{ row }">
        <el-tag v-bind="dimensionTagProps(row)" size="small">
          {{ itemTagLabel(row, 'dimension') }}
        </el-tag>
      </template>
      <template #col-category_major_name="{ row }">
        <el-tag v-bind="categoryMajorTagProps(row)" size="small">
          {{ itemTagLabel(row, 'major') }}
        </el-tag>
      </template>
      <template #col-priority_name="{ row }">
        <el-tag v-bind="priorityTagProps(row)" size="small">
          {{ itemTagLabel(row, 'priority') }}
        </el-tag>
      </template>
      <template #col-exec_env_name="{ row }">
        <el-tag v-bind="execEnvTagProps(row)" size="small">
          {{ itemTagLabel(row, 'exec_env') }}
        </el-tag>
      </template>
      <template #col-env_tier_name="{ row }">
        <el-tag v-bind="envTierTagProps(row)" size="small">
          {{ itemTagLabel(row, 'env_tier') }}
        </el-tag>
      </template>
      <template #col-current_pass_rate="{ row }">
        {{ formatPassRate(row.current_pass_rate) }}
      </template>
      <template #col-target_pass_rate="{ row }">
        {{ formatPassRate(row.target_pass_rate) }}
      </template>
      <template #suffix>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="goDetail(row)">查看详情</el-button>
            <el-button link type="warning" size="small" @click="copyOneCommand(row)">复制命令</el-button>
          </template>
        </el-table-column>
      </template>
    </FitnessLabeledTable>

    <el-dialog v-model="planDialogVisible" title="加入测试计划" width="420px">
      <el-select v-model="targetPlanId" placeholder="选择计划" filterable style="width:100%">
        <el-option v-for="p in planOptions" :key="p.id" :label="`${p.name} (${p.version_tag || '-'})`" :value="p.id" />
      </el-select>
      <template #footer>
        <el-button @click="planDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addingToPlan" :disabled="!targetPlanId" @click="confirmAddToPlan">确定</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import ItemFilterBar from '@/components/fitness/ItemFilterBar.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import {
  appendPlanItems,
  exportTestItems,
  fetchPlans,
  fetchTestItems,
} from '@/services/fitnessService.js';
import { downloadBlob, downloadJson } from '@/utils/fitnessExport.js';
import {
  categoryMajorTagProps,
  dimensionTagProps,
  envTierTagProps,
  execEnvTagProps,
  itemTagLabel,
  priorityTagProps,
} from '@/utils/fitnessItemTags.js';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const exporting = ref(false);
const addingToPlan = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const selectedRows = ref([]);
const FILTER_DEFAULTS = {
  dimension_id: '',
  category_major_id: '',
  priority_id: '',
  scheme_primary_id: '',
  validation_primary_id: '',
  automation_status_id: '',
  station_id: '',
  role_scope_id: '',
  is_p0_blocker: false,
  is_risk_flag: false,
  keyword: '',
  preset: '',
};

const filters = reactive({ ...FILTER_DEFAULTS, ...parseQueryFilters(route.query) });
const planDialogVisible = ref(false);
const planOptions = ref([]);
const targetPlanId = ref(null);

const EXECUTION_STATUS_TAG = {
  pending: 'info',
  running: 'warning',
  success: 'success',
  failed: 'danger',
  cancelled: 'info',
  not_run: '',
};

function executionStatusTagType(status) {
  return EXECUTION_STATUS_TAG[status] || 'info';
}

function formatPassRate(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n}%`;
}

const itemColumns = [
  { prop: 'item_id', label: '用例编码', width: 180 },
  { prop: 'detail_summary', label: '名称', minWidth: 220 },
  { prop: 'dimension_name', label: '维度', width: 88 },
  { prop: 'category_major_name', label: '大类', width: 100 },
  { prop: 'priority_name', label: '优先级', width: 88 },
  { prop: 'exec_env_name', label: '可执行环境', width: 100 },
  { prop: 'env_tier_name', label: '环境分层', width: 100 },
  { prop: 'sub_class', label: '子类标签', width: 110 },
  { prop: 'expected_observation', label: '期望观测', minWidth: 180 },
  { prop: 'scheme_primary_name', label: '主方案', width: 110 },
  { prop: 'validation_primary_name', label: '主验证', width: 110 },
  { prop: 'execution_status', label: '执行状态', width: 96 },
  { prop: 'current_pass_rate', label: '当前达标率', width: 100 },
  { prop: 'target_pass_rate', label: '目标达标率', width: 100 },
  { prop: 'automation_status_name', label: '自动化', width: 96 },
  { prop: 'station_name', label: '六站', width: 140 },
  { prop: 'role_scope_name', label: '三端', width: 80 },
];

function parseQueryFilters(q = {}) {
  const next = { ...FILTER_DEFAULTS };
  for (const [ k, v ] of Object.entries(q)) {
    if (k in FILTER_DEFAULTS) {
      if (k === 'is_p0_blocker' || k === 'is_risk_flag') next[k] = v === 'true';
      else next[k] = v;
    }
  }
  return next;
}

function applyFilters(v) {
  Object.assign(filters, { ...FILTER_DEFAULTS, ...(v || {}) });
}

function apiFilterParams() {
  const params = { ...filters };
  if (!params.is_p0_blocker) delete params.is_p0_blocker;
  if (!params.is_risk_flag) delete params.is_risk_flag;
  return params;
}

function syncRouteQuery() {
  const q = {};
  for (const [ k, v ] of Object.entries(filters)) {
    const empty = FILTER_DEFAULTS[k];
    if (typeof empty === 'boolean') {
      if (v !== empty) q[k] = 'true';
    } else if (v !== '' && v != null) {
      q[k] = String(v);
    }
  }
  router.replace({ query: q });
}

watch(() => route.query, (q) => applyFilters(parseQueryFilters(q)), { deep: true });

function onFilterChange() {
  page.value = 1;
  syncRouteQuery();
  loadData();
}

function onFilterClear() {
  page.value = 1;
  syncRouteQuery();
  loadData();
}

async function loadData() {
  loading.value = true;
  try {
    const data = await fetchTestItems({ ...apiFilterParams(), page: page.value, pageSize: pageSize.value });
    list.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function goDetail(row) {
  router.push(`/fitness/assets/items/${encodeURIComponent(row.item_id)}`);
}

async function copyText(text) {
  if (!text) {
    ElMessage.warning('无自动化命令可复制');
    return;
  }
  await navigator.clipboard.writeText(text);
  ElMessage.success('已复制到剪贴板');
}

function copyOneCommand(row) {
  copyText(row.automation_command || '');
}

function copyCommands() {
  const lines = selectedRows.value
    .map(r => r.automation_command)
    .filter(Boolean);
  if (!lines.length) {
    ElMessage.warning('选中项均无 automation_command');
    return;
  }
  copyText(lines.join('\n'));
}

async function exportJson() {
  exporting.value = true;
  try {
    const data = await exportTestItems(apiFilterParams(), 'json');
    const rows = selectedRows.value.length ? selectedRows.value : (data.list || []);
    downloadJson(`fitness-items-${Date.now()}.json`, rows);
  } finally {
    exporting.value = false;
  }
}

async function exportCsv() {
  exporting.value = true;
  try {
    const blob = await exportTestItems(apiFilterParams(), 'csv');
    downloadBlob(`fitness-items-${Date.now()}.csv`, blob);
  } finally {
    exporting.value = false;
  }
}

async function openAddToPlan() {
  if (!selectedRows.value.length) return;
  const data = await fetchPlans({ page: 1, pageSize: 100 });
  planOptions.value = data.list || [];
  targetPlanId.value = planOptions.value[0]?.id ?? null;
  planDialogVisible.value = true;
}

async function confirmAddToPlan() {
  if (!targetPlanId.value) return;
  addingToPlan.value = true;
  try {
    await appendPlanItems(targetPlanId.value, selectedRows.value.map(r => r.item_id));
    ElMessage.success(`已加入 ${selectedRows.value.length} 项`);
    planDialogVisible.value = false;
  } finally {
    addingToPlan.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.items-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
