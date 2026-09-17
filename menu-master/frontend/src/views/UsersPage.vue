<template>
  <div class="admin-page">
    <header class="admin-head">
      <div>
        <h1>用户管理</h1>
        <p>审批注册、调整角色、禁用账号。角色只有 admin / operator，不另建权限引擎。</p>
      </div>
      <el-button @click="load">刷新</el-button>
    </header>
    <div class="admin-filters">
      <el-input v-model="query.q" clearable placeholder="用户名 / 邮箱" @keyup.enter="search" />
      <el-select v-model="query.status" clearable placeholder="状态" @change="search">
        <el-option label="待开通" value="pending" />
        <el-option label="已开通" value="active" />
        <el-option label="已禁用" value="disabled" />
      </el-select>
      <el-select v-model="query.role" clearable placeholder="角色" @change="search">
        <el-option label="管理员" value="admin" />
        <el-option label="操作员" value="operator" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
    </div>
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="username" label="用户名" min-width="120" />
      <el-table-column prop="email" label="邮箱" min-width="180" />
      <el-table-column label="角色" width="110">
        <template #default="{ row }">{{ row.role === 'admin' ? '管理员' : '操作员' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="MFA" width="80">
        <template #default="{ row }">{{ row.mfa_enabled ? '已开' : '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'pending'" link type="primary" @click="setStatus(row, 'active')">开通</el-button>
          <el-button v-if="row.status === 'disabled'" link type="primary" @click="setStatus(row, 'active')">启用</el-button>
          <el-button v-if="row.status === 'active'" link type="danger" @click="setStatus(row, 'disabled')">禁用</el-button>
          <el-button
            v-if="row.role !== 'admin'"
            link
            @click="setRole(row, 'admin')"
          >升为管理员</el-button>
          <el-button
            v-if="row.role === 'admin'"
            link
            @click="setRole(row, 'operator')"
          >降为操作员</el-button>
          <el-button link @click="onReset(row)">重置密码</el-button>
          <el-button v-if="row.mfa_enabled" link @click="onDisableMfa(row)">关闭 MFA</el-button>
        </template>
      </el-table-column>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import { disableUserMfa, fetchUsers, resetUserPassword, updateUser } from '../services/userService.js';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const query = reactive({ q: '', status: '', role: '', page: 1, pageSize: 20 });

function statusText(status) {
  if (status === 'pending') return '待开通';
  if (status === 'disabled') return '已禁用';
  return '已开通';
}

function statusType(status) {
  if (status === 'pending') return 'warning';
  if (status === 'disabled') return 'info';
  return 'success';
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchUsers(query);
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

async function setStatus(row, status) {
  try {
    await updateUser(row.id, { status });
    ElMessage.success(status === 'active' ? '已开通' : '已禁用');
    load();
  } catch (err) {
    ElMessage.error(err.message || '操作失败');
  }
}

async function setRole(row, role) {
  try {
    await updateUser(row.id, { role });
    ElMessage.success('角色已更新');
    load();
  } catch (err) {
    ElMessage.error(err.message || '操作失败');
  }
}

async function onReset(row) {
  try {
    await ElMessageBox.confirm(`将为 ${row.username} 生成新密码，旧密码立即失效。`, '重置密码');
    const data = await resetUserPassword(row.id);
    if (data.password) {
      await ElMessageBox.alert(`新密码：${data.password}`, '请立即告知用户', { confirmButtonText: '已复制记下' });
    } else {
      ElMessage.success('密码已重置');
    }
  } catch (err) {
    if (err === 'cancel' || err === 'close') return;
    ElMessage.error(err.message || '重置失败');
  }
}

async function onDisableMfa(row) {
  try {
    await ElMessageBox.confirm(`关闭 ${row.username} 的二次验证？`, '关闭 MFA');
    await disableUserMfa(row.id);
    ElMessage.success('已关闭');
    load();
  } catch (err) {
    if (err === 'cancel' || err === 'close') return;
    ElMessage.error(err.message || '操作失败');
  }
}

onMounted(load);
</script>
