<template>
  <section class="cartoon-trace">
    <p v-if="loading" class="cartoon-module__hint">正在读取这次提示词记录。</p>
    <template v-else>
      <div class="cartoon-trace__legend">
        <span><i class="is-ok" />正常</span>
        <span><i class="is-error" />异常</span>
        <span><i class="is-wait" />跳过 / 未执行</span>
        <span><i class="is-branch" />分支</span>
      </div>
      <div class="cartoon-trace__canvas">
        <PipelineFlowGraph
          scope="prompt-trace"
          :nodes="graphNodes"
          :edges="graphEdges"
          :selected-id="selectedId"
          @select="focus"
        />
      </div>
      <p v-if="!traces.length" class="cartoon-module__hint">还没有这次生成的记录。流程图从发起画到结束，执行后正常或异常会标在对应节点上。</p>
      <el-tabs v-model="part">
        <el-tab-pane v-for="item in parts" :key="item.key" :label="item.label" :name="item.key" />
      </el-tabs>
      <div ref="pane" class="cartoon-trace__pane">
        <article
          v-for="node in tabNodes"
          :id="`trace-${node.id}`"
          :key="node.id"
          class="cartoon-trace__card"
          :class="[ `is-${node.status}`, { 'is-active': selectedId === node.id } ]"
        >
          <header class="cartoon-trace__head">
            <h4>{{ node.title }} · {{ statusText(node.status) }}</h4>
            <span v-if="elapsedText(node)">{{ elapsedText(node) }}</span>
            <button v-if="faultJson(node)" type="button" class="cartoon-trace__fault" @click="openDetail(node.title, '异常', faultJson(node))">查看异常</button>
          </header>
          <p>调用工具 {{ skillText(node) }}</p>
          <div>
            <span>输入</span>
            <button type="button" class="cartoon-trace__clamp" @click="openDetail(node.title, '输入', inputText(node))">{{ inputText(node) }}</button>
          </div>
          <div>
            <span>输出</span>
            <button type="button" class="cartoon-trace__clamp" @click="openDetail(node.title, '输出', outputText(node))">{{ outputText(node) }}</button>
          </div>
        </article>
      </div>
    </template>
    <el-dialog v-model="dialog.open" :title="dialog.title" width="720px" append-to-body>
      <pre class="cartoon-trace__full">{{ dialog.text || '无' }}</pre>
    </el-dialog>
  </section>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue';
import PipelineFlowGraph from './pipeline/PipelineFlowGraph.vue';
import mapData from '../data/pipelineMap.json';
import { request } from '../services/apiConfig.js';

const props = defineProps({
  shotId: { type: [ String, Number ], default: '' },
});
const parts = [
  { key: 'video', label: '视频提示词' },
  { key: 'frame_start', label: '首帧提示词' },
  { key: 'frame_end', label: '尾帧提示词' },
];
const part = ref('video');
const loading = ref(false);
const traces = ref([]);
const avMode = ref(false);
const selectedId = ref('start');
const pane = ref(null);
const dialog = reactive({ open: false, title: '', text: '' });
const promptFlow = mapData.flows.find(item => item.key === 'prompt') || { nodes: [], edges: [] };
const graphEdges = promptFlow.edges || [];
const partOf = {
  start: 'video',
  expand: 'video',
  positive: 'video',
  negative: 'video',
  av: 'video',
  avskill: 'video',
  fitness: 'video',
  frame_start: 'frame_start',
  frame_end: 'frame_end',
  phrase: 'video',
  save: 'video',
  end: 'video',
};
const titleOf = {
  expand: '单段扩写',
  positive: '视频提示词',
  negative: '负向补调',
  avskill: '封闭提示词',
  fitness: '健身收口',
  frame_start: '首帧提示词',
  frame_end: '尾帧提示词',
  save: '写回镜头',
};
const stepOrder = [ 'expand', 'positive', 'negative', 'av', 'avskill', 'fitness', 'frame_start', 'frame_end', 'phrase', 'save', 'end' ];

