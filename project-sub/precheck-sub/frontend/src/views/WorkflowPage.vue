<template>
  <PageShell title="工作流">
    <template #extra>
      <el-button type="primary" @click="router.push('/workflows/new')">导入工作流</el-button>
    </template>
    <div class="precheck-module">
      <el-table :data="rows">
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column label="分类" width="140">
          <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column label="建议显存" width="120">
          <template #default="{ row }">{{ row.suggested_vram_gb == null ? '—' : `${row.suggested_vram_gb} GB` }}</template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/workflows/${row.id}`)">详情</el-button>
            <el-button link type="primary" @click="router.push(`/workflows/${row.id}/edit`)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!rows.length" description="还没有工作流" />
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';
import { categoryLabel } from '../lib/workflowCategory.js';

const route = useRoute();
const router = useRouter();
const rows = ref([]);
onMounted(async () => {
  if (route.query.id) {
    router.replace(`/workflows/${route.query.id}`);
    return;
  }
  rows.value = await request('/workflows') || [];
});
</script>
