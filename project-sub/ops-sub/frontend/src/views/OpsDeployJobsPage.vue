<template>
  <PageShell title="部署任务" table-layout>
    <template #extra>
      <el-button @click="goProjects">项目信息</el-button>
      <el-button @click="exportCsv">导出当前筛选 CSV</el-button>
    </template>

    <div class="ops-summary-row">
      <el-statistic title="进行中" :value="summary.running" />
      <el-statistic title="今日成功" :value="summary.success_today" />
      <el-statistic title="今日失败" :value="summary.failed_today" />
    </div>

    <div class="ops-filter-bar">
      <el-select
        v-model="filters.project_id"
        filterable
        remote
        clearable
        reserve-keyword
        placeholder="项目名称"
        :remote-method="searchProjects"
        :loading="projectLoading"
        style="width: 220px"
      >
        <el-option
          v-for="item in projectOptions"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
      <el-select v-model="filters.status" clearable placeholder="状态" style="width: 140px">
        <el-option v-for="item in DEPLOY_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-input v-model="filters.triggered_by" clearable placeholder="触发人" style="width: 140px" />
      <el-date-picker
        v-model="range"
        type="datetimerange"
        start-placeholder="开始"
        end-placeholder="结束"
        style="width: 340px"
      />
      <el-button type="primary" @click="apply">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" class="ops-list-error">
      <el-button link type="primary" @click="load">重试</el-button>
    </el-alert>

    <el-empty v-else-if="!loading && !jobs.length" description="还没有部署任务" />

    <DataTablePanel
      v-else
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="total"
      :loading="loading"
      @change="load"
    >
      <template #default="{ bodyHeight }">
        <el-table :data="jobs" :height="bodyHeight" row-key="id" @row-click="openLog">
          <el-table-column label="项目" min-width="160">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="goHistory(row)">
                {{ row.project_name || `#${row.project_id}` }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column prop="id" label="任务" width="80" />
          <el-table-column prop="git_tag" label="Tag" min-width="120" />
          <el-table-column prop="status" label="状态" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="deployStatusMeta(row.status).type">
                {{ deployStatusMeta(row.status).label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="triggered_by" label="触发人" width="120" />
          <el-table-column label="开始" width="170">
            <template #default="{ row }">{{ formatDateTime(row.started_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="openLog(row)">日志</el-button>
              <el-button
                v-if="row.status === 'queued' || row.status === 'running'"
                link
                type="danger"
                @click.stop="onAbort(row)"
              >
                中止
              </el-button>
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
import { abortDeployJob, fetchDeployJobs, fetchDeployJobsSummary } from '../services/opsDeployService.js';
import { fetchProjects } from '../services/opsService.js';
import { formatDateTime } from '../utils/opsMeta.js';
import { DEPLOY_STATUS_OPTIONS, deployStatusMeta } from '../utils/deployMeta.js';

const router = useRouter();
const loading = ref(false);
const loadError = ref('');
const jobs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const range = ref([]);
const filters = reactive({ project_id: '', status: '', triggered_by: '' });
const summary = reactive({ running: 0, success_today: 0, failed_today: 0 });
const projectOptions = ref([]);
const projectLoading = ref(false);
let pollTimer = null;

function goProjects() {
  router.push({ name: 'ops-list' });
}

function goHistory(row) {
  router.push({ name: 'ops-deploy-history', params: { id: String(row.project_id) } });
}

function openLog(row) {
  router.push({
    name: 'ops-deploy-log',
    params: { id: String(row.project_id), jobId: String(row.id) },
  });
}

async function searchProjects(name) {
  projectLoading.value = true;
  try {
    const data = await fetchProjects({ name, pageSize: 20 });
    projectOptions.value = data.list || [];
  } catch {
    projectOptions.value = [];
  } finally {
    projectLoading.value = false;
  }
}

async function loadSummary() {
  try {
    Object.assign(summary, await fetchDeployJobsSummary());
  } catch {
    /* keep last */
  }
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchDeployJobs({
      ...filters,
      from: range.value?.[0] ? new Date(range.value[0]).toISOString() : undefined,
      to: range.value?.[1] ? new Date(range.value[1]).toISOString() : undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    jobs.value = data.list || [];
    total.value = data.total || 0;
    await loadSummary();
  } catch (err) {
    loadError.value = err.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

function apply() {
  page.value = 1;
  load();
}

function reset() {
  filters.project_id = '';
  filters.status = '';
  filters.triggered_by = '';
  range.value = [];
  apply();
}

function exportCsv() {
  const header = [ 'id', 'project_id', 'project_name', 'git_tag', 'status', 'triggered_by', 'started_at' ];
  const rows = jobs.value.map((job) => header.map((key) => `"${String(job[key] ?? '').replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([ `${header.join(',')}\n${rows.join('\n')}` ], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'deploy-jobs.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function onAbort(row) {
  try {
    await ElMessageBox.confirm(`中止部署 #${row.id}？`, '确认', { type: 'warning' });
    await abortDeployJob(row.id);
    ElMessage.success('已中止');
    load();
  } catch (err) {
    if (err !== 'cancel') ElMessage.error(err.message || '中止失败');
  }
}

onMounted(() => {
  searchProjects('');
  load();
  pollTimer = setInterval(() => {
    loadSummary();
    if (jobs.value.some((job) => job.status === 'queued' || job.status === 'running')) load();
  }, 5000);
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<style scoped>
.ops-summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 32px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--ops-color-surface, rgba(255, 255, 255, 0.62));
  border: var(--ops-border-subtle, 1px solid rgba(47, 138, 91, 0.12));
  border-radius: var(--ops-radius-base, 10px);
}
</style>
