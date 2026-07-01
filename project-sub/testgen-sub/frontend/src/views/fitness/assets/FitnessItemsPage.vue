<template>
  <PageShell title="用例库" table-layout>
    <ItemFilterBar
      :model-value="filters"
      :show-generation-job-input="true"
      @update:model-value="applyFilters"
      @change="onFilterChange"
      @clear="onFilterClear"
    >
      <template #extra>
        <el-button
          type="danger"
          plain
          :disabled="!selectedRows.length"
          :loading="deleting"
          @click="handleBatchDelete"
        >
          批量删除 ({{ selectedRows.length || 0 }})
        </el-button>
        <el-button
          type="danger"
          :loading="deletingAll"
          :disabled="!total"
          @click="handleDeleteAllFiltered"
        >
          一键删除 ({{ total }})
        </el-button>
      </template>
    </ItemFilterBar>
    <div class="items-toolbar">
      <el-button :disabled="!selectedRows.length" @click="openAddToPlan">加入计划 ({{ selectedRows.length || 0 }})</el-button>
      <el-button :loading="exporting" @click="exportJson">导出 JSON</el-button>
      <el-button :loading="exporting" @click="exportCsv">导出 CSV</el-button>
    </div>
    <FitnessLabeledTable
      ref="tableRef"
      :data="list"
      :columns="itemColumns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      :table-props="{ rowKey: 'item_id' }"
      @update:page="onPageChange"
      @update:page-size="onPageSizeChange"
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
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="goDetail(row)">详情</el-button>
            <el-button link size="small" data-testid="fitness-items-config" @click="goConfig(row)">配置</el-button>
            <el-button link type="primary" size="small" data-testid="fitness-items-launch" @click="goLaunch(row)">执行</el-button>
            <el-button link type="danger" size="small" @click="handleDeleteRow(row)">删除</el-button>
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
import { reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import ItemFilterBar from '@/components/fitness/ItemFilterBar.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import {
  appendPlanItems,
  batchDeleteTestItems,
  deleteTestItem,
  deleteTestItemsByFilter,
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
import {
  FILTER_DEFAULTS,
  buildItemDetailRoute,
  buildListQuery,
  parseListQuery,
} from '@/utils/itemListQuery.js';

const route = useRoute();
const router = useRouter();
const initialQuery = parseListQuery(route.query);
const loading = ref(false);
const exporting = ref(false);
const deleting = ref(false);
const deletingAll = ref(false);
const addingToPlan = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(initialQuery.page);
const pageSize = ref(initialQuery.pageSize);
const selectedRows = ref([]);
const tableRef = ref(null);
const filters = reactive({ ...FILTER_DEFAULTS, ...initialQuery.filters });
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
  { prop: 'project_name', label: '项目名称', width: 220 },
  { prop: 'detail_summary', label: '测试用例名称', minWidth: 220 },
  { prop: 'dimension_name', label: '维度', width: 88 },
  { prop: 'category_major_name', label: '大类', width: 100 },
  { prop: 'template_name', label: '配置模板', width: 110 },
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
  router.replace({
    name: 'test-suite',
    query: buildListQuery(filters, page.value, pageSize.value),
  });
}

watch(() => route.query, (q) => {
  const parsed = parseListQuery(q);
  applyFilters(parsed.filters);
  page.value = parsed.page;
  pageSize.value = parsed.pageSize;
  loadData();
}, { deep: true, immediate: true });

function onFilterChange() {
  page.value = 1;
  syncRouteQuery();
}

function onFilterClear() {
  page.value = 1;
  syncRouteQuery();
}

function onPageChange(nextPage) {
  page.value = nextPage;
  syncRouteQuery();
}

function onPageSizeChange(nextSize) {
  pageSize.value = nextSize;
  page.value = 1;
  syncRouteQuery();
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
  router.push(buildItemDetailRoute(row.item_id, {
    query: buildListQuery(filters, page.value, pageSize.value),
  }));
}

function goConfig(row) {
  router.push(buildItemDetailRoute(row.item_id, {
    module: 'config',
    query: buildListQuery(filters, page.value, pageSize.value),
  }));
}

function goLaunch(row) {
  router.push(buildItemDetailRoute(row.item_id, {
    module: 'launch',
    query: buildListQuery(filters, page.value, pageSize.value),
  }));
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

function clearTableSelection() {
  selectedRows.value = [];
  tableRef.value?.clearSelection?.();
}

async function handleDeleteRow(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除用例「${row.detail_summary || row.item_id}」吗？`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
    await deleteTestItem(row.item_id);
    ElMessage.success('已删除');
    clearTableSelection();
    await loadData();
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err.message || '删除失败');
    }
  }
}

async function handleBatchDelete() {
  if (!selectedRows.value.length) return;
  try {
    await ElMessageBox.confirm(
      `确定删除已勾选的 ${selectedRows.value.length} 条用例吗？`,
      '批量删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
    deleting.value = true;
    const count = selectedRows.value.length;
    const result = await batchDeleteTestItems(selectedRows.value.map(r => r.item_id));
    clearTableSelection();
    ElMessage.success(`已删除 ${result.deleted ?? count} 条`);
    await loadData();
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err.message || '批量删除失败');
    }
  } finally {
    deleting.value = false;
  }
}

async function handleDeleteAllFiltered() {
  if (!total.value) return;
  try {
    await ElMessageBox.confirm(
      `确定删除当前筛选条件下的全部 ${total.value} 条用例吗？此操作不可恢复。`,
      '一键删除',
      { type: 'warning', confirmButtonText: '全部删除', cancelButtonText: '取消' },
    );
    deletingAll.value = true;
    const result = await deleteTestItemsByFilter(apiFilterParams());
    clearTableSelection();
    ElMessage.success(`已删除 ${result.deleted ?? 0} 条`);
    page.value = 1;
    syncRouteQuery();
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error(err.message || '删除失败');
    }
  } finally {
    deletingAll.value = false;
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
</script>

<style scoped>
.items-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
