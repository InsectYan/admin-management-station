<template>
  <PageShell title="任务队列" table-layout>
    <template #extra>
      <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
    </template>

    <div class="ops-filter-bar">
      <el-select v-model="filters.biz_app" style="width: 140px" @change="apply">
        <el-option v-for="item in BIZ_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="filters.project_id" clearable placeholder="漫剧项目" style="width: 200px">
        <el-option v-for="item in projects" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <el-select v-model="filters.status" clearable placeholder="状态" style="width: 140px">
        <el-option v-for="item in TASK_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-checkbox v-model="filters.stuck">仅卡住</el-checkbox>
      <el-button type="primary" @click="apply">查询</el-button>
    </div>

    <el-alert v-if="note" type="info" :title="note" show-icon :closable="false" />
    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <el-empty v-else-if="!loading && !jobs.length" description="没有符合条件的任务" />

    <DataTablePanel
      v-else
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="total"
      :loading="loading"
      @change="load"
    >
      <template #default="{ bodyHeight }">
        <el-table :data="jobs" :height="bodyHeight" row-key="id" @row-click="openJob">
          <el-table-column prop="id" label="任务" width="80" />
          <el-table-column prop="project_name" label="项目" min-width="140" />
          <el-table-column label="类型" width="110">
            <template #default="{ row }">{{ kindLabel(row.kind) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="120">
            <template #default="{ row }">
              <el-tag size="small" :type="taskStatusMeta(row.status).type">{{ taskStatusMeta(row.status).label }}</el-tag>
              <el-tag v-if="row.stuck" size="small" type="danger" class="ops-stuck-tag">卡住</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="排队 / 耗时" width="120">
            <template #default="{ row }">{{ formatDuration(row.queue_seconds) }}</template>
          </el-table-column>
          <el-table-column prop="error_message" label="错误" min-width="200" show-overflow-tooltip />
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="openJob(row)">诊断</el-button>
              <el-button v-if="canRetry(row)" link type="primary" @click.stop="onRetry(row)">重试</el-button>
              <el-button v-if="canCancel(row)" link type="danger" @click.stop="onCancel(row)">取消</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </DataTablePanel>
  </PageShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import DataTablePanel from '../components/DataTablePanel.vue';
import { cancelContentJob, fetchContentJobs, fetchContentProjects, retryContentJob } from '../services/contentOpsService.js';
import { BIZ_OPTIONS, TASK_STATUS_OPTIONS, formatDuration, kindLabel, taskStatusMeta } from '../utils/contentMeta.js';
import { formatDateTime } from '../utils/opsMeta.js';

const router = useRouter();
const loading = ref(false);
const loadError = ref('');
const note = ref('');
const jobs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const projects = ref([]);
const filters = reactive({
  biz_app: 'cartoon',
  project_id: undefined,
  status: '',
  stuck: false,
});

function canRetry(row) {
  return row.retryable !== false && (row.status === 'failed' || row.status === 'cancelled');
}
function canCancel(row) {
  return row.cancellable !== false && (row.status === 'pending' || row.status === 'queued' || row.status === 'running');
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchContentJobs({
      biz_app: filters.biz_app,
      project_id: filters.project_id || undefined,
      status: filters.status || undefined,
      stuck: filters.stuck ? '1' : undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    jobs.value = data.list || [];
    total.value = data.total || 0;
    note.value = data.note || '';
  } catch (err) {
    loadError.value = err.message;
    jobs.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function apply() {
  page.value = 1;
  load();
}

function openJob(row) {
  router.push(`/jobs/${row.biz_app || 'cartoon'}/${row.id}`);
}

async function onRetry(row) {
  try {
    await ElMessageBox.confirm(`重跑漫剧任务 #${row.id}？将使用原来的提示词。`, '重试');
    await retryContentJob('cartoon', row.id);
    ElMessage.success('已提交重试');
    await load();
  } catch (err) {
    if (err === 'cancel' || err?.message === 'cancel') return;
    ElMessage.error(err.message || '重试失败');
  }
}

async function onCancel(row) {
  try {
    await ElMessageBox.confirm(`取消漫剧任务 #${row.id}？`, '取消任务');
    await cancelContentJob('cartoon', row.id);
    ElMessage.success('已取消');
    await load();
  } catch (err) {
    if (err === 'cancel' || err?.message === 'cancel') return;
    ElMessage.error(err.message || '取消失败');
  }
}

let timer;
onMounted(async () => {
  try {
    projects.value = await fetchContentProjects({ biz_app: 'cartoon' });
  } catch {
    projects.value = [];
  }
  await load();
  timer = setInterval(load, 15000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<style scoped>
.ops-stuck-tag {
  margin-left: 6px;
}
</style>
