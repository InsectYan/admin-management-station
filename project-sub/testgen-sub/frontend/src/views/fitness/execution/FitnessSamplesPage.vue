<template>
  <PageShell title="样本集库" table-layout>
    <template #extra>
      <el-button type="primary" @click="showForm = true">新建样本集</el-button>
    </template>
    <FitnessLabeledTable
      :data="sets"
      :columns="sampleColumns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="load"
    />
    <el-dialog v-model="showForm" title="新建样本集" width="400px">
      <el-form label-width="80px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="用例 ID"><el-input v-model="form.item_id" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="create">保存</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { api } from '@/services/apiConfig.js';
import { fetchSampleSets } from '@/services/fitnessService.js';

const loading = ref(false);
const sets = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const showForm = ref(false);
const form = reactive({ name: '', item_id: '' });

const sampleColumns = [
  { prop: 'name', label: '样本集名称', minWidth: 160 },
  { prop: 'item_id', label: '关联用例', width: 140 },
  { prop: 'sample_count', label: '条数', width: 80 },
  { prop: 'tags', label: '标签', minWidth: 120 },
];

async function load() {
  loading.value = true;
  try {
    const data = await fetchSampleSets({ page: page.value, pageSize: pageSize.value });
    sets.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

async function create() {
  await api.post('/fitness/samples', form);
  showForm.value = false;
  await load();
}

onMounted(load);
</script>
