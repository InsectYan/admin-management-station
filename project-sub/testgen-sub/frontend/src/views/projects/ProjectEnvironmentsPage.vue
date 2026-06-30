<template>
  <div v-loading="loading" class="project-env-page">
    <div class="toolbar">
      <el-button type="primary" @click="openForm()">新增环境模板</el-button>
    </div>
    <el-empty v-if="!loading && !envs.length" description="暂无环境配置，请点击上方新增" />
    <el-table v-else :data="envs" border stripe>
      <el-table-column prop="name" label="环境名称" min-width="120" />
      <el-table-column prop="tier" label="层级" width="100">
        <template #default="{ row }">{{ tierLabel(row.tier) }}</template>
      </el-table-column>
      <el-table-column prop="base_url" label="域名 / IP" min-width="180" />
      <el-table-column prop="base_path" label="基础路径" width="120" />
      <el-table-column prop="auth_type" label="认证方式" width="100" />
      <el-table-column label="数据库" min-width="140">
        <template #default="{ row }">{{ row.db_host ? `${row.db_host}:${row.db_port || 5432}` : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openForm(row)">编辑</el-button>
          <el-button link type="danger" @click="removeEnv(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="showForm" :title="editId ? '编辑环境' : '新增环境'" width="560px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="环境名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="环境层级">
          <el-select v-model="form.tier" style="width: 100%">
            <el-option label="开发" value="dev" />
            <el-option label="测试" value="staging" />
            <el-option label="预发" value="preprod" />
            <el-option label="生产" value="prod" />
          </el-select>
        </el-form-item>
        <el-form-item label="域名 / IP">
          <el-input v-model="form.base_url" placeholder="https://api.example.com" />
        </el-form-item>
        <el-form-item label="基础路径">
          <el-input v-model="form.base_path" placeholder="/api/v1" />
        </el-form-item>
        <el-form-item label="认证方式">
          <el-select v-model="form.auth_type" style="width: 100%">
            <el-option label="无" value="none" />
            <el-option label="Bearer Token" value="bearer" />
            <el-option label="Basic Auth" value="basic" />
            <el-option label="API Key" value="apikey" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.auth_type !== 'none'" label="认证凭证">
          <el-input v-model="form.auth_secret" type="password" show-password placeholder="留空则保持原值" />
        </el-form-item>
        <el-form-item label="DB 主机"><el-input v-model="form.db_host" /></el-form-item>
        <el-form-item label="DB 端口"><el-input v-model="form.db_port" placeholder="5432" /></el-form-item>
        <el-form-item label="DB 名称"><el-input v-model="form.db_name" /></el-form-item>
        <el-form-item label="DB 用户"><el-input v-model="form.db_user" /></el-form-item>
        <el-form-item label="DB 密码">
          <el-input v-model="form.db_password" type="password" show-password placeholder="留空则保持原值" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEnv">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  createProjectEnvironment,
  deleteProjectEnvironment,
  fetchProjectEnvironments,
  updateProjectEnvironment,
} from '@/services/projectService.js';

const props = defineProps({
  project: { type: Object, required: true },
});

const loading = ref(false);
const saving = ref(false);
const envs = ref([]);
const showForm = ref(false);
const editId = ref(null);
const form = reactive(emptyForm());

const TIER_LABELS = { dev: '开发', staging: '测试', preprod: '预发', prod: '生产' };

function tierLabel(t) {
  return TIER_LABELS[t] || t;
}

function emptyForm() {
  return {
    name: '', tier: 'staging', base_url: '', base_path: '/',
    auth_type: 'none', auth_secret: '',
    db_host: '', db_port: '5432', db_name: '', db_user: '', db_password: '',
  };
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchProjectEnvironments(props.project.project_code);
    envs.value = data.list || [];
  } finally {
    loading.value = false;
  }
}

function openForm(row) {
  editId.value = row?.id ?? null;
  Object.assign(form, row ? {
    ...emptyForm(),
    ...row,
    auth_secret: '',
    db_password: '',
  } : emptyForm());
  showForm.value = true;
}

async function saveEnv() {
  if (!form.name?.trim()) {
    ElMessage.warning('请填写环境名称');
    return;
  }
  saving.value = true;
  try {
    const payload = { ...form };
    if (editId.value) {
      await updateProjectEnvironment(props.project.project_code, editId.value, payload);
    } else {
      await createProjectEnvironment(props.project.project_code, payload);
    }
    showForm.value = false;
    ElMessage.success('已保存');
    await load();
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function removeEnv(row) {
  try {
    await ElMessageBox.confirm(`确定删除环境「${row.name}」？`, '删除确认', { type: 'warning' });
  } catch {
    return;
  }
  await deleteProjectEnvironment(props.project.project_code, row.id);
  ElMessage.success('已删除');
  await load();
}

watch(() => props.project.project_code, load);
onMounted(load);
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
}
</style>
