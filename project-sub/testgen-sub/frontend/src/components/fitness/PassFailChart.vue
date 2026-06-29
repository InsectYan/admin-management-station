<template>
  <div ref="chartRef" class="pass-fail-chart" />
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  passCount: { type: Number, default: 0 },
  failCount: { type: Number, default: 0 },
  title: { type: String, default: '子项判定分布' },
});

const chartRef = ref(null);

function render() {
  const el = chartRef.value;
  if (!el) return;

  const pass = Math.max(0, props.passCount);
  const fail = Math.max(0, props.failCount);
  const total = pass + fail;

  if (!total) {
    el.innerHTML = '<div class="pass-fail-empty">暂无子项结果</div>';
    return;
  }

  const w = el.clientWidth || 320;
  const h = 140;
  const pad = 16;
  const barH = 36;
  const maxBarW = w - pad * 2 - 80;
  const passW = Math.round((pass / total) * maxBarW);
  const failW = Math.round((fail / total) * maxBarW);

  el.innerHTML = `
    <svg width="${w}" height="${h}" class="pass-fail-svg">
      <text x="${pad}" y="18" class="pass-fail-title">${props.title}</text>
      <text x="${pad}" y="52" class="pass-fail-label">Pass</text>
      <rect x="60" y="36" width="${passW}" height="${barH}" rx="4" fill="#67c23a" />
      <text x="${66 + passW}" y="58" class="pass-fail-value">${pass}</text>
      <text x="${pad}" y="96" class="pass-fail-label">Fail</text>
      <rect x="60" y="80" width="${failW}" height="${barH}" rx="4" fill="#f56c6c" />
      <text x="${66 + failW}" y="102" class="pass-fail-value">${fail}</text>
    </svg>
  `;
}

watch(() => [ props.passCount, props.failCount ], render);
onMounted(() => {
  render();
  window.addEventListener('resize', render);
});
onUnmounted(() => window.removeEventListener('resize', render));
</script>

<style scoped>
.pass-fail-chart {
  width: 100%;
  min-height: 140px;
}
:deep(.pass-fail-empty) {
  color: var(--el-text-color-secondary);
  padding: 40px;
  text-align: center;
}
:deep(.pass-fail-title) {
  font-size: 13px;
  fill: var(--el-text-color-primary);
}
:deep(.pass-fail-label) {
  font-size: 12px;
  fill: var(--el-text-color-secondary);
}
:deep(.pass-fail-value) {
  font-size: 12px;
  fill: var(--el-text-color-regular);
}
</style>
