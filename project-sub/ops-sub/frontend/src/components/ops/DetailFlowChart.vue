<template>
  <div class="ops-flow">
    <div class="ops-flow__toolbar">
      <el-select v-model="activeKey" placeholder="选择功能流程" style="width: 220px">
        <el-option
          v-for="flow in flows"
          :key="flow.key"
          :label="flow.key === 'overview' ? `总览 · ${flow.name}` : flow.name"
          :value="flow.key"
        />
      </el-select>
      <template v-if="!readonly">
        <el-button size="small" @click="addFlow">新增流程</el-button>
        <el-button size="small" :disabled="!current" @click="renameFlow">重命名</el-button>
        <el-button size="small" type="danger" plain :disabled="flows.length <= 1" @click="removeFlow">
          删除流程
        </el-button>
        <el-divider direction="vertical" />
        <el-select v-model="draftType" size="small" style="width: 120px">
          <el-option
            v-for="item in NODE_TYPE_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button size="small" type="primary" :disabled="!current" @click="addNode">添加节点</el-button>
        <el-divider direction="vertical" />
        <el-button size="small" :disabled="!canUndo" @click="undo">撤销</el-button>
        <el-button size="small" :disabled="!canRedo" @click="redo">重做</el-button>
        <el-dropdown :disabled="!current" @command="onAlign">
          <el-button size="small">对齐</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="tidy">按行整理</el-dropdown-item>
              <el-dropdown-item command="left">左对齐</el-dropdown-item>
              <el-dropdown-item command="top">顶对齐</el-dropdown-item>
              <el-dropdown-item command="hcenter">水平居中</el-dropdown-item>
              <el-dropdown-item command="vcenter">垂直居中</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
      <el-button size="small" :disabled="!current" @click="exportPng">导出 PNG</el-button>
      <span class="ops-flow__hint">{{ readonly ? '可拖动节点查看布局，不会保存；可导出 PNG。' : '拖拽节点调整位置；Ctrl+Z 撤销，Ctrl+Y 重做。' }}</span>
      <div class="ops-flow__legend">
        <span
          v-for="item in NODE_LEGEND"
          :key="item.value"
          class="ops-flow__swatch"
        >
          <i :style="{ background: NODE_COLORS[item.value].stroke }" />
          {{ item.label }}
        </span>
        <span
          v-for="item in SEVERITY_LEGEND"
          :key="`sev-${item.value}`"
          class="ops-flow__swatch"
        >
          <i :style="{ background: SEVERITY_COLORS[item.value].stroke }" />
          {{ item.label }}
        </span>
      </div>
    </div>

    <div v-if="current" class="ops-flow__body">
      <OpsFlowGraph
        ref="graphRef"
        :nodes="current.nodes"
        :edges="current.edges"
        :readonly="readonly"
        @select-node="selected = $event"
        @move-node="onMoveNode"
        @connect-edge="onConnectEdge"
      />
      <aside class="ops-flow__side">
        <h4>节点详情</h4>
        <template v-if="selectedNode">
          <el-form label-position="top" size="small">
            <el-form-item label="名称">
              <el-input
                :model-value="selectedNode.name"
                :disabled="readonly"
                @change="(value) => patchSelected({ name: value })"
              />
            </el-form-item>
            <el-form-item label="类型">
              <el-select
                :model-value="selectedNode.type"
                :disabled="readonly"
                @change="(value) => patchSelected({ type: value })"
              >
                <el-option
                  v-for="item in NODE_TYPE_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="标注">
              <el-select
                :model-value="selectedNode.severity || ''"
                :disabled="readonly"
                @change="(value) => patchSelected({ severity: value })"
              >
                <el-option
                  v-for="item in NODE_SEVERITY_OPTIONS"
                  :key="item.value || 'none'"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="说明">
              <el-input
                :model-value="selectedNode.description"
                type="textarea"
                :rows="3"
                :disabled="readonly"
                placeholder="该节点的特点：入口、skill、围栏、回包、对端"
                @change="(value) => patchSelected({ description: value })"
              />
            </el-form-item>
            <el-form-item v-if="selectedNode.severity" label="风险说明">
              <el-input
                :model-value="selectedNode.risk_note"
                type="textarea"
                :rows="3"
                :disabled="readonly"
                placeholder="为什么是风险/警告，会导致什么问题"
                @change="(value) => patchSelected({ risk_note: value })"
              />
            </el-form-item>
            <el-button v-if="!readonly" type="danger" plain size="small" @click="removeSelectedNode">删除节点</el-button>
          </el-form>
        </template>
        <p v-else class="ops-flow__empty">点击画布中的节点查看上下游说明</p>
        <el-divider />
        <h4>连线</h4>
        <div v-for="edge in current.edges" :key="edge.id" class="ops-flow__edge">
          <span>{{ edgeName(edge) }}</span>
          <el-select
            :model-value="edge.type"
            size="small"
            style="width: 96px"
            :disabled="readonly"
            @change="(value) => patchEdge(edge.id, { type: value })"
          >
            <el-option
              v-for="item in EDGE_TYPE_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-input
            :model-value="edge.label"
            size="small"
            placeholder="标签"
            style="width: 88px"
            :disabled="readonly"
            @change="(value) => patchEdge(edge.id, { label: value })"
          />
          <el-button v-if="!readonly" link type="danger" @click="removeEdge(edge.id)">删</el-button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import OpsFlowGraph from './OpsFlowGraph.vue';
