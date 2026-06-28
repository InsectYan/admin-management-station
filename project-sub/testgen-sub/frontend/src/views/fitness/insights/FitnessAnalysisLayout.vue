<template>
  <FitnessSectionLayout title="分析中心" :tabs="tabs" />
</template>

<script setup>
import FitnessSectionLayout from '@/components/fitness/FitnessSectionLayout.vue';

const tabs = [
  { label: '发版就绪', path: '/fitness/insights/analysis/readiness' },
  { label: 'P0 阻塞待建', path: '/fitness/insights/analysis/p0-blockers' },
  { label: '风险缺口', path: '/fitness/insights/analysis/risk-gap' },
  { label: 'TS×VS 矩阵', path: '/fitness/insights/analysis/scheme-matrix' },
  { label: '维度自动化', path: '/fitness/insights/analysis/dimension-automation' },
];
</script>
