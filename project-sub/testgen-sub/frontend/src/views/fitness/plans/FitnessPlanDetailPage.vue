<template>
  <PageShell :title="plan?.name || '计划详情'" v-loading="loading">
    <template #extra>
      <el-button @click="router.push('/fitness/plans')">返回</el-button>
      <el-button type="primary" @click="router.push(`/fitness/plans/${id}/report`)">完成报告</el-button>
    </template>
    <el-descriptions v-if="plan" :column="2" border>
      <el-descriptions-item label="版本">{{ plan.version_tag }}</el-descriptions-item>
      <el-descriptions-item label="环境">{{ plan.env_name }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ plan.status }}</el-descriptions-item>
      <el-descriptions-item label="用例数">{{ plan.items?.length || 0 }}</el-descriptions-item>
    </el-descriptions>
    <el-divider />
    <el-table :data="plan?.items||[]" size="small">
      <el-table-column prop="item_id" label="用例 ID" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button link @click="router.push(`/fitness/assets/items/${row.item_id}`)">查看</el-button>
        </template>
      </el-table-column>
    </el-table>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchPlan } from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const id = route.params.id;
const loading = ref(false);
const plan = ref(null);

onMounted(async () => {
  loading.value = true;
  plan.value = await fetchPlan(id);
  loading.value = false;
});
</script>
