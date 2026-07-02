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

    <template v-if="isConfigEnvGrouped">
      <el-collapse v-loading="loading">
        <el-collapse-item v-for="g in configEnvGroups" :key="g.domain" :title="`${g.domain} (${g.item_count})`">
          <el-table :data="g.items" size="small" border>
            <el-table-column prop="config_env_id" label="ID" width="220" />
            <el-table-column prop="name" label="名称" min-width="160" />
            <el-table-column prop="default_value" label="默认值" width="120" />
          </el-table>
        </el-collapse-item>
      </el-collapse>
    </template>
    <FitnessLabeledTable
      v-else
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
import { computed, ref } from 'vue';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { fetchEnums } from '@/services/fitnessService.js';

const enumTables = [
  'test_dimension', 'test_category_major', 'test_category_minor',
  'config_template_enum', 'test_category_major_template',
  'test_scheme_enum', 'test_validation_enum', 'test_priority_enum',
  'test_automation_status_enum', 'test_station_enum', 'test_role_enum',
  'config_env_enum', 'automation_entry_enum', 'threshold_param_enum', 'prd_goal',
];

const tableLabels = {
  test_dimension: '测试维度',
  test_category_major: '测试大类',
  test_category_minor: '测试子类',
  config_template_enum: '配置模板',
  test_category_major_template: '大类模板挂载',
  test_scheme_enum: 'TS 测试方案',
  test_validation_enum: 'VS 验证标准',
  test_priority_enum: '优先级',
  test_automation_status_enum: '自动化状态',
  test_station_enum: '六站',
  test_role_enum: '三端角色',
  config_env_enum: '配置项（按 domain 分组）',
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
const configEnvGroups = ref([]);

const isConfigEnvGrouped = computed(() => selectedTable.value === 'config_env_enum');

function onTableChange() {
  page.value = 1;
  load();
}

async function load() {
  if (!selectedTable.value) return;
  loading.value = true;
  try {
    if (isConfigEnvGrouped.value) {
      const data = await fetchEnums('config_env_enum', { group_by: 'domain' });
      configEnvGroups.value = (data.groups || []).map(g => ({
        domain: g.domain || '未分组',
        item_count: g.item_count,
        items: g.items || [],
      }));
      rows.value = [];
      return;
    }
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
.sync-hint {
  margin-top: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
