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
import { EDGE_COLORS, resolveNodeColor } from '../../utils/flowChartTheme.js';

const props = defineProps({
  nodes: { type: Array, default: () => [] },
  edges: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
});

const emit = defineEmits(['select-node', 'move-node', 'connect-edge']);

const containerRef = ref(null);
let graph = null;
let applying = false;

function nodeShape(type) {
  return type === 'decision' ? 'polygon' : 'rect';
}

function toGraphNodes() {
  return props.nodes.map((node) => {
    const color = resolveNodeColor(node);
    const alert = node.severity === 'risk' || node.severity === 'warning';
    const width = node.type === 'decision' ? 128 : 148;
    const height = node.type === 'decision' ? 72 : (alert ? 52 : 48);
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
          strokeWidth: alert ? 2.4 : 1.5,
          rx: node.type === 'decision' ? 0 : 8,
          ry: node.type === 'decision' ? 0 : 8,
          refPoints: node.type === 'decision' ? '0,10 10,0 20,10 10,20' : undefined,
        },
        label: {
          fill: node.severity === 'risk'
            ? '#C45656'
            : (node.severity === 'warning' ? '#B7791F' : '#1F3D2C'),
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
  return ({
    start: '开始', end: '结束', page: '页面', api: '接口', action: '动作',
    decision: '判断',
  })[type] || '节点';
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
    interacting() {
      return {
        nodeMovable: true,
        edgeMovable: !props.readonly,
        magnetConnectable: !props.readonly,
      };
    },
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
    nodes: props.nodes.map((n) => ({
      id: n.id, name: n.name, type: n.type, severity: n.severity, risk_note: n.risk_note, x: n.x, y: n.y,
    })),
    edges: props.edges.map((e) => ({
      id: e.id, source: e.source, target: e.target, label: e.label, type: e.type,
    })),
  }),
  () => renderGraph(),
);

function exportPng(filename) {
  return new Promise((resolve, reject) => {
    const svg = containerRef.value?.querySelector('svg');
    if (!svg || !graph) {
      reject(new Error('画布未就绪'));
      return;
    }
    const bbox = graph.getContentBBox();
    const pad = 24;
    const w = Math.max(240, Math.ceil((bbox.width || 400) + pad * 2));
    const h = Math.max(160, Math.ceil((bbox.height || 240) + pad * 2));
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('viewBox', `${(bbox.x || 0) - pad} ${(bbox.y || 0) - pad} ${w} ${h}`);
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f3f8f4';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('导出失败'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 800);
        resolve();
      }, 'image/png', 0.9);
    };
    img.onerror = () => reject(new Error('导出失败'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  });
}

defineExpose({ exportPng });

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
