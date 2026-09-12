<template>
  <div class="ops-flow">
    <div class="ops-flow__toolbar">
      <el-select v-model="activeKey" placeholder="选择功能流程" style="width: 220px">
        <el-option
          v-for="flow in flows"
          :key="flow.key"
          :label="flow.name"
          :value="flow.key"
        />
      </el-select>
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
      <span class="ops-flow__hint">拖拽节点调整位置；从锚点拉出连线表示上下游。</span>
    </div>

    <div v-if="current" class="ops-flow__body">
      <OpsFlowGraph
        :nodes="current.nodes"
        :edges="current.edges"
        @select-node="selected = $event"
        @move-node="onMoveNode"
        @connect-edge="onConnectEdge"
      />
      <aside class="ops-flow__side">
        <h4>节点详情</h4>
        <template v-if="selectedNode">
          <el-form label-position="top" size="small">
            <el-form-item label="名称">
              <el-input v-model="selectedNode.name" />
            </el-form-item>
            <el-form-item label="类型">
              <el-select v-model="selectedNode.type">
                <el-option
                  v-for="item in NODE_TYPE_OPTIONS"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="说明">
              <el-input v-model="selectedNode.description" type="textarea" :rows="4" />
            </el-form-item>
            <el-button type="danger" plain size="small" @click="removeSelectedNode">删除节点</el-button>
          </el-form>
        </template>
        <p v-else class="ops-flow__empty">点击画布中的节点查看上下游说明</p>
        <el-divider />
        <h4>连线</h4>
        <div v-for="edge in current.edges" :key="edge.id" class="ops-flow__edge">
          <span>{{ edgeName(edge) }}</span>
          <el-select v-model="edge.type" size="small" style="width: 96px">
            <el-option
              v-for="item in EDGE_TYPE_OPTIONS"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-input v-model="edge.label" size="small" placeholder="标签" style="width: 88px" />
          <el-button link type="danger" @click="removeEdge(edge.id)">删</el-button>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessageBox } from 'element-plus';
import OpsFlowGraph from './OpsFlowGraph.vue';
import {
  EDGE_TYPE_OPTIONS,
  NODE_TYPE_OPTIONS,
  emptyFlow,
  nodeTypeLabel,
} from '../../utils/opsMeta.js';

const props = defineProps({
  flows: { type: Array, required: true },
});

const emit = defineEmits(['update:flows']);

const activeKey = ref('');
const selected = ref(null);
const draftType = ref('page');

const current = computed(() => props.flows.find((flow) => flow.key === activeKey.value) || props.flows[0] || null);

const selectedNode = computed(() => {
  if (!current.value || !selected.value) return null;
  return current.value.nodes.find((node) => node.id === selected.value.id) || null;
});

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
  emit('update:flows', [...props.flows, flow]);
  activeKey.value = flow.key;
}

async function renameFlow() {
  if (!current.value) return;
  const { value } = await ElMessageBox.prompt('流程名称', '重命名功能流程', {
    inputValue: current.value.name,
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  });
  current.value.name = value;
}

function removeFlow() {
  emit('update:flows', props.flows.filter((flow) => flow.key !== current.value.key));
}

function addNode() {
  if (!current.value) return;
  const id = `n-${Date.now()}`;
  current.value.nodes.push({
    id,
    name: nodeTypeLabel(draftType.value),
    type: draftType.value,
    description: '',
    x: 160 + (current.value.nodes.length % 4) * 170,
    y: 80 + Math.floor(current.value.nodes.length / 4) * 110,
  });
  selected.value = { id };
}

function onMoveNode({ id, x, y }) {
  const node = current.value?.nodes.find((item) => item.id === id);
  if (!node) return;
  node.x = x;
  node.y = y;
}

function onConnectEdge(edge) {
  if (!current.value) return;
  const exists = current.value.edges.some(
    (item) => item.source === edge.source && item.target === edge.target,
  );
  if (exists) return;
  current.value.edges.push(edge);
}

function removeSelectedNode() {
  if (!current.value || !selectedNode.value) return;
  const id = selectedNode.value.id;
  current.value.nodes = current.value.nodes.filter((node) => node.id !== id);
  current.value.edges = current.value.edges.filter((edge) => edge.source !== id && edge.target !== id);
  selected.value = null;
}

function removeEdge(id) {
  if (!current.value) return;
  current.value.edges = current.value.edges.filter((edge) => edge.id !== id);
}

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
