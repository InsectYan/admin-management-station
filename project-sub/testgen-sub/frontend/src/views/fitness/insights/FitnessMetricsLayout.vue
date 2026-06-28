<template>
  <FitnessSectionLayout title="指标中心" :tabs="tabs" />
</template>

<script setup>
import FitnessSectionLayout from '@/components/fitness/FitnessSectionLayout.vue';

const tabs = [
  { label: '维度汇总', path: '/fitness/insights/metrics/dimensions' },
  { label: 'PRD 目标', path: '/fitness/insights/metrics/prd-goals' },
  { label: '自动化', path: '/fitness/insights/metrics/automation' },
  { label: '风险防护', path: '/fitness/insights/metrics/risk-guard' },
  { label: '优先级', path: '/fitness/insights/metrics/priority' },
  { label: '六站×三端', path: '/fitness/insights/metrics/station-role' },
];
</script>
