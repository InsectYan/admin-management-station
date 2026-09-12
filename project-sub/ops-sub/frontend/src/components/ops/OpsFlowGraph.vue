<template>
  <div class="ops-antv-forest">
    <div ref="containerRef" class="ops-antv-forest__canvas" />
  </div>
</template>

<script setup>
import {
  onBeforeUnmount, onMounted, ref, watch,
} from 'vue';
import { Graph } from '@antv/x6';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
});

const emit = defineEmits(['select-node', 'move-node', 'connect-edge']);

const containerRef = ref(null);
let graph = null;
let applying = false;

const NODE_COLORS = {
  start: { fill: 'rgba(109,138,130,.18)', stroke: '#6D8A82' },
  end: { fill: 'rgba(109,138,130,.18)', stroke: '#6D8A82' },
  page: { fill: 'rgba(47,138,91,.16)', stroke: '#2F8A5B' },
  api: { fill: 'rgba(91,168,124,.18)', stroke: '#5BA87C' },
  action: { fill: 'rgba(109,138,130,.14)', stroke: '#6D8A82' },
  decision: { fill: 'rgba(230,162,60,.16)', stroke: '#E6A23C' },
};

const EDGE_COLORS = {
  next: '#6D8A82',
  success: '#2F8A5B',
  fail: '#F56C6C',
  branch: '#E6A23C',
};

function nodeShape(type) {
  return type === 'decision' ? 'polygon' : 'rect';
}

function toGraphNodes() {
  return props.nodes.map((node) => {
    const color = NODE_COLORS[node.type] || NODE_COLORS.action;
    const width = node.type === 'decision' ? 128 : 148;
    const height = node.type === 'decision' ? 72 : 48;
    return {
      id: node.id,
      shape: nodeShape(node.type),
      x: Number(node.x) || 80,
      y: Number(node.y) || 120,
      width,
      height,
      label: node.name || nodeTypeFallback(node.type),
      attrs: {
        body: {
          fill: color.fill,
          stroke: color.stroke,
          strokeWidth: 1.5,
          rx: node.type === 'decision' ? 0 : 8,
          ry: node.type === 'decision' ? 0 : 8,
          refPoints: node.type === 'decision' ? '0,10 10,0 20,10 10,20' : undefined,
        },
        label: {
          fill: '#1F3D2C',
          fontSize: 12,
          fontWeight: 600,
        },
      },
      ports: {
        groups: {
          top: { position: 'top', attrs: { circle: { r: 4, magnet: true, stroke: color.stroke, fill: '#fff' } } },
          right: { position: 'right', attrs: { circle: { r: 4, magnet: true, stroke: color.stroke, fill: '#fff' } } },
          bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: color.stroke, fill: '#fff' } } },
          left: { position: 'left', attrs: { circle: { r: 4, magnet: true, stroke: color.stroke, fill: '#fff' } } },
        },
        items: [
          { id: 'top', group: 'top' },
          { id: 'right', group: 'right' },
          { id: 'bottom', group: 'bottom' },
          { id: 'left', group: 'left' },
        ],
      },
      data: { ...node },
    };
  });
}

function nodeTypeFallback(type) {
  return ({ start: '开始', end: '结束', page: '页面', api: '接口', action: '动作', decision: '判断' })[type] || '节点';
}

function toGraphEdges() {
  return props.edges
    .filter((edge) => edge.source && edge.target)
    .map((edge) => {
      const stroke = EDGE_COLORS[edge.type] || EDGE_COLORS.next;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        labels: edge.label ? [{ attrs: { label: { text: edge.label, fill: '#5C6B62', fontSize: 11 } } }] : [],
        attrs: {
          line: {
            stroke,
            strokeWidth: 1.5,
            targetMarker: { name: 'block', width: 8, height: 6 },
          },
        },
        router: { name: 'manhattan' },
        connector: { name: 'rounded' },
        data: { ...edge },
      };
    });
}

function renderGraph() {
  if (!graph) return;
  applying = true;
  graph.fromJSON({
    nodes: toGraphNodes(),
    edges: toGraphEdges(),
  });
  applying = false;
}

function bindEvents() {
  graph.on('node:click', ({ node }) => {
    emit('select-node', node.getData() || { id: node.id, name: node.getLabel() });
  });
  graph.on('blank:click', () => {
    emit('select-node', null);
  });
  graph.on('node:moved', ({ node }) => {
    if (applying) return;
    const pos = node.position();
    emit('move-node', { id: node.id, x: Math.round(pos.x), y: Math.round(pos.y) });
  });
  graph.on('edge:connected', ({ edge }) => {
    if (applying) return;
    const source = edge.getSourceCellId();
    const target = edge.getTargetCellId();
    if (!source || !target || source === target) {
      graph.removeEdge(edge);
      return;
    }
    emit('connect-edge', {
      id: edge.id || `e-${Date.now()}`,
      source,
      target,
      label: '',
      type: 'next',
    });
  });
}

onMounted(() => {
  graph = new Graph({
    container: containerRef.value,
    autoResize: true,
    background: { color: 'transparent' },
    grid: {
      visible: true,
      type: 'dot',
      args: { color: 'rgba(47,138,91,0.18)', thickness: 1 },
    },
    panning: true,
    mousewheel: { enabled: true, modifiers: [ 'ctrl', 'meta' ] },
    connecting: {
      snap: true,
      allowBlank: false,
      allowLoop: false,
      allowNode: false,
      allowEdge: false,
      highlight: true,
      router: 'manhattan',
      connector: { name: 'rounded' },
      createEdge() {
        return graph.createEdge({
          attrs: {
            line: {
              stroke: '#6D8A82',
              strokeWidth: 1.5,
              targetMarker: { name: 'block', width: 8, height: 6 },
            },
          },
        });
      },
    },
    highlighting: {
      magnetAvailable: {
        name: 'stroke',
        args: { padding: 3, attrs: { stroke: '#2F8A5B' } },
      },
    },
  });
  bindEvents();
  renderGraph();
});

watch(
  () => JSON.stringify({
    nodes: props.nodes.map((n) => ({ id: n.id, name: n.name, type: n.type })),
    edges: props.edges.map((e) => ({
      id: e.id, source: e.source, target: e.target, label: e.label, type: e.type,
    })),
  }),
  () => renderGraph(),
);

onBeforeUnmount(() => {
  graph?.dispose();
  graph = null;
});
</script>

<style scoped>
.ops-antv-forest {
  flex: 1;
  min-height: 0;
  height: 100%;
  background: rgba(255, 255, 255, 0.28);
}

.ops-antv-forest__canvas {
  width: 100%;
  height: 100%;
  min-height: 420px;
}
</style>
