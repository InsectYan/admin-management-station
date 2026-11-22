<template>
  <section class="cartoon-module cartoon-flow-page">
    <div v-if="runId || jobId" class="cartoon-flow-detail">
      <div class="cartoon-board__head">
        <el-button link type="primary" @click="back">返回列表</el-button>
        <strong>{{ run?.chapter_title || kindLabel(run?.run_kind) }}</strong>
        <el-tag size="small" effect="plain">{{ kindLabel(run?.run_kind) }}</el-tag>
        <el-tag :type="tagType(run?.status)" size="small">{{ statusText(run?.status) }}</el-tag>
        <el-button v-if="run?.status === 'running'" type="danger" plain size="small" @click="stopRun">停止</el-button>
      </div>
      <p v-if="run" class="cartoon-module__hint">
        {{ run.message || '等待执行' }}
        <template v-if="run.video_total"> · 镜头 {{ run.video_done }}/{{ run.video_total }}</template>
        · {{ modelText(run) }}
      </p>
      <p v-if="run?.run_kind === 'full'" class="cartoon-module__hint">
        资产图：{{ run.asset_workflow_name || '—' }} · 首尾帧：{{ run.frame_workflow_name || '—' }} · 视频：{{ run.video_workflow_name || '—' }}
      </p>
      <div class="cartoon-flow__canvas">
        <PipelineFlowGraph
          scope="full-auto-live"
          :nodes="liveNodes"
          :edges="liveEdges"
          :selected-id="''"
          @select="showFaults"
        />
      </div>
      <el-table v-if="run?.source === 'job'" :data="run.items || []" size="small">
        <el-table-column prop="shot_code" label="镜头" width="120" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ statusText(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="说明" min-width="220" />
        <el-table-column label="异常" min-width="220">
          <template #default="{ row }">{{ itemFaults(row) || '—' }}</template>
        </el-table-column>
        <el-table-column label="任务" width="90">
          <template #default="{ row }">{{ row.task_id || '—' }}</template>
        </el-table-column>
      </el-table>
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
      <el-dialog v-model="faultDialog.open" :title="faultDialog.title" width="640px" append-to-body>
        <pre class="cartoon-flow__fault">{{ faultDialog.text }}</pre>
      </el-dialog>
    </div>
    <div v-else class="cartoon-flow__list">
      <h3 class="cartoon-module__title">全自动</h3>
      <p class="cartoon-module__hint">按类型查看。全流程、到分镜、提示词、视频和提示词加视频各有一张流程图。视频一键执行的镜头条目在详情里。</p>
      <div v-if="kindFilter !== 'all'" class="cartoon-flow__canvas">
        <PipelineFlowGraph
          scope="full-auto-template"
          :nodes="templateNodes"
          :edges="templateEdges"
          :selected-id="''"
        />
      </div>
      <el-button-group class="cartoon-flow__kinds">
        <el-button
          v-for="item in kindFilters"
          :key="item.key"
          :type="kindFilter === item.key ? 'primary' : 'default'"
          @click="kindFilter = item.key"
        >{{ item.label }}</el-button>
      </el-button-group>
      <div class="cartoon-flow__table">
      <el-empty v-if="!loading && !shownRows.length" description="这个类型还没有记录" />
      <el-table v-else :data="pageRows" height="100%" size="small" @row-click="openRun">
        <el-table-column prop="id" label="编号" width="80" />
        <el-table-column label="类型" width="140">
          <template #default="{ row }">{{ kindLabel(row.run_kind) }}</template>
        </el-table-column>
        <el-table-column label="模型" min-width="200">
          <template #default="{ row }">{{ modelText(row) }}</template>
        </el-table-column>
        <el-table-column prop="chapter_title" label="章节" min-width="160" />
        <el-table-column label="状态" width="110">
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
        <el-table-column label="异常" min-width="240">
          <template #default="{ row }">{{ faultText(row) || '—' }}</template>
        </el-table-column>
        <el-table-column label="镜头" width="100">
          <template #default="{ row }">{{ row.video_total ? `${row.video_done}/${row.video_total}` : '—' }}</template>
        </el-table-column>
        <el-table-column label="开始时间" width="180">
          <template #default="{ row }">{{ when(row.created_at) }}</template>
        </el-table-column>
      </el-table>
      </div>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        class="cartoon-pager"
        :page-sizes="PAGE_SIZES"
        :total="shownRows.length"
        :layout="PAGER_LAYOUT"
        @size-change="page = 1"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PipelineFlowGraph from '../components/pipeline/PipelineFlowGraph.vue';
import { PAGE_SIZES, PAGER_LAYOUT } from '../lib/pager.js';
import { request } from '../services/apiConfig.js';

const kindFilters = [
  { key: 'all', label: '全部' },
  { key: 'full', label: '全流程' },
  { key: 'storyboard', label: '到分镜' },
  { key: 'prompt', label: '提示词一键执行' },
  { key: 'video', label: '视频一键执行' },
  { key: 'prompt_video', label: '提示词+视频' },
];
const flowTemplates = {
  full: [
    [ 'start', '发起', 'start' ],
    [ 'script', '生成剧本', 'action' ],
    [ 'profiles', '生成资产描述', 'action' ],
    [ 'assets', '生成资产', 'action' ],
    [ 'storyboard', '拆分分镜', 'action' ],
    [ 'prompts', '生成提示词', 'action' ],
    [ 'workflow', '确认工作流', 'action' ],
    [ 'video', '生成视频', 'action' ],
    [ 'end', '结束', 'end' ],
  ],
  storyboard: [
    [ 'start', '发起', 'start' ],
    [ 'script', '生成剧本', 'action' ],
    [ 'storyboard', '拆分分镜', 'action' ],
    [ 'end', '结束', 'end' ],
  ],
  prompt: [
    [ 'start', '发起', 'start' ],
    [ 'prompts', '逐镜生成提示词', 'action' ],
    [ 'save', '写回镜头', 'action' ],
    [ 'end', '结束', 'end' ],
  ],
  video: [
    [ 'start', '发起', 'start' ],
    [ 'submit', '逐镜提交视频', 'action' ],
    [ 'wait', '等待成片', 'action' ],
    [ 'end', '结束', 'end' ],
  ],
  prompt_video: [
    [ 'start', '发起', 'start' ],
    [ 'prompts', '逐镜生成提示词', 'action' ],
    [ 'video', '逐镜生成视频', 'action' ],
    [ 'end', '结束', 'end' ],
  ],
  assets: [
    [ 'start', '发起', 'start' ],
    [ 'assets', '生成设定图', 'action' ],
    [ 'end', '结束', 'end' ],
  ],
  profiles: [
    [ 'start', '发起', 'start' ],
    [ 'assets', '生成资产描述', 'action' ],
    [ 'end', '结束', 'end' ],
  ],
};
function layoutOf(kind) {
  const steps = flowTemplates[kind] || flowTemplates.full;
  const nodes = steps.map((step, index) => ({
    id: step[0],
    name: step[1],
    type: step[2],
    x: 16 + (index % 6) * 210,
    y: 16 + Math.floor(index / 6) * 128,
  }));
  const edges = steps.slice(1).map((step, index) => ({
    id: `${kind}-${index}`,
    source: steps[index][0],
    target: step[0],
    type: 'next',
  }));
  return { nodes, edges };
}
function subtitleOf(status) {
  if (status === 'ok') return '正常';
  if (status === 'error') return '异常';
  if (status === 'skip') return '已停止';
  if (status === 'todo') return '正在执行';
  return '未执行';
}
const statusNames = {
  pending: '未开始',
  running: '正在执行',
  success: '已完成',
  exception: '有异常',
  failed: '失败',
  skipped: '跳过',
  stopped: '已停止',
  done: '已完成',
};
const kindNames = {
  full: '全流程',
  storyboard: '到分镜',
  prompt: '提示词一键执行',
  video: '视频一键执行',
  prompt_video: '提示词+视频',
  assets: '设定图',
  profiles: '资产描述',
};

const route = useRoute();
const router = useRouter();
const rows = ref([]);
const run = ref(null);
const loading = ref(false);
const kindFilter = ref('all');
const page = ref(1);
const pageSize = ref(50);
const nowTick = ref(Date.now());
const runId = computed(() => String(route.query.run || ''));
const jobId = computed(() => String(route.query.job || ''));
const shownRows = computed(() => (
  kindFilter.value === 'all' ? rows.value : rows.value.filter(item => item.run_kind === kindFilter.value)
));
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return shownRows.value.slice(start, start + pageSize.value);
});
const templateGraph = computed(() => layoutOf(kindFilter.value === 'all' ? 'full' : kindFilter.value));
const templateNodes = computed(() => templateGraph.value.nodes.map(node => ({
  ...node,
  status: 'wait',
  subtitle: '模版',
})));
const templateEdges = computed(() => templateGraph.value.edges);
const liveGraph = computed(() => layoutOf(run.value?.run_kind || 'full'));
const faultDialog = reactive({ open: false, title: '', text: '' });
const liveNodes = computed(() => liveGraph.value.nodes.map(node => {
  const status = paintStatus(node.id, run.value);
  const faults = faultsForNode(run.value, node.id);
  const latest = faults.at(-1) || '';
  return { ...node, status, subtitle: latest ? shortText(latest) : subtitleOf(status) };
}));
const liveEdges = computed(() => liveGraph.value.edges);
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
  if (value === 'exception') return 'danger';
  if (value === 'failed') return 'danger';
  if (value === 'running') return 'primary';
  return 'info';
}
function settled(status) {
  return status === 'success' || status === 'done' || status === 'exception';
}
function modelText(row) {
  const profile = String(row?.llm_profile || '').trim();
  const tokens = Number(row?.max_tokens) || 0;
  if (!profile && !tokens) return '未记录（当时为技能默认 qwen3.6）';
  const tokenText = tokens ? ` · 最大 token ${tokens}` : '';
  return `${profile || '技能默认'}${tokenText}`;
}
function kindLabel(kind) {
  return kindNames[kind] || '全流程';
}
function shortText(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > 18 ? `${value.slice(0, 18)}…` : value;
}
function messagesOf(node) {
  const list = Array.isArray(node?.failures) ? node.failures : [];
  return list.map(item => String(item?.message || '').trim()).filter(Boolean);
}
function faultsOf(row) {
  if (Array.isArray(row?.faults) && row.faults.length) return row.faults;
  const nodes = row?.nodes || {};
  const lines = [];
  Object.entries(nodes).forEach(([ key, node ]) => {
    const messages = messagesOf(node);
    messages.forEach(message => lines.push(`${nodeTitle(key)}：${message}`));
    if (!messages.length && node?.status === 'failed' && node.note) lines.push(`${nodeTitle(key)}：${node.note}`);
  });
  return lines;
}
function faultText(row) {
  return faultsOf(row).join('；');
}
function itemFaults(row) {
  const stored = Array.isArray(row?.failures) ? row.failures : [];
  return stored.map(entry => (typeof entry === 'string' ? entry : entry?.message)).filter(Boolean).join('；');
}
function faultsForNode(current, nodeId) {
  if (!current) return [];
  if (current.source === 'job') {
    if (nodeId !== 'submit' && nodeId !== 'wait') return [];
    if (Array.isArray(current.faults) && current.faults.length) return current.faults;
    return (current.items || []).flatMap(item => {
      const stored = Array.isArray(item.failures) ? item.failures : [];
      const messages = stored.map(entry => (typeof entry === 'string' ? entry : entry?.message)).filter(Boolean);
      if (!messages.length && item.status === 'failed' && item.reason) messages.push(item.reason);
      return messages.map(message => `${item.shot_code || item.shot_id}：${message}`);
    });
  }
  const node = current.nodes?.[nodeId];
  const messages = messagesOf(node);
  if (!messages.length && node?.status === 'failed' && node.note) return [ node.note ];
  return messages;
}
function showFaults(id) {
  const lines = faultsForNode(run.value, id);
  if (!lines.length) return;
  faultDialog.title = nodeTitle(id);
  faultDialog.text = lines.join('\n\n');
  faultDialog.open = true;
}
function nodeTitle(key) {
  if (key === 'done') return '已完成';
  const steps = Object.values(flowTemplates).flat();
  return steps.find(item => item[0] === key)?.[1] || '—';
}
function paintStatus(nodeId, current) {
  if (!current) return 'wait';
  if (current.source === 'job') {
    const done = settled(current.status);
    const failed = current.status === 'failed';
    const stopped = current.status === 'stopped';
    const running = current.status === 'running';
    if (nodeId === 'start') return 'ok';
    if (nodeId === 'end') return done ? 'ok' : 'wait';
    if (nodeId === 'submit' || nodeId === 'wait') {
      if (running) return 'todo';
      if (done) return 'ok';
      if (failed) return 'error';
      if (stopped) return 'skip';
    }
    return 'wait';
  }
  if (nodeId === 'start') return 'ok';
  if (nodeId === 'end') return settled(current.status) ? 'ok' : 'wait';
  const state = current.nodes?.[nodeId]?.status;
  if (state === 'success') return 'ok';
  if (state === 'failed') return 'error';
  if (state === 'stopped') return 'skip';
  if (state === 'running') return 'todo';
  return 'wait';
}
function when(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', { hour12: false });
}
function openRun(row) {
  const query = { node: 'pipeline' };
  if (row.source === 'job') query.job = String(row.id);
  else query.run = String(row.id);
  router.replace({ query });
}
function back() {
  router.replace({ query: { node: 'pipeline' } });
}
async function load(quiet) {
  const projectId = route.params.id;
  if (!projectId) return;
  loading.value = true;
  try {
    if (jobId.value) {
      run.value = await request(`/projects/${projectId}/full-auto/jobs/${jobId.value}`);
    } else if (runId.value) {
      run.value = await request(`/projects/${projectId}/full-auto/${runId.value}`);
    } else {
      run.value = null;
      rows.value = await request(`/projects/${projectId}/full-auto`) || [];
    }
  } catch (err) {
    if (!runId.value && !jobId.value) rows.value = [];
    if (!quiet) ElMessage.error(err.message || '没有读到全流程');
  } finally {
    loading.value = false;
  }
}
async function stopRun() {
  if (!run.value?.id) return;
  try {
    const path = run.value.source === 'job'
      ? `/projects/${route.params.id}/full-auto/jobs/${run.value.id}/stop`
      : `/projects/${route.params.id}/full-auto/${run.value.id}/stop`;
    await request(path, { method: 'post' });
    await load();
    ElMessage.info('已停止全流程');
  } catch (err) {
    ElMessage.error(err.message || '没有停止');
  }
}