function titlesFor(id) {
  if (id === 'avskill') return [ 'AV 收口', '封闭提示词' ];
  if (id === 'fitness') return [ '健身收口' ];
  return titleOf[id] ? [ titleOf[id] ] : [];
}
function latestTrace(title) {
  if (!title) return null;
  return traces.value.filter(item => item.title === title).at(-1) || null;
}
function latestOf(id) {
  for (const title of titlesFor(id)) {
    const hit = latestTrace(title);
    if (hit) return hit;
  }
  return null;
}
function statusOfTrace(hit) {
  if (!hit) return '';
  if (hit.status === 'error') return 'error';
  if (hit.status === 'skip') return 'skip';
  return 'ok';
}

const flow = computed(() => {
  const started = traces.value.length > 0;
  const interrupt = latestTrace('生成中断');
  const status = { start: started ? 'ok' : 'wait' };
  const attached = {};
  Object.keys(titleOf).forEach(id => {
    const hit = latestOf(id);
    status[id] = statusOfTrace(hit) || 'wait';
    if (hit) attached[id] = hit;
  });
  const later = [ 'avskill', 'fitness', 'frame_start', 'frame_end', 'save' ].some(id => status[id] !== 'wait');
  const decisionReached = status.positive === 'ok' && (status.negative === 'ok' || status.negative === 'skip' || later);
  status.av = decisionReached ? 'ok' : 'wait';
  if (!attached.avskill && !avMode.value) status.avskill = decisionReached ? 'skip' : 'wait';
  if (!attached.fitness) {
    const after = [ 'frame_start', 'frame_end', 'save' ].some(id => status[id] !== 'wait');
    status.fitness = after ? 'skip' : 'wait';
  }
  status.phrase = status.save === 'ok' ? 'ok' : 'wait';
  status.end = status.save === 'ok' ? 'ok' : 'wait';
  const alreadyStuck = Object.values(status).includes('error');
  if (interrupt && !alreadyStuck) {
    const stuck = stepOrder.find(id => status[id] === 'wait');
    if (stuck) {
      status[stuck] = 'error';
      attached[stuck] = interrupt;
    }
  }
  return (promptFlow.nodes || []).map(node => {
    const state = status[node.id] || 'wait';
    return {
      ...node,
      status: state,
      subtitle: [ statusText(state), elapsedShort({ trace: attached[node.id] || null }) ].filter(Boolean).join(' · '),
      part: partOf[node.id] || 'video',
      title: node.name,
      trace: attached[node.id] || null,
    };
  });
});
const graphNodes = computed(() => flow.value.map(node => ({
  id: node.id,
  name: node.name,
  type: node.type,
  x: node.x,
  y: node.y,
  status: node.status,
  subtitle: node.subtitle,
})));
const tabNodes = computed(() => flow.value.filter(node => node.part === part.value));

function elapsedShort(node) {
  const ms = Number(node?.trace?.elapsed_ms);
  if (!node?.trace || !Number.isFinite(ms) || ms <= 0) return '';
  if (ms < 1000) return '不到1秒';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}秒`;
  const minute = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest ? `${minute}分${rest}秒` : `${minute}分`;
}
function elapsedText(node) {
  const label = elapsedShort(node);
  return label ? `耗时 ${label}` : '';
}
function faultJson(node) {
  if (node?.trace?.status !== 'error' && node?.status !== 'error') return '';
  const raw = String(node?.trace?.error_json || '').trim();
  const output = String(node?.trace?.output_text || '').trim();
  const source = raw || output;
  if (!source) return '';
  try { return JSON.stringify(JSON.parse(source), null, 2); } catch { return source; }
}
function statusText(status) {
  if (status === 'error') return '异常';
  if (status === 'skip') return '跳过';
  if (status === 'ok') return '正常';
  return '未执行';
}
function skillText(node) {
  if (node.trace?.skill) return node.trace.skill;
  if (node.skill) return node.skill;
  if (node.status === 'wait') return '这一步还没有调用';
  return '不走技能';
}
function inputText(node) {
  if (node.trace?.input_text) return node.trace.input_text;
  if (node.id === 'start') return '点击生成提示词';
  if (node.id === 'av') return avMode.value ? '项目已开启 AV' : '项目未开启 AV';
  if (node.id === 'phrase') return '写回前替换画面句子';
  if (node.id === 'end') return '写回镜头之后';
  return '无';
}
function outputText(node) {
  if (node.trace?.output_text) return node.trace.output_text;
  if (node.id === 'avskill' && node.status === 'skip') return '项目没开 AV，不走这一步';
  if (node.status === 'wait') return '还没执行到这一步';
  if (node.status === 'skip') return '这一步跳过';
  if (node.id === 'start') return '已从发起开始';
  if (node.id === 'av') return avMode.value ? '走封闭提示词' : '不走封闭提示词';
  if (node.id === 'phrase') return '已按词语表替换';
  if (node.id === 'end') return '这条镜头的提示词已齐';
  return '无';
}
async function load() {
  if (!props.shotId) {
    traces.value = [];
    avMode.value = false;
    return;
  }
  loading.value = true;
  try {
    const data = await request(`/shots/${props.shotId}/prompt-traces`);
    traces.value = Array.isArray(data?.list) ? data.list : [];
    avMode.value = Boolean(data?.av_mode);
    const stuck = flow.value.find(node => node.status === 'error') || flow.value.find(node => node.id === 'start');
    selectedId.value = stuck?.id || 'start';
    if (stuck?.part) part.value = stuck.part;
  } catch (err) {
    traces.value = [];
  } finally {
    loading.value = false;
  }
  await nextTick();
  if (selectedId.value) await focus(selectedId.value);
}
async function focus(id) {
  const node = flow.value.find(item => item.id === id);
  if (!node) return;
  selectedId.value = node.id;
  part.value = node.part;
  await nextTick();
  const box = pane.value;
  const card = box?.querySelector(`#trace-${node.id}`);
  if (!box || !card) return;
  box.scrollTop = Math.max(0, card.offsetTop - box.offsetTop);
}
function openDetail(title, field, text) {
  dialog.title = `${title || '技能调用'} · ${field}`;
  dialog.text = text || '';
  dialog.open = true;
}
watch(() => props.shotId, () => { load(); }, { immediate: true });
</script>

