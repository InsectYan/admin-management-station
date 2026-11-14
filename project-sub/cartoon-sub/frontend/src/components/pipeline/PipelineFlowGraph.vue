<template>
  <svg
    class="pipeline-flow"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    role="img"
    aria-label="流水线图谱"
  >
    <defs>
      <pattern id="pipeline-flow-dot" width="16" height="16" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="1" fill="rgba(47,138,91,.2)" />
      </pattern>
      <marker id="pipeline-flow-next" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="#6D8A82" />
      </marker>
      <marker id="pipeline-flow-branch" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8 Z" fill="#E6A23C" />
      </marker>
    </defs>
    <rect width="100%" height="100%" fill="url(#pipeline-flow-dot)" />
    <g v-for="edge in drawnEdges" :key="edge.id">
      <path
        :d="edge.d"
        fill="none"
        :stroke="edge.color"
        stroke-width="1.5"
        :marker-end="edge.marker"
      />
      <text
        v-if="edge.label"
        :x="edge.labelX"
        :y="edge.labelY"
        class="pipeline-flow__edge"
        text-anchor="middle"
      >{{ edge.label }}</text>
    </g>
    <g
      v-for="node in nodes"
      :key="node.id"
      class="pipeline-flow__node"
      :class="{ 'is-selected': node.id === selectedId }"
      :transform="`translate(${node.x},${node.y})`"
      role="button"
      tabindex="0"
      :aria-label="`${node.name} ${node.status === 'done' ? '已完成' : '未完成'} ${lineOf(node)}`"
      @click="$emit('select', node.id)"
      @keydown.enter="$emit('select', node.id)"
    >
      <rect
        :width="box.width"
        :height="box.height"
        rx="8"
        :fill="paint(node).fill"
        :stroke="paint(node).stroke"
        :stroke-width="node.id === selectedId ? 2.5 : 1.5"
        :stroke-dasharray="node.status === 'todo' ? '5 3' : ''"
      />
      <text :x="box.width / 2" y="28" class="pipeline-flow__name" text-anchor="middle">{{ node.name }}</text>
      <text :x="box.width / 2" y="48" class="pipeline-flow__skill" text-anchor="middle">{{ lineOf(node) }}</text>
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
});
defineEmits(['select']);

const box = { width: 184, height: 68 };

const width = computed(() => {
  const right = props.nodes.reduce((max, node) => Math.max(max, Number(node.x) + box.width), 0);
  return Math.max(720, right + 32);
});
const height = computed(() => {
  const bottom = props.nodes.reduce((max, node) => Math.max(max, Number(node.y) + box.height), 0);
  return Math.max(320, bottom + 32);
});

function paint(node) {
  if (node.type === 'start' || node.type === 'end') {
    return { fill: 'rgba(109,138,130,.18)', stroke: '#6D8A82' };
  }
  if (node.status === 'todo') return { fill: 'rgba(230,162,60,.2)', stroke: '#E6A23C' };
  if (node.type === 'decision') return { fill: 'rgba(74,144,164,.16)', stroke: '#4A90A4' };
  return { fill: 'rgba(47,138,91,.16)', stroke: '#2F8A5B' };
}

function lineOf(node) {
  if (node.type === 'start') return '开始';
  if (node.type === 'end') return '结束';
  if (node.skill) return node.skill;
  if (node.runner === 'comfy') return '预检 + Comfy';
  if (node.runner === 'ffmpeg') return '本地剪辑';
  if (node.runner === 'local') return '本地';
  return node.status === 'todo' ? '未接入' : '无 Skill';
}

function byId(id) {
  return props.nodes.find(item => item.id === id);
}

function anchor(node, toward) {
  const cx = node.x + box.width / 2;
  const cy = node.y + box.height / 2;
  const tx = toward.x + box.width / 2;
  const ty = toward.y + box.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: dx >= 0 ? node.x + box.width : node.x, y: cy };
  }
  return { x: cx, y: dy >= 0 ? node.y + box.height : node.y };
}

function route(source, target) {
  const sameRow = Math.abs(source.y - target.y) < 24;
  if (sameRow) return [anchor(source, target), anchor(target, source)];
  const sameCol = Math.abs(source.x - target.x) < 24;
  const nearY = Math.abs(source.y - target.y) < box.height + 90;
  if (sameCol && nearY) return [anchor(source, target), anchor(target, source)];
  const down = target.y > source.y;
  const sx = source.x + box.width / 2;
  const tx = target.x + box.width / 2;
  const sourceOutY = down ? source.y + box.height : source.y;
  const targetInY = down ? target.y : target.y + box.height;
  const sideY = down ? sourceOutY + 16 : sourceOutY - 16;
  const laneY = down ? targetInY - 18 : targetInY + 18;
  const laneX = Math.min(source.x, target.x) - 14;
  return [
    { x: sx, y: sourceOutY },
    { x: sx, y: sideY },
    { x: laneX, y: sideY },
    { x: laneX, y: laneY },
    { x: tx, y: laneY },
    { x: tx, y: targetInY },
  ];
}

const drawnEdges = computed(() => props.edges.flatMap(edge => {
  const source = byId(edge.source);
  const target = byId(edge.target);
  if (!source || !target) return [];
  const points = route(source, target);
  const branch = edge.type === 'branch';
  const last = points[points.length - 1];
  const prev = points[points.length - 2] || last;
  const labelAt = points.length <= 2
    ? { x: (points[0].x + last.x) / 2, y: (points[0].y + last.y) / 2 - 6 }
    : { x: prev.x, y: prev.y - 8 };
  return [{
    id: edge.id,
    d: points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '),
    color: branch ? '#E6A23C' : '#6D8A82',
    marker: branch ? 'url(#pipeline-flow-branch)' : 'url(#pipeline-flow-next)',
    label: edge.label || '',
    labelX: labelAt.x,
    labelY: labelAt.y,
  }];
}));
</script>

<style scoped>
.pipeline-flow { display: block; }
.pipeline-flow__node { cursor: pointer; }
.pipeline-flow__name {
  fill: #1f3d2c;
  font-size: 14px;
  font-weight: 600;
}
.pipeline-flow__skill {
  fill: #2f8a5b;
  font-size: 11px;
}
.pipeline-flow__node.is-selected .pipeline-flow__name { fill: #1f3d2c; }
.pipeline-flow__edge {
  fill: #8a5a12;
  font-size: 11px;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 3px;
}
</style>
