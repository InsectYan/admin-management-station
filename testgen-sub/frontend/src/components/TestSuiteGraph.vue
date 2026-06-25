<template>
  <div ref="containerRef" class="testgen-graph" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { Graph } from '@antv/g6';

const props = defineProps({
  testCases: { type: Array, default: () => [] },
});

const containerRef = ref(null);
let graph = null;

function priorityFill(priority) {
  const map = { high: '#fde2e2', medium: '#fdf6ec', low: '#ecf5ff' };
  return map[priority] || '#f5f7fa';
}

function convertCasesToGraph(cases) {
  const nodes = cases.map((tc) => ({
    id: String(tc.case_id ?? tc.id),
    data: {
      label: tc.title || tc.case_id,
      module: tc.module,
    },
    style: {
      fill: priorityFill(tc.priority),
      stroke: '#409eff',
      radius: 4,
      labelText: tc.title || tc.case_id,
      labelFontSize: 11,
    },
  }));

  const edges = [];
  const byModule = {};
  cases.forEach((tc) => {
    const key = tc.module || 'default';
    if (!byModule[key]) byModule[key] = [];
    byModule[key].push(String(tc.case_id ?? tc.id));
  });
  Object.values(byModule).forEach((ids) => {
    for (let i = 1; i < ids.length; i += 1) {
      edges.push({ source: ids[i - 1], target: ids[i] });
    }
  });

  return { nodes, edges };
}

function renderGraph() {
  if (!graph) return;
  const data = convertCasesToGraph(props.testCases);
  graph.setData(data);
  graph.render();
}

onMounted(() => {
  graph = new Graph({
    container: containerRef.value,
    autoFit: 'view',
    layout: {
      type: 'dagre',
      rankdir: 'TB',
      nodesep: 40,
      ranksep: 60,
    },
    node: {
      type: 'rect',
      style: { size: [140, 36] },
    },
    edge: {
      type: 'polyline',
      style: { stroke: '#c0c4cc' },
    },
    behaviors: ['drag-element', 'zoom-canvas', 'drag-canvas'],
  });

  if (props.testCases.length) {
    renderGraph();
  } else {
    graph.setData({
      nodes: [{
        id: 'empty',
        data: { label: '暂无用例数据' },
        style: {
          fill: '#f5f7fa',
          stroke: '#dcdfe6',
          labelText: '暂无用例数据',
        },
      }],
    });
    graph.render();
  }
});

onUnmounted(() => {
  graph?.destroy();
  graph = null;
});

watch(
  () => props.testCases,
  () => renderGraph(),
  { deep: true },
);
</script>