import {
  EDGE_TYPE_OPTIONS,
  NODE_SEVERITY_OPTIONS,
  NODE_TYPE_OPTIONS,
  emptyFlow,
  nodeTypeLabel,
} from '../../utils/opsMeta.js';
import { NODE_COLORS, NODE_LEGEND, SEVERITY_COLORS, SEVERITY_LEGEND } from '../../utils/flowChartTheme.js';

const props = defineProps({
  flows: { type: Array, required: true },
  readonly: { type: Boolean, default: false },
  activeKey: { type: String, default: '' },
  projectName: { type: String, default: '' },
  projectId: { type: [ String, Number ], default: '' },
});

const emit = defineEmits(['update:flows', 'update:activeKey']);

const innerKey = ref('');
const selected = ref(null);
const draftType = ref('page');
const graphRef = ref(null);
const undoStack = ref([]);
const redoStack = ref([]);
let applyingHistory = false;

const canUndo = computed(() => !props.readonly && undoStack.value.length > 0);
const canRedo = computed(() => !props.readonly && redoStack.value.length > 0);

function cloneFlows(list = props.flows) {
  return JSON.parse(JSON.stringify(list || []));
}

function pushHistory() {
  if (props.readonly || applyingHistory) return;
  undoStack.value.push(cloneFlows());
  if (undoStack.value.length > 50) undoStack.value.shift();
  redoStack.value = [];
}

function commit(mutator) {
  if (props.readonly) return;
  pushHistory();
  const next = cloneFlows();
  mutator(next);
  applyingHistory = true;
  emit('update:flows', next);
  queueMicrotask(() => { applyingHistory = false; });
}

function currentOf(list) {
  return list.find((flow) => flow.key === activeKey.value) || list[0] || null;
}

function undo() {
  if (!canUndo.value) return;
  redoStack.value.push(cloneFlows());
  applyingHistory = true;
  emit('update:flows', undoStack.value.pop());
  queueMicrotask(() => { applyingHistory = false; });
}

function redo() {
  if (!canRedo.value) return;
  undoStack.value.push(cloneFlows());
  applyingHistory = true;
  emit('update:flows', redoStack.value.pop());
  queueMicrotask(() => { applyingHistory = false; });
}

const activeKey = computed({
  get: () => props.activeKey || innerKey.value,
  set: (value) => {
    innerKey.value = value;
    emit('update:activeKey', value);
  },
});

const current = computed(() => props.flows.find((flow) => flow.key === activeKey.value) || props.flows[0] || null);

const selectedNode = computed(() => {
  if (!current.value || !selected.value) return null;
  return current.value.nodes.find((node) => node.id === selected.value.id) || null;
});

watch(
  () => props.activeKey,
  (value) => {
    if (value) innerKey.value = value;
  },
  { immediate: true },
);

watch(
  () => props.flows.map((flow) => flow.key).join(','),
  () => {
    if (!props.flows.some((flow) => flow.key === activeKey.value)) {
      activeKey.value = props.flows[0]?.key || '';
    }
  },
  { immediate: true },
);

function addFlow() {
  const flow = emptyFlow();
  commit((list) => list.push(flow));
  activeKey.value = flow.key;
}

async function renameFlow() {
  if (!current.value) return;
  const { value } = await ElMessageBox.prompt('流程名称', '重命名功能流程', {
    inputValue: current.value.name,
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  });
  commit((list) => {
    const flow = currentOf(list);
    if (flow) flow.name = value;
  });
}

function removeFlow() {
  const key = current.value?.key;
  commit((list) => {
    const next = list.filter((flow) => flow.key !== key);
    list.splice(0, list.length, ...next);
  });
}

function addNode() {
  if (!current.value) return;
  const id = `n-${Date.now()}`;
  commit((list) => {
    const flow = currentOf(list);
    if (!flow) return;
    flow.nodes.push({
      id,
      name: nodeTypeLabel(draftType.value),
      type: draftType.value,
      severity: '',
      description: '',
      risk_note: '',
      x: 160 + (flow.nodes.length % 4) * 170,
      y: 80 + Math.floor(flow.nodes.length / 4) * 110,
    });
  });
  selected.value = { id };
}

function onMoveNode({ id, x, y }) {
  if (props.readonly) return;
  commit((list) => {
    const node = currentOf(list)?.nodes.find((item) => item.id === id);
    if (node) {
      node.x = x;
      node.y = y;
    }
  });
}

function onConnectEdge(edge) {
  if (props.readonly || !current.value) return;
  const exists = current.value.edges.some(
    (item) => item.source === edge.source && item.target === edge.target,
  );
  if (exists) return;
  commit((list) => {
    currentOf(list)?.edges.push(edge);
  });
}

