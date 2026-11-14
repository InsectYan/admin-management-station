<template>
  <section class="cartoon-module cartoon-flow-page">
    <div v-if="runId" class="cartoon-flow-detail">
      <div class="cartoon-board__head">
        <el-button link type="primary" @click="back">返回列表</el-button>
        <strong>{{ run?.chapter_title || '全流程' }}</strong>
        <el-tag :type="tagType(run?.status)" size="small">{{ statusText(run?.status) }}</el-tag>
        <el-button v-if="run?.status === 'running'" type="danger" plain size="small" @click="stopRun">停止</el-button>
      </div>
      <p v-if="run" class="cartoon-module__hint">
        {{ run.message || '等待执行' }}
        <template v-if="run.video_total"> · 镜头 {{ run.video_done }}/{{ run.video_total }}</template>
      </p>
      <p v-if="run" class="cartoon-module__hint">
        资产图：{{ run.asset_workflow_name || '—' }} · 首尾帧：{{ run.frame_workflow_name || '—' }} · 视频：{{ run.video_workflow_name || '—' }}
      </p>
      <div class="cartoon-flow">
        <template v-for="(item, index) in nodes" :key="item.key">
          <div class="cartoon-flow__node" :class="`is-${nodeStatus(item.key)}`">
            <span>{{ item.title }}</span>
            <small>{{ statusText(nodeStatus(item.key)) }}</small>
          </div>
          <span v-if="index < nodes.length - 1" class="cartoon-flow__arrow">→</span>
        </template>
      </div>
      <div class="cartoon-flow__log-wrap">
        <h4>执行说明</h4>
        <el-empty v-if="!(run?.log || []).length" description="还没有执行记录" />
        <ol v-else class="cartoon-flow__log">
        <li v-for="(item, index) in run.log" :key="`${item.at}-${index}`">
          <span>{{ item.text }}</span>
          <small>{{ logSpan(index) }}</small>
        </li>
        </ol>
      </div>
    </div>
    <template v-else>
      <h3 class="cartoon-module__title">全自动</h3>
      <p class="cartoon-module__hint">每条记录是一次从剧本到视频的全流程。点一行查看节点图和执行说明。</p>
      <el-empty v-if="!loading && !rows.length" description="还没有全流程" />
      <el-table v-else :data="rows" size="small" @row-click="openRun">
        <el-table-column prop="id" label="编号" width="80" />
        <el-table-column prop="chapter_title" label="章节" min-width="160" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="tagType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前节点" width="140">
          <template #default="{ row }">{{ nodeTitle(row.current_node) }}</template>
        </el-table-column>
        <el-table-column label="进度" min-width="180">
          <template #default="{ row }">{{ row.message || '—' }}</template>
        </el-table-column>
        <el-table-column label="镜头" width="100">
          <template #default="{ row }">{{ row.video_total ? `${row.video_done}/${row.video_total}` : '—' }}</template>
        </el-table-column>
        <el-table-column label="开始时间" width="180">
          <template #default="{ row }">{{ when(row.created_at) }}</template>
        </el-table-column>
      </el-table>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { request } from '../services/apiConfig.js';

const nodes = [
  { key: 'script', title: '生成剧本' },
  { key: 'assets', title: '确认并生成资产' },
  { key: 'storyboard', title: '拆分分镜' },
  { key: 'prompts', title: '生成提示词' },
  { key: 'workflow', title: '确认工作流' },
  { key: 'video', title: '生成视频' },
];
const statusNames = {
  pending: '未开始',
  running: '正在执行',
  success: '已完成',
  failed: '失败',
  stopped: '已停止',
  done: '已完成',
};

const route = useRoute();
const router = useRouter();
const rows = ref([]);
const run = ref(null);
const loading = ref(false);
const nowTick = ref(Date.now());
const runId = computed(() => String(route.query.run || ''));
let timer = 0;
let clock = 0;

