<template>
  <PageShell title="环境与服务端点" table-layout>
    <template #extra>
      <el-button type="primary" @click="openCreate">新增环境</el-button>
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
    >
      <template #suffix>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </template>
    </FitnessLabeledTable>
    <el-dialog v-model="showForm" :title="editingId ? '编辑环境' : '新增环境'" width="520px">
      <el-form label-width="120px">
        <el-form-item label="名称">
          <el-input v-model="form.name" :disabled="!!editingId" />
        </el-form-item>
        <el-form-item label="教练 BFF">
          <el-input v-model="form.bff_coach_url" placeholder="http://host.docker.internal:3001" />
        </el-form-item>
        <el-form-item label="CLI 工作区">
          <el-input
            v-model="form.cli_workspace_root"
            placeholder="Docker 默认 /fitness-agent"
          />
          <div class="field-hint">
            fitness-agent 仓库根目录；CLI 命令如 cd server && npm run test:stations 在此目录下执行
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
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
import { fetchEnvironments, updateEnvironment } from '@/services/fitnessService.js';

const loading = ref(false);
const envs = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const showForm = ref(false);
const editingId = ref(null);
const form = reactive({
  name: '',
  bff_coach_url: '',
  cli_workspace_root: '',
});

const envColumns = [
  { prop: 'name', label: '环境名称', minWidth: 140 },
  { prop: 'config_env_id', label: '配置项编码', width: 160 },
  { prop: 'bff_coach_url', label: '教练 BFF', minWidth: 200 },
  { prop: 'cli_workspace_root', label: 'CLI 工作区', minWidth: 160 },
];

function resetForm() {
  form.name = '';
  form.bff_coach_url = '';
  form.cli_workspace_root = '';
  editingId.value = null;
}

function openCreate() {
  resetForm();
  showForm.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  form.name = row.name || '';
  form.bff_coach_url = row.bff_coach_url || '';
  form.cli_workspace_root = row.cli_workspace_root || '';
  showForm.value = true;
}

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

async function save() {
  if (editingId.value) {
    await updateEnvironment(editingId.value, {
      bff_coach_url: form.bff_coach_url,
      cli_workspace_root: form.cli_workspace_root,
    });
    ElMessage.success('已更新');
  } else {
    await api.post('/fitness/environments', form);
    ElMessage.success('已创建');
  }
  showForm.value = false;
  resetForm();
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

<style scoped>
.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>
