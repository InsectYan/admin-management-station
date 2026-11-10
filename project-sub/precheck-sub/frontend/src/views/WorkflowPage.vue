<template>
  <PageShell title="工作流" table-layout>
    <template #extra>
      <el-button type="primary" @click="router.push('/workflows/new')">导入工作流</el-button>
    </template>
    <div class="precheck-module precheck-table-page">
      <div class="precheck-table-page__bar">
        <el-select v-model="kind" clearable placeholder="全部类型" style="width: 180px">
          <el-option v-for="item in WORKFLOW_KINDS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
      <el-table v-if="filtered.length" :data="pageRows" height="100%">
        <el-table-column prop="name" label="名称" min-width="180" fixed="left" />
        <el-table-column label="分类" width="140">
          <template #default="{ row }">{{ listKindLabel(row) }}</template>
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
      <el-empty v-if="!filtered.length" description="这个类型还没有工作流" />
      <el-pagination
        v-if="filtered.length"
        v-model:current-page="page"
        v-model:page-size="pageSize"
        class="precheck-pager"
        :total="filtered.length"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
      />
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';
import { WORKFLOW_KINDS, listKindLabel, workflowKind } from '../lib/workflowCategory.js';

const route = useRoute();
const router = useRouter();
const rows = ref([]);
const kind = ref('');
const page = ref(1);
const pageSize = ref(10);
const filtered = computed(() => rows.value.filter(item => !kind.value || workflowKind(item) === kind.value));
const pageRows = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
watch([ kind, pageSize ], () => { page.value = 1; });
watch(filtered, list => {
  const max = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (page.value > max) page.value = max;
});
onMounted(async () => {
  if (route.query.id) {
    router.replace(`/workflows/${route.query.id}`);
    return;
  }
  rows.value = await request('/workflows') || [];
});
</script>
