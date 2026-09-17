<template>
  <div class="admin-page">
    <header class="admin-head">
      <div>
        <h1>审计日志</h1>
        <p>记录开通、禁用、改角色、重置密码、开关 MFA。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </header>
    <div class="admin-filters">
      <el-input v-model="query.q" clearable placeholder="操作人 / 对象" @keyup.enter="search" />
      <el-select v-model="query.action" clearable placeholder="动作" @change="search">
        <el-option label="开通" value="approve" />
        <el-option label="禁用" value="disabled" />
        <el-option label="改角色" value="set_role" />
        <el-option label="重置密码" value="reset_password" />
        <el-option label="改自己密码" value="change_password" />
        <el-option label="开启 MFA" value="mfa_enable" />
        <el-option label="关闭 MFA" value="mfa_disable" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="created_at" label="时间" width="190" />
      <el-table-column prop="actor_username" label="操作人" width="140" />
      <el-table-column label="动作" width="140">
        <template #default="{ row }">{{ actionText(row.action) }}</template>
      </el-table-column>
      <el-table-column prop="target_username" label="对象" width="140" />
      <el-table-column prop="detail" label="详情" min-width="220" show-overflow-tooltip />
    </el-table>
    <div class="admin-pager">
      <el-pagination
        background
        layout="total, prev, pager, next"
        :total="total"
        :page-size="query.pageSize"
        :current-page="query.page"
        @current-change="onPage"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchAuditLogs } from '../services/userService.js';

const MAP = {
  approve: '开通',
  disabled: '禁用',
  active: '启用',
  set_role: '改角色',
  reset_password: '重置密码',
  change_password: '改自己密码',
  mfa_enable: '开启 MFA',
  mfa_disable: '关闭 MFA',
};

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const query = reactive({ q: '', action: '', page: 1, pageSize: 20 });

function actionText(action) {
  return MAP[action] || action;
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchAuditLogs(query);
    list.value = data.list || [];
    total.value = data.total || 0;
  } catch (err) {
    ElMessage.error(err.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function search() {
  query.page = 1;
  load();
}

function onPage(page) {
  query.page = page;
  load();
}

onMounted(load);
</script>
