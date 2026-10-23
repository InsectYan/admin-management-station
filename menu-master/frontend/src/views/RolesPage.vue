<template>
  <div class="admin-page">
    <header class="admin-head">
      <div>
        <h1>角色管理</h1>
        <p>按子应用代号建立角色。子应用用这个代号拉取角色列表。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建角色</el-button>
    </header>
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="app_name" label="子应用" width="120" />
      <el-table-column prop="app_code" label="应用 code" width="140" />
      <el-table-column prop="name" label="角色" width="140" />
      <el-table-column prop="code" label="角色 code" width="140" />
      <el-table-column prop="remark" label="说明" min-width="180" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">{{ row.status === 'enabled' ? '启用' : '禁用' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140">
        <template #default="{ row }">
          <el-button link type="primary" @click="toggle(row)">{{ row.status === 'enabled' ? '禁用' : '启用' }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="visible" title="新建角色" width="480px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="子应用名称"><el-input v-model="form.app_name" placeholder="例如 漫剧" /></el-form-item>
        <el-form-item label="应用 code"><el-input v-model="form.app_code" placeholder="例如 cartoon" /></el-form-item>
        <el-form-item label="角色中文名"><el-input v-model="form.name" placeholder="例如 制作" /></el-form-item>
        <el-form-item label="角色 code"><el-input v-model="form.code" placeholder="例如 maker" /></el-form-item>
        <el-form-item label="说明"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="create">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '../services/api.js';

const list = ref([]);
const loading = ref(false);
const visible = ref(false);
const saving = ref(false);
const form = reactive({ app_name: '', app_code: '', name: '', code: '', remark: '' });

async function load() {
  loading.value = true;
  try {
    const body = await request('/roles');
    list.value = body.data?.list || [];
  } catch (err) {
    ElMessage.error(err.message || '加载失败');
  } finally {
    loading.value = false;
  }
}
function openCreate() {
  Object.assign(form, { app_name: '', app_code: '', name: '', code: '', remark: '' });
  visible.value = true;
}
async function create() {
  saving.value = true;
  try {
    await request('/roles', { method: 'POST', body: JSON.stringify(form) });
    ElMessage.success('已创建');
    visible.value = false;
    load();
  } catch (err) {
    ElMessage.error(err.message || '创建失败');
  } finally {
    saving.value = false;
  }
}
async function toggle(row) {
  try {
    await request(`/roles/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: row.status === 'enabled' ? 'disabled' : 'enabled' }),
    });
    load();
  } catch (err) {
    ElMessage.error(err.message || '更新失败');
  }
}
onMounted(load);
</script>
