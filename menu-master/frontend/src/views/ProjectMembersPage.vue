<template>
  <div class="admin-page">
    <header class="admin-head">
      <div>
        <h1>项目成员</h1>
        <p>登记谁可以进入哪个应用里的项目。身份仍用这里的账号，不在叙事或视频里另建登录。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </header>
    <el-form inline>
      <el-select v-model="form.user_id" placeholder="用户" style="width: 180px">
        <el-option v-for="item in users" :key="item.id" :label="item.username" :value="item.id" />
      </el-select>
      <el-select v-model="form.app_key" style="width: 140px">
        <el-option label="叙事" value="novel" />
        <el-option label="视频" value="cartoon" />
        <el-option label="运维" value="ops" />
      </el-select>
      <el-input v-model="form.project_id" placeholder="项目编号" style="width: 120px" />
      <el-select v-model="form.role" style="width: 120px">
        <el-option label="作者" value="author" />
        <el-option label="编辑" value="editor" />
        <el-option label="制作" value="producer" />
        <el-option label="审核" value="reviewer" />
      </el-select>
      <el-button type="primary" @click="add">添加</el-button>
    </el-form>
    <el-table :data="rows" stripe>
      <el-table-column prop="username" label="用户" />
      <el-table-column prop="app_key" label="应用" width="120" />
      <el-table-column prop="project_id" label="项目" width="100" />
      <el-table-column prop="role_label" label="角色" width="100" />
      <el-table-column label="" width="90">
        <template #default="{ row }">
          <el-button link type="danger" @click="remove(row)">移出</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '../services/api.js';

const rows = ref([]);
const users = ref([]);
const form = reactive({ user_id: null, app_key: 'cartoon', project_id: '', role: 'producer' });

async function load() {
  const body = await request('/project-members');
  rows.value = body.data?.rows || [];
}
async function loadUsers() {
  const body = await request('/users?pageSize=100');
  const list = body.data?.list || body.data?.users || body.data || [];
  users.value = (Array.isArray(list) ? list : []).filter(item => item.status === 'active');
}
async function add() {
  try {
    await request('/project-members', {
      method: 'POST',
      body: JSON.stringify({
        user_id: form.user_id,
        app_key: form.app_key,
        project_id: Number(form.project_id),
        role: form.role,
      }),
    });
    form.project_id = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function remove(row) {
  try {
    await request(`/project-members/${row.id}`, { method: 'DELETE' });
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(() => {
  Promise.all([ load(), loadUsers() ]).catch(err => ElMessage.error(err.message));
});
</script>