function formatSpan(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const sec = Math.floor(ms / 1000);
  if (sec < 1) return '不到 1 秒';
  const hour = Math.floor(sec / 3600);
  const minute = Math.floor((sec % 3600) / 60);
  const second = sec % 60;
  if (hour) return `${hour}小时${minute}分${second}秒`;
  if (minute) return `${minute}分${second}秒`;
  return `${second}秒`;
}
function logSpan(index) {
  const log = run.value?.log || [];
  const item = log[index];
  const start = Date.parse(item?.at || '');
  if (!Number.isFinite(start)) return '';
  const next = Date.parse(log[index + 1]?.at || '');
  const end = Number.isFinite(next)
    ? next
    : (run.value?.status === 'running' ? nowTick.value : Date.parse(run.value?.updated_at || '') || start);
  const label = index === log.length - 1 && run.value?.status === 'running' ? '已进行' : '用时';
  return `${label} ${formatSpan(end - start)}`;
}

function statusText(value) {
  return statusNames[value] || '未开始';
}
function tagType(value) {
  if (value === 'success' || value === 'done') return 'success';
  if (value === 'failed') return 'danger';
  if (value === 'running') return 'warning';
  return 'info';
}
function nodeTitle(key) {
  if (key === 'done') return '已完成';
  return nodes.find(item => item.key === key)?.title || '—';
}
function nodeStatus(key) {
  return run.value?.nodes?.[key]?.status || 'pending';
}
function when(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { hour12: false });
}
function openRun(row) {
  router.replace({ query: { node: 'pipeline', run: String(row.id) } });
}
function back() {
  router.replace({ query: { node: 'pipeline' } });
}
async function load(quiet) {
  const projectId = route.params.id;
  if (!projectId) return;
  loading.value = true;
  try {
    if (runId.value) {
      run.value = await request(`/projects/${projectId}/full-auto/${runId.value}`);
    } else {
      run.value = null;
      rows.value = await request(`/projects/${projectId}/full-auto`) || [];
    }
  } catch (err) {
    if (!runId.value) rows.value = [];
    if (!quiet) ElMessage.error(err.message || '没有读到全流程');
  } finally {
    loading.value = false;
  }
}
async function stopRun() {
  if (!run.value?.id) return;
  try {
    await request(`/projects/${route.params.id}/full-auto/${run.value.id}/stop`, { method: 'post' });
    await load();
    ElMessage.info('已停止全流程');
  } catch (err) {
    ElMessage.error(err.message || '没有停止');
  }
}

watch(runId, () => {
  load().catch(() => {});
});
onMounted(() => {
  load().catch(() => {});
  timer = setInterval(() => {
    const live = run.value?.status === 'running' || rows.value.some(item => item.status === 'running');
    if (live) load(true).catch(() => {});
  }, 3000);
  clock = setInterval(() => { nowTick.value = Date.now(); }, 1000);
});
onUnmounted(() => {
  clearInterval(timer);
  clearInterval(clock);
});
</script>

<style scoped>
.cartoon-flow-page:has(.cartoon-flow-detail) {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-bottom: 16px;
}
.cartoon-flow-detail {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cartoon-flow__log-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cartoon-flow__log-wrap h4 { margin: 0 0 8px; }
.cartoon-flow__log li { display: flex; justify-content: space-between; gap: 12px; }
.cartoon-flow__log small { flex: 0 0 auto; color: #66706a; }
.cartoon-flow__log {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  padding: 8px 12px 20px 22px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(47, 138, 91, 0.12);
}
.cartoon-board__head { display: flex; align-items: center; gap: 12px; }
.cartoon-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.cartoon-flow__node {
  min-width: 108px;
  padding: 10px 12px;
  border: 1px solid #d9e0db;
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cartoon-flow__node small { color: #66706a; }
.cartoon-flow__node.is-running { border-color: #2f6f4e; background: #e7f3ec; }
.cartoon-flow__node.is-success { border-color: #2f6f4e; }
.cartoon-flow__node.is-failed { border-color: #c45656; }
.cartoon-flow__node.is-stopped { border-color: #b88230; }
.cartoon-flow__arrow { color: #66706a; }
</style>
