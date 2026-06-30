<template>
  <PageShell title="业务专题">
    <p class="topic-desc">业务模块与 PRD 目标覆盖专题 — 占位内容，后续接入 v_metric_prd_goal_coverage 与用例库联动。</p>
    <el-button type="primary" link @click="router.push('/fitness/insights/metrics/prd-goals')">查看 PRD 目标覆盖</el-button>
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
