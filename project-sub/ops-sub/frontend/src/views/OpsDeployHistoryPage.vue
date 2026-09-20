<template>
  <PageShell title="部署历史" table-layout>
    <template #extra>
      <el-button link @click="goDetail">← 项目详情</el-button>
      <el-button type="primary" @click="goDeploy">去部署</el-button>
      <el-button @click="router.push({ name: 'ops-deploy-jobs' })">任务总览</el-button>
      <el-button @click="exportCsv">导出当前筛选 CSV</el-button>
    </template>

    <div class="ops-filter-bar">
      <el-select v-model="filters.status" clearable placeholder="状态" style="width: 140px">
        <el-option v-for="item in DEPLOY_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-input v-model="filters.triggered_by" clearable placeholder="触发人" style="width: 140px" />
      <el-input v-model="filters.git_tag" clearable placeholder="tag" style="width: 140px" />
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

    <el-empty v-else-if="!loading && !jobs.length" description="还没有部署记录">
      <el-button type="primary" @click="goDeploy">去部署</el-button>
    </el-empty>

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
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="git_tag" label="Tag" min-width="120" />
          <el-table-column prop="status" label="状态" width="110">
            <template #default="{ row }">
              <el-tag size="small" :type="deployStatusMeta(row.status).type">
                {{ deployStatusMeta(row.status).label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="triggered_by" label="账号" width="120" />
          <el-table-column label="开始" width="170">
            <template #default="{ row }">{{ formatDateTime(row.started_at) }}</template>
          </el-table-column>
          <el-table-column label="结束" width="170">
            <template #default="{ row }">{{ formatDateTime(row.finished_at) }}</template>
          </el-table-column>
          <el-table-column label="耗时" width="100">
            <template #default="{ row }">{{ deployDuration(row) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="openLog(row)">查看日志</el-button>
              <el-button link @click.stop="onExport(row)">导出</el-button>
              <el-button v-if="row.status === 'failed'" link @click.stop="onRetry(row)">重试</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </DataTablePanel>
  </PageShell>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import DataTablePanel from '../components/DataTablePanel.vue';
import {
  downloadDeployLogsTxt,
  fetchProjectDeployJobs,
  retryDeployJob,
} from '../services/opsDeployService.js';
import { formatDateTime } from '../utils/opsMeta.js';
import { DEPLOY_STATUS_OPTIONS, deployDuration, deployStatusMeta } from '../utils/deployMeta.js';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const loadError = ref('');
const jobs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const range = ref([]);
const filters = reactive({ status: '', triggered_by: '', git_tag: '' });

function goDetail() {
  const id = String(route.params.id || '').trim();
  if (!id) return;
  router.push({ name: 'ops-detail', params: { id } }).catch(() => {});
}

function goDeploy() {
  router.push({ name: 'ops-deploy', params: { id: String(route.params.id) } });
}

function openLog(row) {
  router.push({
    name: 'ops-deploy-log',
    params: { id: String(route.params.id), jobId: String(row.id) },
  });
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchProjectDeployJobs(route.params.id, {
      ...filters,
      from: range.value?.[0] ? new Date(range.value[0]).toISOString() : undefined,
      to: range.value?.[1] ? new Date(range.value[1]).toISOString() : undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    jobs.value = data.list || [];
    total.value = data.total || 0;
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
  filters.status = '';
  filters.triggered_by = '';
  filters.git_tag = '';
  range.value = [];
  apply();
}

function exportCsv() {
  const header = [ 'id', 'git_tag', 'status', 'triggered_by', 'started_at', 'finished_at' ];
  const rows = jobs.value.map((job) => header.map((key) => `"${String(job[key] ?? '').replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([ `${header.join(',')}\n${rows.join('\n')}` ], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deploy-jobs-${route.params.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function onExport(row) {
  try {
    await downloadDeployLogsTxt(row.id);
  } catch (err) {
    ElMessage.error(err.message || '导出失败');
  }
}

async function onRetry(row) {
  try {
    const data = await retryDeployJob(row.id);
    openLog(data.job);
  } catch (err) {
    ElMessage.error(err.message || '重试失败');
  }
}

watch(() => route.params.id, load, { immediate: true });
</script>