<style scoped>
.cartoon-trace {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cartoon-trace__legend {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 8px 0;
  color: #2c4336;
}
.cartoon-trace__legend span { display: inline-flex; align-items: center; gap: 6px; }
.cartoon-trace__legend i {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1.5px solid;
}
.cartoon-trace__legend .is-ok { background: rgba(47, 138, 91, .16); border-color: #2f8a5b; }
.cartoon-trace__legend .is-error { background: rgba(181, 71, 71, .16); border-color: #b54747; }
.cartoon-trace__legend .is-wait { background: rgba(138, 151, 143, .12); border-color: #8a978f; }
.cartoon-trace__legend .is-branch { background: transparent; border-color: #e6a23c; }
.cartoon-trace__canvas {
  width: 100%;
  min-width: 0;
  flex: 1 1 0;
  min-height: 220px;
  margin-bottom: 12px;
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(47, 138, 91, .16);
  border-radius: 10px;
}
.cartoon-trace > .cartoon-module__hint { flex: none; }
.cartoon-trace :deep(.el-tabs) { flex: none; }
.cartoon-trace__pane {
  position: relative;
  flex: 1 1 0;
  min-height: 180px;
  overflow: auto;
  border: 1px solid #e6ebe7;
  border-radius: 8px;
  padding: 12px;
}
.cartoon-trace__card { padding: 12px 0; border-top: 1px solid #e6ebe7; }
.cartoon-trace__card:first-child { border-top: 0; padding-top: 0; }
.cartoon-trace__card.is-ok.is-active h4 { color: #2f8a5b; }
.cartoon-trace__card.is-error h4 { color: #b54747; }
.cartoon-trace__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.cartoon-trace__head h4 { margin: 0; }
.cartoon-trace__head span { color: #5c6b62; }
.cartoon-trace__fault {
  margin-left: auto;
  border: 1px solid #b54747;
  background: #fff;
  color: #b54747;
  border-radius: 6px;
  padding: 2px 10px;
  cursor: pointer;
}
.cartoon-trace__card h4,
.cartoon-trace__card p { margin: 0 0 8px; }
.cartoon-trace__card p { color: #5c6b62; }
.cartoon-trace__card > div { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 8px; margin-top: 8px; }
.cartoon-trace__card > div > span { color: #5c6b62; line-height: 22px; }
.cartoon-trace__clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #1f3d2c;
  text-align: left;
  white-space: pre-wrap;
  cursor: pointer;
  line-height: 22px;
  max-height: 44px;
}
.cartoon-trace__full {
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
