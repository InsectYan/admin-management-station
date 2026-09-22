<template>
  <div class="admin-page">
    <header class="admin-head">
      <div>
        <h1>用户管理</h1>
        <p>审批注册、编辑个人信息（含 GitHub / 阿里云凭证）、调整角色与状态。</p>
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
      <el-table-column label="GitHub" width="100">
        <template #default="{ row }">
          <el-tag :type="row.github_token_configured ? 'success' : 'info'" size="small" effect="plain">
            {{ row.github_token_configured ? '已配' : '未配' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="阿里云" width="100">
        <template #default="{ row }">
          <el-tag :type="row.aliyun_access_key_configured ? 'success' : 'info'" size="small" effect="plain">
            {{ row.aliyun_access_key_configured ? '已配' : '未配' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="MFA" width="80">
        <template #default="{ row }">{{ row.mfa_enabled ? '已开' : '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="380" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑资料</el-button>
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

    <el-dialog
      v-model="edit.visible"
      :title="edit.form.username ? `编辑用户 · ${edit.form.username}` : '编辑用户'"
      width="560px"
      destroy-on-close
      :close-on-click-modal="false"
    >
      <el-form v-loading="edit.loading" label-position="top" class="user-edit-form">
        <h3 class="user-edit-section">基本信息</h3>
        <el-form-item label="用户名">
          <el-input :model-value="edit.form.username" disabled />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="edit.form.email" placeholder="user@example.com" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="edit.form.role" style="width: 100%">
            <el-option label="管理员" value="admin" />
            <el-option label="操作员" value="operator" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="edit.form.status" style="width: 100%">
            <el-option label="待开通" value="pending" />
            <el-option label="已开通" value="active" />
            <el-option label="已禁用" value="disabled" />
          </el-select>
        </el-form-item>
        <p class="user-edit-hint">MFA：{{ edit.form.mfa_enabled ? '已开启' : '未开启' }}（此处仅查看；关闭请用列表「关闭 MFA」）</p>

        <h3 class="user-edit-section">GitHub 部署凭证</h3>
        <p class="user-edit-hint">
          Token 状态：{{ edit.form.github_token_configured ? '已配置（留空保存则不改密文）' : '未配置' }}
        </p>
        <el-form-item label="GitHub 用户名">
          <el-input v-model="edit.form.github_login" placeholder="例如 octocat" clearable />
        </el-form-item>
        <el-form-item label="Personal Access Token">
          <el-input
            v-model="edit.form.github_token"
            type="password"
            show-password
            placeholder="填写则覆盖；留空保持原 Token"
          />
        </el-form-item>
        <el-button
          v-if="edit.form.github_token_configured"
          link
          type="danger"
          @click="edit.clearGithub = !edit.clearGithub"
        >
          {{ edit.clearGithub ? '取消清除 Token' : '清除已保存的 Token' }}
        </el-button>

        <h3 class="user-edit-section">阿里云账户</h3>
        <p class="user-edit-hint">
          AccessKey Secret：{{ edit.form.aliyun_access_key_configured ? '已配置（留空保存则不改密文）' : '未配置' }}
        </p>
        <el-form-item label="主账号 UID（AccountID）">
          <el-input v-model="edit.form.aliyun_account_id" placeholder="数字 UID，不是 RAM 子用户 ID" clearable />
        </el-form-item>
        <el-form-item label="AccessKey ID">
          <el-input v-model="edit.form.aliyun_access_key_id" placeholder="LTAI…" clearable />
        </el-form-item>
        <el-form-item label="AccessKey Secret">
          <el-input
            v-model="edit.form.aliyun_access_key_secret"
            type="password"
            show-password
            placeholder="填写则覆盖；留空保持原 Secret"
          />
        </el-form-item>
        <el-button
          v-if="edit.form.aliyun_access_key_configured || edit.form.aliyun_account_id || edit.form.aliyun_access_key_id"
          link
          type="danger"
          @click="edit.clearAliyun = !edit.clearAliyun"
        >
          {{ edit.clearAliyun ? '取消清除阿里云凭证' : '清除阿里云凭证' }}
        </el-button>
      </el-form>
      <template #footer>
        <el-button @click="edit.visible = false">取消</el-button>
        <el-button type="primary" :loading="edit.saving" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { disableUserMfa, fetchUser, fetchUsers, resetUserPassword, updateUser } from '../services/userService.js';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const query = reactive({ q: '', status: '', role: '', page: 1, pageSize: 20 });
const edit = reactive({
  visible: false,
  loading: false,
  saving: false,
  clearGithub: false,
  clearAliyun: false,
  form: {
    id: null,
    username: '',
    email: '',
    role: 'operator',
    status: 'pending',
    mfa_enabled: false,
    github_login: '',
    github_token: '',
    github_token_configured: false,
    aliyun_account_id: '',
    aliyun_access_key_id: '',
    aliyun_access_key_secret: '',
    aliyun_access_key_configured: false,
  },
});

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

async function openEdit(row) {
  edit.visible = true;
  edit.loading = true;
  edit.clearGithub = false;
  edit.clearAliyun = false;
  Object.assign(edit.form, {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    mfa_enabled: !!row.mfa_enabled,
    github_login: row.github_login || '',
    github_token: '',
    github_token_configured: !!row.github_token_configured,
    aliyun_account_id: row.aliyun_account_id || '',
    aliyun_access_key_id: row.aliyun_access_key_id || '',
    aliyun_access_key_secret: '',
    aliyun_access_key_configured: !!row.aliyun_access_key_configured,
  });
  try {
    const data = await fetchUser(row.id);
    const user = data.user || data;
    Object.assign(edit.form, {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      mfa_enabled: !!user.mfa_enabled,
      github_login: user.github_login || '',
      github_token: '',
      github_token_configured: !!user.github_token_configured,
      aliyun_account_id: user.aliyun_account_id || '',
      aliyun_access_key_id: user.aliyun_access_key_id || '',
      aliyun_access_key_secret: '',
      aliyun_access_key_configured: !!user.aliyun_access_key_configured,
    });
  } catch (err) {
    ElMessage.error(err.message || '加载用户详情失败');
  } finally {
    edit.loading = false;
  }
}

async function saveEdit() {
  if (!edit.form.id) return;
  if (!String(edit.form.email || '').trim()) {
    ElMessage.warning('请填写邮箱');
    return;
  }
  edit.saving = true;
  try {
    const body = {
      email: edit.form.email.trim(),
      role: edit.form.role,
      status: edit.form.status,
      github_login: edit.form.github_login,
      aliyun_account_id: edit.form.aliyun_account_id,
      aliyun_access_key_id: edit.form.aliyun_access_key_id,
    };
    if (edit.clearGithub) {
      body.clear_github_token = true;
    } else if (String(edit.form.github_token || '').trim()) {
      body.github_token = edit.form.github_token.trim();
    }
    if (edit.clearAliyun) {
      body.clear_aliyun_credentials = true;
    } else if (String(edit.form.aliyun_access_key_secret || '').trim()) {
      body.aliyun_access_key_secret = edit.form.aliyun_access_key_secret.trim();
    }
    await updateUser(edit.form.id, body);
    ElMessage.success('用户资料已保存');
    edit.visible = false;
    load();
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    edit.saving = false;
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

<style scoped>
.user-edit-form {
  max-height: min(70vh, 640px);
  overflow-y: auto;
  padding-right: 4px;
}
.user-edit-section {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
}
.user-edit-section:first-child {
  margin-top: 0;
}
.user-edit-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
</style>
