<template>
  <div ref="chartRef" class="testgen-metrics-chart" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  metrics: { type: Array, default: () => [] },
  field: { type: String, default: 'responseTime' },
  title: { type: String, default: '响应时间 (ms)' },
});

const chartRef = ref(null);

function render() {
  const el = chartRef.value;
  if (!el) return;

  const data = props.metrics || [];
  if (!data.length) {
    el.innerHTML = '<div class="testgen-metrics-empty">暂无指标数据</div>';
    return;
  }

  const values = data.map((d) => Number(d[props.field]) || 0);
  const max = Math.max(...values, 1);
  const w = el.clientWidth || 400;
  const h = 160;
  const pad = 24;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const points = values.map((v, i) => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * innerW;
    const y = pad + innerH - (v / max) * innerH;
    return `${x},${y}`;
  });

  el.innerHTML = `
    <svg width="${w}" height="${h}" class="testgen-metrics-svg">
      <text x="${pad}" y="14" class="testgen-metrics-title">${props.title}</text>
      <polyline fill="none" stroke="#409eff" stroke-width="2" points="${points.join(' ')}" />
      ${values.map((v, i) => {
        const x = pad + (i / Math.max(values.length - 1, 1)) * innerW;
        const y = pad + innerH - (v / max) * innerH;
        return `<circle cx="${x}" cy="${y}" r="3" fill="#409eff" />`;
      }).join('')}
    </svg>
  `;
}

watch(() => props.metrics, render, { deep: true });
watch(() => props.field, render);

onMounted(() => {
  render();
  window.addEventListener('resize', render);
});

onUnmounted(() => {
  window.removeEventListener('resize', render);
});
</script>

<style scoped>
.testgen-metrics-chart {
  min-height: 160px;
  width: 100%;
}
:deep(.testgen-metrics-empty) {
  color: var(--el-text-color-secondary);
  padding: 40px;
  text-align: center;
}
:deep(.testgen-metrics-title) {
  font-size: 12px;
  fill: var(--el-text-color-secondary);
}
</style>
