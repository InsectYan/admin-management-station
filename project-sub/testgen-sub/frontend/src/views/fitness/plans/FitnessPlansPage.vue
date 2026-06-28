<template>
  <PageShell title="测试计划" table-layout>
    <template #extra>
      <el-button type="primary" @click="router.push('/fitness/plans/new')">新建计划</el-button>
    </template>
    <FitnessLabeledTable
      :data="plans"
      :columns="planColumns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="load"
    >
      <template #suffix>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/fitness/plans/${row.id}`)">详情</el-button>
            <el-button link @click="router.push(`/fitness/plans/${row.id}/report`)">报告</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </template>
    </FitnessLabeledTable>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { deletePlan, fetchPlans } from '@/services/fitnessService.js';

const router = useRouter();
const loading = ref(false);
const plans = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const planColumns = [
  { prop: 'name', label: '计划名称', minWidth: 180 },
  { prop: 'version_tag', label: '版本', width: 120 },
  { prop: 'status', label: '状态', width: 100 },
  { prop: 'created_at', label: '创建时间', width: 180 },
];

async function load() {
  loading.value = true;
  try {
    const data = await fetchPlans({ page: page.value, pageSize: pageSize.value });
    plans.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除计划「${row.name}」？`, '删除确认', { type: 'warning' });
  } catch {
    return;
  }
  await deletePlan(row.id);
  ElMessage.success('已删除');
  await load();
}

onMounted(load);
</script>