watch(kindFilter, () => { page.value = 1; });
watch(shownRows, list => {
  const max = Math.max(1, Math.ceil(list.length / pageSize.value) || 1);
  if (page.value > max) page.value = max;
});
watch([ runId, jobId ], () => {
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
.cartoon-flow-page.cartoon-module:not(:has(.cartoon-flow-detail)) {
  flex: 1 1 0;
  height: 100%;
  min-height: 0;
  margin-bottom: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.cartoon-flow__list {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cartoon-flow__table {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.cartoon-flow__list > .cartoon-pager {
  flex: none;
  margin-top: 12px;
}
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
.cartoon-flow__fault {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  line-height: 1.6;
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
.cartoon-flow__kinds {
  align-self: flex-start;
  margin: 0 0 12px;
}
.cartoon-flow__canvas {
  width: 100%;
  min-width: 0;
  max-height: 280px;
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(47, 138, 91, .16);
  border-radius: 10px;
  margin-bottom: 12px;
}
.cartoon-flow-detail .cartoon-flow__canvas {
  flex: 0 0 320px;
  height: 320px;
  max-height: 320px;
}
.cartoon-flow-detail .cartoon-flow__canvas :deep(svg) {
  max-width: none;
}
.cartoon-pager {
  justify-content: flex-end;
}
</style>
