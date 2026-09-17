<template>
  <PageShell title="部署黑窗口">
    <template #extra>
      <el-button link @click="goDeploy">← 返回部署操作</el-button>
      <el-button @click="goHistory">部署历史</el-button>
    </template>

    <el-alert
      v-if="loadError"
      type="error"
      :title="loadError"
      show-icon
      :closable="false"
    >
      <el-button link type="primary" @click="load">重试</el-button>
    </el-alert>

    <template v-else-if="job.id">
      <div class="ops-deploy-log-head">
        <div>
          <h4 class="ops-page-title">{{ job.project_name || '部署' }} · #{{ job.id }}</h4>
          <p class="ops-deploy-log-meta">
            <el-tag size="small" :type="deployStatusMeta(job.status).type">{{ deployStatusMeta(job.status).label }}</el-tag>
            <span>{{ job.git_tag }}</span>
            <span>{{ job.triggered_by }}</span>
            <span>{{ formatDateTime(job.started_at) }} → {{ formatDateTime(job.finished_at) }}</span>
          </p>
        </div>
        <div class="ops-page-extra">
          <el-button @click="copyVisible">复制已见日志</el-button>
          <el-button @click="onExport">导出 txt</el-button>
          <el-button v-if="job.status === 'failed'" type="primary" :loading="retrying" @click="onRetry">重试</el-button>
          <el-button v-if="isActiveDeploy(job.status)" type="danger" :loading="aborting" @click="onAbort">中止</el-button>
        </div>
      </div>

      <el-steps :active="stepActive" align-center class="ops-deploy-steps" finish-status="success" :process-status="stepProcess">
        <el-step title="打 tag / 校验" />
        <el-step title="拉取" />
        <el-step title="构建" />
        <el-step title="检查" />
      </el-steps>

      <div class="ops-filter-bar">
        <el-input v-model="keyword" placeholder="搜索日志" clearable style="width: 220px" />
        <el-checkbox-group v-model="levels">
          <el-checkbox label="info">info</el-checkbox>
          <el-checkbox label="warn">warn</el-checkbox>
          <el-checkbox label="error">error</el-checkbox>
        </el-checkbox-group>
        <el-checkbox v-model="autoScroll">自动滚动</el-checkbox>
        <el-button v-if="!autoScroll" link type="primary" @click="autoScroll = true">回到底部</el-button>
      </div>

      <OpsDeployTerm
        :rows="visibleRows"
        :auto-scroll="autoScroll"
        :empty-text="emptyText"
        @pause-auto="autoScroll = false"
      />
    </template>
  </PageShell>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import OpsDeployTerm from '../components/ops/OpsDeployTerm.vue';
import { useDeployStream } from '../composables/useDeployStream.js';
import {
  abortDeployJob,
  downloadDeployLogsTxt,
  fetchDeployJob,
  fetchDeployLogs,
  retryDeployJob,
} from '../services/opsDeployService.js';
import { formatDateTime } from '../utils/opsMeta.js';
import { deployStatusMeta, isActiveDeploy } from '../utils/deployMeta.js';

const route = useRoute();
const router = useRouter();
const loadError = ref('');
const job = ref({ id: null, status: '' });
const lines = ref([]);
const keyword = ref('');
const levels = ref(['info', 'warn', 'error']);
const autoScroll = ref(true);
const retrying = ref(false);
const aborting = ref(false);
const { start } = useDeployStream();

const visibleRows = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return lines.value.filter((line) => {
    if (levels.value.length && !levels.value.includes(line.level)) return false;
    if (q && !String(line.message || '').toLowerCase().includes(q)) return false;
    return true;
  });
});

const emptyText = computed(() => (
  job.value.status === 'queued' ? '等待执行器领取…' : '暂无日志'
));

const stepActive = computed(() => {
  if (job.value.status === 'queued') return 0;
  if (job.value.status === 'running') return 2;
  return 4;
});

const stepProcess = computed(() => {
  if (job.value.status === 'failed' || job.value.status === 'aborted') return 'error';
  if (job.value.status === 'running') return 'process';
  return 'success';
});

function goDeploy() {
  router.push({ name: 'ops-deploy', params: { id: String(route.params.id) } });
}

function goHistory() {
  router.push({ name: 'ops-deploy-history', params: { id: String(route.params.id) } });
}

function upsertLine(line) {
  if (!line?.id) return;
  if (lines.value.some((item) => Number(item.id) === Number(line.id))) return;
  lines.value = [...lines.value, line].sort((a, b) => Number(a.id) - Number(b.id));
}

async function load() {
  loadError.value = '';
  try {
    const data = await fetchDeployJob(route.params.jobId);
    const next = data.job || data;
    if (Number(next.project_id) !== Number(route.params.id)) {
      loadError.value = '任务不属于该项目';
      return;
    }
    job.value = next;
    const logs = await fetchDeployLogs(next.id);
    lines.value = logs.list || [];
    const lastId = lines.value.at(-1)?.id;
    start(next.id, {
      after: lastId,
      onLog: upsertLine,
      onStatus: (payload) => { job.value = { ...job.value, ...payload }; },
      onEnd: () => {},
    });
  } catch (err) {
    loadError.value = err.message || '加载失败';
  }
}

async function copyVisible() {
  const text = visibleRows.value.map((line) => `${line.created_at} [${line.level}] ${line.message}`).join('\n');
  await navigator.clipboard.writeText(text || '');
  ElMessage.success('已复制当前可见日志');
}

async function onExport() {
  try {
    await downloadDeployLogsTxt(job.value.id);
  } catch (err) {
    ElMessage.error(err.message || '导出失败');
  }
}

async function onRetry() {
  retrying.value = true;
  try {
    const data = await retryDeployJob(job.value.id);
    router.replace({
      name: 'ops-deploy-log',
      params: { id: String(route.params.id), jobId: String(data.job.id) },
    });
    await load();
  } catch (err) {
    ElMessage.error(err.message || '重试失败');
  } finally {
    retrying.value = false;
  }
}

async function onAbort() {
  try {
    await ElMessageBox.confirm('确认中止该部署？', '中止', { type: 'warning' });
  } catch {
    return;
  }
  aborting.value = true;
  try {
    const data = await abortDeployJob(job.value.id);
    job.value = data.job || data;
  } catch (err) {
    ElMessage.error(err.message || '中止失败');
  } finally {
    aborting.value = false;
  }
}

watch(() => route.params.jobId, load, { immediate: true });
</script>

<style scoped>
.ops-deploy-log-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.ops-deploy-log-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 8px 0 0;
  color: var(--ops-color-text-secondary, #5c6b62);
  font-size: 13px;
}

.ops-deploy-steps {
  margin: 8px 0 20px;
}
</style>
