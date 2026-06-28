<template>
  <PageShell title="方案与验证百科" v-loading="loading">
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="TS 测试方案" name="schemes">
        <FitnessLabeledTable
          :data="data?.schemes || []"
          :columns="schemeColumns"
          :page="page"
          :page-size="pageSize"
          :total="(data?.schemes || []).length"
          :loading="loading"
          client-pagination
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </el-tab-pane>
      <el-tab-pane label="VS 验证标准" name="validations">
        <FitnessLabeledTable
          :data="data?.validations || []"
          :columns="validationColumns"
          :page="page"
          :page-size="pageSize"
          :loading="loading"
          client-pagination
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </el-tab-pane>
      <el-tab-pane label="推荐配对" name="pairs">
        <FitnessLabeledTable
          :data="data?.pairs || []"
          :columns="pairColumns"
          :page="page"
          :page-size="pageSize"
          :loading="loading"
          client-pagination
          @update:page="page = $event"
          @update:page-size="pageSize = $event"
        />
      </el-tab-pane>
      <el-tab-pane label="前缀映射" name="prefixes">
        <el-input v-model="prefixKw" placeholder="搜前缀如 C1-MACRO-" style="width:240px;margin-bottom:12px" @change="loadPrefixes" />
        <FitnessLabeledTable
          :data="data?.prefixes || []"
          :columns="prefixColumns"
          :page="prefixPage"
          :page-size="prefixPageSize"
          :total="prefixTotal"
          :loading="loading"
          @update:page="prefixPage = $event"
          @update:page-size="prefixPageSize = $event"
          @change="loadPrefixes"
        />
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { fetchSchemes } from '@/services/fitnessService.js';

const loading = ref(false);
const data = ref(null);
const activeTab = ref('schemes');
const prefixKw = ref('');
const page = ref(1);
const pageSize = ref(20);
const prefixPage = ref(1);
const prefixPageSize = ref(20);
const prefixTotal = ref(0);

const schemeColumns = [
  { prop: 'scheme_id', label: '方案编码', width: 120 },
  { prop: 'name', label: '方案名称', minWidth: 140 },
  { prop: 'description', label: '说明', minWidth: 200 },
];
const validationColumns = [
  { prop: 'validation_id', label: '验证编码', width: 140 },
  { prop: 'name', label: '验证名称', minWidth: 140 },
  { prop: 'threshold_hint', label: '阈值', minWidth: 120 },
];
const pairColumns = [
  { prop: 'scheme_name', label: '方案', minWidth: 120 },
  { prop: 'validation_name', label: '验证', minWidth: 120 },
  { prop: 'is_primary', label: '主配对', width: 80 },
];
const prefixColumns = [
  { prop: 'item_prefix', label: '前缀', width: 160 },
  { prop: 'scheme_primary_name', label: '主方案', width: 120 },
  { prop: 'validation_primary_name', label: '主验证', width: 120 },
  { prop: 'mapping_source', label: '来源', minWidth: 120 },
];

function onTabChange() {
  page.value = 1;
}

async function loadAll() {
  loading.value = true;
  data.value = await fetchSchemes();
  loading.value = false;
}

async function loadPrefixes() {
  loading.value = true;
  const res = await fetchSchemes({
    page: prefixPage.value,
    pageSize: prefixPageSize.value,
    prefixKw: prefixKw.value || undefined,
  });
  data.value = { ...data.value, ...res };
  prefixTotal.value = res.prefixTotal || 0;
  loading.value = false;
}

onMounted(loadAll);
</script>
