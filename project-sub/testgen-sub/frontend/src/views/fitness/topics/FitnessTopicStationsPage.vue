<template>
  <PageShell title="六站专题">
    <p class="topic-desc">六站（Station）维度测试资产与执行策略专题页 — 占位内容，后续接入 v_metric_station_role_matrix 视图。</p>
    <el-button type="primary" link @click="router.push('/fitness/insights/metrics/station-role')">查看六站指标</el-button>
  </PageShell>
</template>

<script setup>
import { useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';

const router = useRouter();
</script>

<style scoped>
.topic-desc {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
</style>