function removeSelectedNode() {
  if (!current.value || !selectedNode.value) return;
  const id = selectedNode.value.id;
  commit((list) => {
    const flow = currentOf(list);
    if (!flow) return;
    flow.nodes = flow.nodes.filter((node) => node.id !== id);
    flow.edges = flow.edges.filter((edge) => edge.source !== id && edge.target !== id);
  });
  selected.value = null;
}

function removeEdge(id) {
  commit((list) => {
    const flow = currentOf(list);
    if (!flow) return;
    flow.edges = flow.edges.filter((edge) => edge.id !== id);
  });
}

function patchSelected(patch) {
  const id = selectedNode.value?.id;
  if (!id) return;
  commit((list) => {
    const node = currentOf(list)?.nodes.find((item) => item.id === id);
    if (!node) return;
    Object.assign(node, patch);
  });
}

function patchEdge(id, patch) {
  commit((list) => {
    const edge = currentOf(list)?.edges.find((item) => item.id === id);
    if (edge) Object.assign(edge, patch);
  });
}

function onAlign(command) {
  commit((list) => {
    const flow = currentOf(list);
    if (!flow?.nodes.length) return;
    const GRID = 20;
    const nodes = flow.nodes;
    if (command === 'left') {
      const x = Math.min(...nodes.map((n) => Number(n.x) || 0));
      nodes.forEach((n) => { n.x = x; });
      return;
    }
    if (command === 'top') {
      const y = Math.min(...nodes.map((n) => Number(n.y) || 0));
      nodes.forEach((n) => { n.y = y; });
      return;
    }
    if (command === 'hcenter') {
      const mid = nodes.reduce((sum, n) => sum + (Number(n.x) || 0), 0) / nodes.length;
      nodes.forEach((n) => { n.x = Math.round(mid / GRID) * GRID; });
      return;
    }
    if (command === 'vcenter') {
      const mid = nodes.reduce((sum, n) => sum + (Number(n.y) || 0), 0) / nodes.length;
      nodes.forEach((n) => { n.y = Math.round(mid / GRID) * GRID; });
      return;
    }
    const sorted = [ ...nodes ].sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const BAND = 40;
    let bandY = null;
    let band = [];
    const flush = () => {
      if (!band.length) return;
      const y = Math.round((Number(band[0].y) || 0) / GRID) * GRID;
      band.sort((a, b) => a.x - b.x);
      band.forEach((n, i) => {
        n.x = 80 + i * 170;
        n.y = y;
      });
    };
    for (const n of sorted) {
      if (bandY == null || Math.abs((Number(n.y) || 0) - bandY) <= BAND) {
        if (bandY == null) bandY = Number(n.y) || 0;
        band.push(n);
      } else {
        flush();
        band = [ n ];
        bandY = Number(n.y) || 0;
      }
    }
    flush();
  });
}

async function exportPng() {
  const key = current.value?.key || 'flow';
  const base = (props.projectName || 'ops-project').replace(/[\\/:*?"<>|]/g, '_');
  try {
    await graphRef.value?.exportPng(`${base}-${key}.png`);
    ElMessage.success('已导出 PNG');
  } catch (err) {
    ElMessage.error(err.message || '导出失败');
  }
}

function onHotkey(ev) {
  if (props.readonly) return;
  const tag = String(ev.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  const key = ev.key.toLowerCase();
  if ((ev.ctrlKey || ev.metaKey) && key === 'z') {
    ev.preventDefault();
    if (ev.shiftKey) redo();
    else undo();
  } else if ((ev.ctrlKey || ev.metaKey) && key === 'y') {
    ev.preventDefault();
    redo();
  }
}

onMounted(() => window.addEventListener('keydown', onHotkey));
onBeforeUnmount(() => window.removeEventListener('keydown', onHotkey));

watch(
  () => props.projectId,
  () => {
    undoStack.value = [];
    redoStack.value = [];
  },
);

function edgeName(edge) {
  const source = current.value?.nodes.find((node) => node.id === edge.source)?.name || edge.source;
  const target = current.value?.nodes.find((node) => node.id === edge.target)?.name || edge.target;
  return `${source} → ${target}`;
}
</script>

<style scoped>
.ops-flow {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ops-flow__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: var(--ops-border-subtle);
  background: var(--ops-color-surface);
}

.ops-flow__hint {
  font-size: 12px;
  color: var(--ops-color-text-muted);
}

.ops-flow__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  width: 100%;
  margin-top: 2px;
}

.ops-flow__swatch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--ops-color-text-secondary, #5c6b62);
}

.ops-flow__swatch i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.ops-flow__body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.ops-flow__side {
  width: 280px;
  flex-shrink: 0;
  border-left: var(--ops-border-subtle);
  background: var(--ops-color-surface-elevated);
  padding: 12px 14px;
  overflow: auto;
}

.ops-flow__side h4 {
  margin: 0 0 10px;
  color: var(--ops-color-deep);
  font-size: 14px;
}

.ops-flow__empty {
  margin: 0;
  color: var(--ops-color-text-muted);
  font-size: 13px;
}

.ops-flow__edge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--ops-color-text);
}
</style>
