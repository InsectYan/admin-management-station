<template>
  <PageShell title="可观测性专题">
    <p class="topic-desc">可观测性审计（TS-08-OBS）与 Journey 追踪专题 — 占位内容，后续接入 observability 指标与执行控制台 artifact 汇总。</p>
    <el-button type="primary" link @click="router.push('/testgen/items')">浏览可观测用例</el-button>
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
