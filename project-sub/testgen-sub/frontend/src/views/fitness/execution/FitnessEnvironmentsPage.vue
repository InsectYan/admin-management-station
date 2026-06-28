<template>
  <PageShell title="环境与服务端点" table-layout>
    <template #extra>
      <el-button type="primary" @click="showForm = true">新增环境</el-button>
      <el-button @click="healthCheck">环境探活</el-button>
    </template>
    <FitnessLabeledTable
      :data="envs"
      :columns="envColumns"
      :page="page"
      :page-size="pageSize"
      :total="total"
      :loading="loading"
      @update:page="page = $event"
      @update:page-size="pageSize = $event"
      @change="load"
    />
    <el-dialog v-model="showForm" title="新增环境" width="480px">
      <el-form label-width="100px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="教练 BFF"><el-input v-model="form.bff_coach_url" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" @click="create">保存</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import FitnessLabeledTable from '@/components/fitness/FitnessLabeledTable.vue';
import { api } from '@/services/apiConfig.js';
import { fetchEnvironments } from '@/services/fitnessService.js';

const loading = ref(false);
const envs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const showForm = ref(false);
const form = reactive({ name: '', bff_coach_url: '' });

const envColumns = [
  { prop: 'name', label: '环境名称', minWidth: 140 },
  { prop: 'config_env_id', label: '配置项编码', width: 160 },
  { prop: 'bff_coach_url', label: '教练 BFF', minWidth: 200 },
];

async function load() {
  loading.value = true;
  try {
    const data = await fetchEnvironments({ page: page.value, pageSize: pageSize.value });
    envs.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

async function create() {
  await api.post('/fitness/environments', form);
  showForm.value = false;
  await load();
}

async function healthCheck() {
  try {
    await api.post('/fitness/environments/health-check');
  } catch (e) {
    ElMessage.warning(e.message || '探活引擎未开发');
  }
}

onMounted(load);
</script>
