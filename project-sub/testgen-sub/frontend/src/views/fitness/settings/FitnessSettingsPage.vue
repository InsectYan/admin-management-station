<template>
  <PageShell title="枚举与配置（只读）" table-layout>
    <el-select
      v-model="selectedTable"
      placeholder="选择枚举表"
      style="width:280px;margin-bottom:16px"
      @change="onTableChange"
    >
      <el-option v-for="t in enumTables" :key="t" :label="tableLabels[t] || t" :value="t" />
    </el-select>
    <FitnessLabeledTable
      :data="rows"
      :columns="columns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="load"
    />
    <p class="sync-hint">数据同步：执行 <code>ams-testgen db</code>（自动补列 + 注入）</p>
  </PageShell>
</template>

<script setup>
import { ref } from 'vue';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { fetchEnums } from '@/services/fitnessService.js';

const enumTables = [
  'test_dimension', 'test_category_major', 'test_category_minor',
  'test_scheme_enum', 'test_validation_enum', 'test_priority_enum',
  'test_automation_status_enum', 'test_station_enum', 'test_role_enum',
  'config_env_enum', 'automation_entry_enum', 'threshold_param_enum', 'prd_goal',
];

const tableLabels = {
  test_dimension: '测试维度',
  test_category_major: '测试大类',
  test_category_minor: '测试子类',
  test_scheme_enum: 'TS 测试方案',
  test_validation_enum: 'VS 验证标准',
  test_priority_enum: '优先级',
  test_automation_status_enum: '自动化状态',
  test_station_enum: '六站',
  test_role_enum: '三端角色',
  config_env_enum: '配置项',
  automation_entry_enum: '自动化入口',
  threshold_param_enum: '阈值参数',
  prd_goal: 'PRD 目标',
};

const selectedTable = ref('test_dimension');
const loading = ref(false);
const rows = ref([]);
const columns = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

function onTableChange() {
  page.value = 1;
  load();
}

async function load() {
  if (!selectedTable.value) return;
  loading.value = true;
  try {
    const data = await fetchEnums(selectedTable.value, { page: page.value, pageSize: pageSize.value });
    rows.value = data.list || [];
    columns.value = data.columns || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

load();
</script>

<style scoped>
.sync-hint { color: #909399; font-size: 13px; margin-top: 12px; }
</style>
