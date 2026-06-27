<template>
  <PageShell title="测试用例管理" table-layout>
    <template #extra>
      <el-button :loading="exporting" @click="handleExport">导出 Markdown</el-button>
      <el-button type="primary" @click="router.push({ name: 'test-scope' })">
        新建生成任务
      </el-button>
    </template>

    <div class="testgen-filter-bar">
      <el-input
        v-model="filters.job_id"
        placeholder="任务 ID"
        clearable
        style="width: 200px"
        @change="applyFilters"
      />
      <el-select
        v-model="filters.module"
        placeholder="模块"
        clearable
        style="width: 160px"
        @change="applyFilters"
      >
        <el-option
          v-for="m in moduleOptions"
          :key="m"
          :label="m"
          :value="m"
        />
      </el-select>
      <el-select
        v-model="filters.type"
        placeholder="类型"
        clearable
        style="width: 140px"
        @change="applyFilters"
      >
        <el-option label="功能" value="functional" />
        <el-option label="边界" value="edge" />
        <el-option label="安全" value="security" />
      </el-select>
      <el-select
        v-model="filters.priority"
        placeholder="优先级"
        clearable
        style="width: 120px"
        @change="applyFilters"
      >
        <el-option label="高" value="high" />
        <el-option label="中" value="medium" />
        <el-option label="低" value="low" />
      </el-select>
      <el-button @click="loadData">刷新</el-button>
    </div>

    <div class="testgen-action-bar">
      <el-button
        type="danger"
        plain
        :disabled="!selectedRows.length"
        :loading="batchDeleting"
        @click="handleBatchDelete"
      >
        批量删除
      </el-button>
      <el-button
        type="danger"
        :loading="deletingAll"
        @click="handleDeleteAll"
      >
        一键删除
      </el-button>
      <span v-if="selectedRows.length" class="testgen-action-bar__hint">
        已选 {{ selectedRows.length }} 条
      </span>
    </div>

    <DataTablePanel
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="suiteStore.loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="loadData"
    >
      <template #default="{ bodyHeight }">
        <el-table
          ref="tableRef"
          v-loading="suiteStore.loading"
          :data="suiteStore.cases"
          :height="bodyHeight ?? undefined"
          row-key="id"
          stripe
          border
          style="width: 100%"
          empty-text="暂无测试用例"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="48" fixed="left" reserve-selection />
          <el-table-column prop="job_id" label="任务 ID" width="90" />
          <el-table-column prop="case_id" label="用例 ID" width="140" show-overflow-tooltip />
          <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
          <el-table-column prop="module" label="模块" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ row.module }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="100" />
          <el-table-column prop="priority" label="优先级" width="90">
            <template #default="{ row }">
              <el-tag :type="priorityTagType(row.priority)" size="small">
                {{ priorityLabel(row.priority) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column prop="confidence" label="置信度" width="100">
            <template #default="{ row }">
              <span
                v-if="row.confidence != null"
                :style="{ color: confidenceColor(row.confidence) }"
              >
                {{ (row.confidence * 100).toFixed(0) }}%
              </span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-popconfirm title="确认删除该用例？" @confirm="handleDelete(row)">
                <template #reference>
                  <el-button link type="danger" size="small">删除</el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </DataTablePanel>
  </PageShell>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import DataTablePanel from '../components/DataTablePanel.vue';
import { useTestSuiteStore } from '../stores/testSuite';
import {
  deleteTestCase,
  batchDeleteTestCases,
  deleteAllTestCases,
} from '../services/testCaseService';
import { resolveApiBase } from '../services/apiConfig';

const route = useRoute();
const router = useRouter();
const suiteStore = useTestSuiteStore();
const tableRef = ref(null);
const selectedRows = ref([]);
const exporting = ref(false);
const batchDeleting = ref(false);
const deletingAll = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const filters = reactive({
  job_id: route.query.job_id || '',
  module: '',
  type: '',
  priority: '',
  status: '',
});

const moduleOptions = computed(() => {
  const set = new Set(suiteStore.cases.map((c) => c.module).filter(Boolean));
  return [...set];
});

function confidenceColor(v) {
  if (v >= 0.9) return '#67c23a';
  if (v >= 0.7) return '#e6a23c';
  return '#f56c6c';
}

function priorityLabel(p) {
  const map = { high: '高', medium: '中', low: '低' };
  return map[p] || p;
}

function priorityTagType(p) {
  const map = { high: 'danger', medium: 'warning', low: 'info' };
  return map[p] || 'info';
}

function handleSelectionChange(rows) {
  selectedRows.value = rows;
}

function clearSelection() {
  selectedRows.value = [];
  tableRef.value?.clearSelection();
}

function buildQueryParams() {
  const params = {
    page: page.value,
    pageSize: pageSize.value,
  };
  if (filters.job_id) params.job_id = filters.job_id;
  if (filters.module) params.module = filters.module;
  if (filters.type) params.type = filters.type;
  if (filters.priority) params.priority = filters.priority;
  if (filters.status) params.status = filters.status;
  return params;
}

function syncQuery() {
  router.replace({
    name: 'test-suite',
    query: filters.job_id ? { job_id: filters.job_id } : {},
  });
}

function applyFilters() {
  page.value = 1;
  clearSelection();
  syncQuery();
  loadData();
}

async function loadData() {
  try {
    const result = await suiteStore.loadCases(buildQueryParams());
    total.value = result?.total ?? 0;
  } catch (err) {
    ElMessage.error(err.message || '加载失败');
  }
}

async function handleDelete(row) {
  try {
    await deleteTestCase(row.id);
    ElMessage.success('已删除');
    if (suiteStore.cases.length === 1 && page.value > 1) {
      page.value -= 1;
    }
    clearSelection();
    await loadData();
  } catch (err) {
    ElMessage.error(err.message || '删除失败');
  }
}

async function handleBatchDelete() {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先勾选要删除的用例');
    return;
  }
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedRows.value.length} 条测试用例？此操作不可恢复。`,
      '批量删除',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }

  batchDeleting.value = true;
  try {
    const ids = selectedRows.value.map((row) => row.id);
    const result = await batchDeleteTestCases(ids);
    ElMessage.success(`已删除 ${result?.deleted ?? ids.length} 条`);
    clearSelection();
    if (suiteStore.cases.length <= ids.length && page.value > 1) {
      page.value -= 1;
    }
    await loadData();
  } catch (err) {
    ElMessage.error(err.message || '批量删除失败');
  } finally {
    batchDeleting.value = false;
  }
}

async function handleDeleteAll() {
  try {
    await ElMessageBox.confirm(
      '确认清空 test_cases 表中的全部测试用例？此操作不可恢复。',
      '一键删除',
      { type: 'error', confirmButtonText: '全部删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }

  deletingAll.value = true;
  try {
    const result = await deleteAllTestCases();
    ElMessage.success(`已清空 ${result?.deleted ?? 0} 条测试用例`);
    page.value = 1;
    clearSelection();
    await loadData();
  } catch (err) {
    ElMessage.error(err.message || '一键删除失败');
  } finally {
    deletingAll.value = false;
  }
}

async function handleExport() {
  exporting.value = true;
  try {
    const query = new URLSearchParams({ format: 'markdown' });
    if (filters.job_id) query.set('job_id', filters.job_id);
    if (filters.module) query.set('module', filters.module);
    if (filters.type) query.set('type', filters.type);
    const url = `${resolveApiBase()}/test-cases/export?${query.toString()}`;
    window.open(url, '_blank');
  } catch (err) {
    ElMessage.error(err.message || '导出失败');
  } finally {
    exporting.value = false;
  }
}

watch(
  () => route.query.job_id,
  (jobId) => {
    if (jobId !== filters.job_id) {
      filters.job_id = jobId || '';
      page.value = 1;
      clearSelection();
      loadData();
    }
  },
);

onMounted(() => {
  loadData();
});
</script>
