<template>
  <div class="novel-relation-graph">
    <div v-if="!readonly" class="novel-relation-graph__toolbar">
      <el-select
        v-model="draft.source"
        placeholder="角色 A"
        clearable
        filterable
        style="width: 140px"
      >
        <el-option
          v-for="c in characters"
          :key="c.id"
          :label="c.name || '未命名'"
          :value="c.id"
        />
      </el-select>
      <el-select
        v-model="draft.target"
        placeholder="角色 B"
        clearable
        filterable
        style="width: 140px"
      >
        <el-option
          v-for="c in characters"
          :key="c.id"
          :label="c.name || '未命名'"
          :value="c.id"
        />
      </el-select>
      <el-select v-model="draft.relation" style="width: 110px">
        <el-option
          v-for="r in CHARACTER_RELATION_OPTIONS"
          :key="r.value"
          :label="r.label"
          :value="r.value"
        />
      </el-select>
      <el-input
        v-model="draft.label"
        placeholder="关系说明（可选）"
        style="width: 160px"
        maxlength="30"
      />
      <el-button size="small" class="novel-wood-button" :disabled="!canAddEdge" @click="addEdge">
        添加关系
      </el-button>
    </div>

    <div ref="containerRef" class="novel-relation-graph__canvas" />

    <div v-if="edges.length" class="novel-relation-graph__list">
      <div v-for="edge in edges" :key="edge.id" class="novel-relation-graph__edge">
        <span>{{ edgeLabel(edge) }}</span>
        <el-button v-if="!readonly" link type="danger" @click="removeEdge(edge.id)">删除</el-button>
      </div>
    </div>
    <p v-else class="novel-relation-graph__empty-hint">
      {{ readonly ? '暂无人物关系' : '添加至少两个角色后，可在此建立关系连线' }}
    </p>
  </div>
</template>

<script setup>
import {
  computed, onMounted, onUnmounted, reactive, ref, watch,
} from 'vue';
import { Graph } from '@antv/g6';
import {
  CHARACTER_RELATION_OPTIONS,
  createCharacterEdge,
} from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  characters: { type: Array, required: true },
  edges: { type: Array, required: true },
  readonly: { type: Boolean, default: false },
});

const emit = defineEmits(['update:edges', 'change']);

const containerRef = ref(null);
const draft = reactive({
  source: '',
  target: '',
  relation: 'ally',
  label: '',
});

let graph = null;

const canAddEdge = computed(() => {
  if (!draft.source || !draft.target || draft.source === draft.target) return false;
  return !props.edges.some(
    (e) => (e.source === draft.source && e.target === draft.target)
      || (e.source === draft.target && e.target === draft.source),
  );
});

function roleNodeStyle(role) {
  if (role === 'main') {
    return { fill: 'rgba(61,107,79,.18)', stroke: '#3D6B4F' };
  }
  if (role === 'villain') {
    return { fill: 'rgba(184,92,92,.12)', stroke: '#B85C5C' };
  }
  return { fill: 'rgba(109,138,130,.14)', stroke: '#6D8A82' };
}

function relationStroke(relation) {
  const map = {
    ally: '#3D6B4F',
    enemy: '#B85C5C',
    mentor: '#6D8A82',
    family: '#4F8463',
    love: '#B8953A',
  };
  return map[relation] || '#6D8A82';
}

function relationLabel(relation) {
  return CHARACTER_RELATION_OPTIONS.find((r) => r.value === relation)?.label || relation;
}

function characterName(id) {
  return props.characters.find((c) => c.id === id)?.name || '未命名';
}

function edgeLabel(edge) {
  const type = relationLabel(edge.relation);
  const extra = edge.label ? ` · ${edge.label}` : '';
  return `${characterName(edge.source)} → ${characterName(edge.target)}（${type}${extra}）`;
}

function toGraphData() {
  const nodes = props.characters.map((c) => ({
    id: c.id,
    data: { label: c.name || '未命名', role: c.role },
    style: {
      ...roleNodeStyle(c.role),
      size: 44,
      labelText: c.name || '未命名',
      labelFontSize: 11,
      labelFill: '#2A3A30',
    },
  }));

  const edges = props.edges
    .filter((e) => e.source && e.target)
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      data: { relation: e.relation },
      style: {
        stroke: relationStroke(e.relation),
        lineWidth: e.relation === 'enemy' ? 2.5 : 1.5,
        labelText: e.label || relationLabel(e.relation),
        labelFontSize: 10,
        labelFill: '#5C6B62',
        endArrow: true,
      },
    }));

  return { nodes, edges };
}

function renderGraph() {
  if (!graph) return;
  const data = toGraphData();
  if (!data.nodes.length) {
    graph.setData({
      nodes: [{
        id: 'empty',
        data: { label: '暂无角色' },
        style: {
          fill: '#F0F4F1',
          stroke: '#C5D4CA',
          size: 36,
          labelText: '请先添加角色',
          labelFontSize: 12,
        },
      }],
      edges: [],
    });
  } else {
    graph.setData(data);
  }
  graph.render();
}

function syncEdges(next) {
  emit('update:edges', next);
  emit('change');
}

function addEdge() {
  if (!canAddEdge.value) return;
  syncEdges([
    ...props.edges,
    createCharacterEdge({
      source: draft.source,
      target: draft.target,
      relation: draft.relation,
      label: draft.label.trim(),
    }),
  ]);
  draft.source = '';
  draft.target = '';
  draft.label = '';
}

function removeEdge(id) {
  syncEdges(props.edges.filter((e) => e.id !== id));
}

onMounted(() => {
  graph = new Graph({
    container: containerRef.value,
    autoFit: 'view',
    padding: 24,
    layout: props.characters.length > 1
      ? { type: 'circular', radius: 120 }
      : undefined,
    node: {
      type: 'circle',
    },
    edge: {
      type: 'line',
    },
    behaviors: ['drag-element', 'zoom-canvas', 'drag-canvas'],
  });
  renderGraph();
});

onUnmounted(() => {
  graph?.destroy();
  graph = null;
});

watch(
  () => [props.characters, props.edges],
  () => renderGraph(),
  { deep: true },
);
</script>

<style scoped>
.novel-relation-graph {
  margin-top: 16px;
  padding-top: 16px;
  border-top: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
}

.novel-relation-graph__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.novel-relation-graph__canvas {
  height: 280px;
  border-radius: var(--novel-radius-base);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  background: var(--novel-color-mist, #F0F4F1);
}

.novel-relation-graph__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.novel-relation-graph__edge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--novel-radius-sm);
  background: var(--novel-color-surface, #FBFCFA);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  font-size: 13px;
  color: var(--novel-color-text-secondary, #5C6B62);
}

.novel-relation-graph__empty-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--novel-color-text-muted, #8A968E);
}
</style>
