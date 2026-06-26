<template>
  <PageShell title="用例管理">
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

    <el-empty
      v-if="!filters.job_id && !suiteStore.loading"
      description="请从生成任务跳转，或在筛选栏输入 job_id"
    />

    <el-table
      v-else
      v-loading="suiteStore.loading"
      :data="suiteStore.filteredCases"
      stripe
      border
      style="width: 100%"
    >
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

    <div v-if="suiteStore.filteredCases.length" class="testgen-graph-wrap">
      <TestSuiteGraph :test-cases="suiteStore.filteredCases" />
    </div>
  </PageShell>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import TestSuiteGraph from '../components/TestSuiteGraph.vue';
import { useTestSuiteStore } from '../stores/testSuite';
import { deleteTestCase } from '../services/testCaseService';
import { resolveApiBase } from '../services/apiConfig';

const route = useRoute();
const router = useRouter();
const suiteStore = useTestSuiteStore();
const exporting = ref(false);

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

function syncQuery() {
  router.replace({
    name: 'test-suite',
    query: filters.job_id ? { job_id: filters.job_id } : {},
  });
}

function applyFilters() {
  suiteStore.setFilters({
    module: filters.module,
    type: filters.type,
    priority: filters.priority,
    status: filters.status,
  });
  syncQuery();
  loadData();
}

async function loadData() {
  if (!filters.job_id) return;
  const params = { job_id: filters.job_id };
  await suiteStore.loadCases(params);
  suiteStore.setFilters({
    module: filters.module,
    type: filters.type,
    priority: filters.priority,
    status: filters.status,
  });
}

async function handleDelete(row) {
  const id = row.case_id ?? row.id;
  try {
    await deleteTestCase(id);
    ElMessage.success('已删除');
    await loadData();
  } catch (err) {
    ElMessage.error(err.message || '删除失败');
  }
}

async function handleExport() {
  if (!filters.job_id) {
    ElMessage.warning('请先指定任务 ID');
    return;
  }
  exporting.value = true;
  try {
    const url = `${resolveApiBase()}/test-cases/export?job_id=${encodeURIComponent(filters.job_id)}&format=markdown`;
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
    if (jobId && jobId !== filters.job_id) {
      filters.job_id = jobId;
      loadData();
    }
  },
);

onMounted(() => {
  if (filters.job_id) {
    loadData();
  }
});
</script>
