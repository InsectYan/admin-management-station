<template>
  <div ref="containerRef" class="testgen-canvas" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { Graph } from '@antv/x6';

const props = defineProps({
  module: { type: String, default: '' },
  testTypes: { type: Array, default: () => [] },
  documentTitle: { type: String, default: '关联文档' },
  progress: { type: Object, default: () => ({}) },
});

const containerRef = ref(null);
let graph = null;

const PHASES = ['analyze', 'functional', 'edge', 'review'];
const PHASE_LABELS = {
  analyze: '需求分析',
  functional: '功能用例',
  edge: '边界用例',
  review: '合规审查',
};

function buildGraph() {
  if (!graph) return;

  graph.clearCells();

  const moduleLabel = props.module || '业务模块';
  const docLabel = props.documentTitle || '关联文档';
  const types = props.testTypes.length ? props.testTypes : ['功能测试'];

  graph.addNode({
    id: 'doc',
    x: 40,
    y: 120,
    width: 120,
    height: 48,
    label: docLabel,
    attrs: {
      body: { fill: '#ecf5ff', stroke: '#409eff', rx: 6, ry: 6 },
      label: { fontSize: 12 },
    },
  });

  graph.addNode({
    id: 'module',
    x: 220,
    y: 120,
    width: 120,
    height: 48,
    label: moduleLabel,
    attrs: {
      body: { fill: '#f0f9eb', stroke: '#67c23a', rx: 6, ry: 6 },
      label: { fontSize: 12 },
    },
  });

  graph.addEdge({
    source: 'doc',
    target: 'module',
    attrs: { line: { stroke: '#909399' } },
  });

  types.forEach((type, i) => {
    const id = `type-${i}`;
    graph.addNode({
      id,
      x: 380,
      y: 60 + i * 56,
      width: 100,
      height: 40,
      label: type,
      attrs: {
        body: { fill: '#fdf6ec', stroke: '#e6a23c', rx: 4, ry: 4 },
        label: { fontSize: 11 },
      },
    });
    graph.addEdge({
      source: 'module',
      target: id,
      attrs: { line: { stroke: '#c0c4cc' } },
    });
  });

  PHASES.forEach((phase, i) => {
    const pct = props.progress?.[phase] ?? 0;
    const done = pct >= 100;
    graph.addNode({
      id: phase,
      x: 540 + i * 130,
      y: 120,
      width: 110,
      height: 48,
      label: `${PHASE_LABELS[phase]}\n${pct}%`,
      attrs: {
        body: {
          fill: done ? '#67c23a' : '#e4e7ed',
          stroke: done ? '#529b2e' : '#909399',
          rx: 6,
          ry: 6,
        },
        label: { fontSize: 11, fill: done ? '#fff' : '#303133' },
      },
    });
    if (i > 0) {
      graph.addEdge({
        source: PHASES[i - 1],
        target: phase,
        attrs: { line: { stroke: '#909399' } },
      });
    }
  });
}

onMounted(() => {
  graph = new Graph({
    container: containerRef.value,
    autoResize: true,
    panning: true,
    mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
    background: { color: '#fafafa' },
    grid: { visible: true, type: 'dot', args: { color: '#e4e7ed', thickness: 1 } },
  });
  buildGraph();
});

onUnmounted(() => {
  graph?.dispose();
  graph = null;
});

watch(
  () => [props.module, props.testTypes, props.documentTitle, props.progress],
  () => buildGraph(),
  { deep: true },
);
</script>
