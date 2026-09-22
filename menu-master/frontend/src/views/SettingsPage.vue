<template>
  <div class="admin-page settings-page">
    <header class="admin-head">
      <div>
        <h1>账号设置</h1>
        <p>{{ user.username }} · {{ user.role === 'admin' ? '管理员' : '操作员' }}</p>
      </div>
    </header>

    <el-card shadow="never" class="settings-card">
      <h2>修改密码</h2>
      <el-form ref="pwdRef" :model="pwd" :rules="pwdRules" label-position="top" style="max-width: 360px">
        <el-form-item label="原密码" prop="old_password">
          <el-input v-model="pwd.old_password" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码" prop="new_password">
          <el-input v-model="pwd.new_password" type="password" show-password />
        </el-form-item>
        <el-button type="primary" :loading="pwdLoading" @click="onChangePwd">保存新密码</el-button>
      </el-form>
    </el-card>

    <el-card shadow="never" class="settings-card">
      <h2>二次验证（TOTP）</h2>
      <p v-if="user.mfa_enabled" class="settings-hint">已开启。关闭需同时输入登录密码和当前验证码。</p>
      <p v-else class="settings-hint">用验证器扫 otpauth 链接或手动录入密钥，再填 6 位码确认。</p>

      <template v-if="!user.mfa_enabled">
        <el-button v-if="!setup" :loading="mfaLoading" @click="onSetup">生成密钥</el-button>
        <div v-else class="mfa-box">
          <p>密钥</p>
          <code>{{ setup.secret }}</code>
          <p>otpauth</p>
          <code class="mfa-url">{{ setup.otpauth_url }}</code>
          <el-input v-model="mfaCode" maxlength="6" placeholder="6 位验证码" />
          <el-button type="primary" :loading="mfaLoading" @click="onConfirm">确认开启</el-button>
        </div>
      </template>
      <el-form v-else :model="off" label-position="top" style="max-width: 360px">
        <el-form-item label="登录密码">
          <el-input v-model="off.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="当前验证码">
          <el-input v-model="off.code" maxlength="6" />
        </el-form-item>
        <el-button type="danger" :loading="mfaLoading" @click="onDisable">关闭二次验证</el-button>
      </el-form>
    </el-card>
    <el-card shadow="never" class="settings-card">
      <h2>GitHub 部署凭证</h2>
      <p class="settings-hint">
        运维「GitHub 部署」拉仓库、自动打 tag / 列 tag 使用。Token 存在个人信息库，部署页不会反复填写。
        请使用 classic PAT（repo）或 fine-grained PAT（目标仓库 Contents: Read + Write）。
      </p>
      <p v-if="user.github_token_configured" class="settings-hint">
        已保存{{ user.github_login ? `（GitHub 用户 ${user.github_login}）` : '' }}。再提交会覆盖。
      </p>
      <el-form :model="gh" label-position="top" style="max-width: 420px">
        <el-form-item label="GitHub 用户名（选填）">
          <el-input v-model="gh.github_login" placeholder="例如 octocat" />
        </el-form-item>
        <el-form-item label="Personal Access Token">
          <el-input v-model="gh.token" type="password" show-password placeholder="ghp_… 或 github_pat_…" />
        </el-form-item>
        <el-button type="primary" :loading="ghLoading" @click="onSaveGithub">保存 Token</el-button>
        <el-button v-if="user.github_token_configured" :loading="ghLoading" @click="onClearGithub">清除</el-button>
      </el-form>
    </el-card>

    <el-card shadow="never" class="settings-card">
      <h2>阿里云账户</h2>
      <p class="settings-hint">
        用于 AgentRun / 函数计算部署上传。请填主账号 UID（AccountID）与 AccessKey；Secret 只存本账号，接口不回传明文。
      </p>
      <p v-if="user.aliyun_access_key_configured" class="settings-hint">
        已保存{{ user.aliyun_account_id ? `（UID ${user.aliyun_account_id}` : '' }}{{ user.aliyun_access_key_id ? ` · AK ${user.aliyun_access_key_id}` : '' }}{{ user.aliyun_account_id || user.aliyun_access_key_id ? '）' : '' }}。Secret 留空再保存可只改 UID / AK ID。
      </p>
      <el-form :model="aliyun" label-position="top" style="max-width: 420px">
        <el-form-item label="主账号 UID（AccountID）">
          <el-input v-model="aliyun.account_id" placeholder="数字 UID，不是 RAM 子用户 ID" />
        </el-form-item>
        <el-form-item label="AccessKey ID">
          <el-input v-model="aliyun.access_key_id" placeholder="LTAI…" />
        </el-form-item>
        <el-form-item label="AccessKey Secret">
          <el-input
            v-model="aliyun.access_key_secret"
            type="password"
            show-password
            :placeholder="user.aliyun_access_key_configured ? '留空则保持原 Secret' : '必填'"
          />
        </el-form-item>
        <el-button type="primary" :loading="aliyunLoading" @click="onSaveAliyun">保存阿里云凭证</el-button>
        <el-button v-if="user.aliyun_access_key_configured" :loading="aliyunLoading" @click="onClearAliyun">清除</el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import {
  changePassword,
  clearAliyunCredentials,
  clearGithubToken,
  confirmMfa,
  disableMfa,
  fetchMe,
  saveAliyunCredentials,
  saveGithubToken,
  setupMfa,
} from '../services/authService.js';
import { getCachedUser, setSession, getAccessToken } from '../lib/amsAuth.js';

const user = reactive({
  ...getCachedUser(),
  mfa_enabled: !!getCachedUser()?.mfa_enabled,
  github_token_configured: !!getCachedUser()?.github_token_configured,
  github_login: getCachedUser()?.github_login || '',
  aliyun_account_id: getCachedUser()?.aliyun_account_id || '',
  aliyun_access_key_id: getCachedUser()?.aliyun_access_key_id || '',
  aliyun_access_key_configured: !!getCachedUser()?.aliyun_access_key_configured,
});
const pwdRef = ref(null);
const pwdLoading = ref(false);
const mfaLoading = ref(false);
const ghLoading = ref(false);
const aliyunLoading = ref(false);
const setup = ref(null);
const mfaCode = ref('');
const pwd = reactive({ old_password: '', new_password: '' });
const off = reactive({ password: '', code: '' });
const gh = reactive({ token: '', github_login: '' });
const aliyun = reactive({ account_id: '', access_key_id: '', access_key_secret: '' });
const pwdRules = {
  old_password: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { pattern: /^(?=.*[A-Za-z])(?=.*\d).{8,}$/, message: '至少 8 位，且包含字母和数字', trigger: 'blur' },
  ],
};

async function refreshMe() {
  try {
    const data = await fetchMe();
    const next = data.user || data;
    Object.assign(user, next);
    setSession({ token: getAccessToken(), user: next });
    gh.github_login = next.github_login || '';
    aliyun.account_id = next.aliyun_account_id || '';
    aliyun.access_key_id = next.aliyun_access_key_id || '';
  } catch {
    /* 保持缓存 */
  }
}

refreshMe();

async function onSaveGithub() {
  ghLoading.value = true;
  try {
    const data = await saveGithubToken(gh);
    const next = data.user || data;
    Object.assign(user, next);
    setSession({ token: getAccessToken(), user: next });
    gh.token = '';
    gh.github_login = next.github_login || gh.github_login;
    ElMessage.success('GitHub Token 已写入个人信息');
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    ghLoading.value = false;
  }
}

async function onClearGithub() {
  ghLoading.value = true;
  try {
    const data = await clearGithubToken();
    const next = data.user || data;
    Object.assign(user, next);
    setSession({ token: getAccessToken(), user: next });
    ElMessage.success('已清除 GitHub Token');
  } catch (err) {
    ElMessage.error(err.message || '清除失败');
  } finally {
    ghLoading.value = false;
  }
}

async function onSaveAliyun() {
  aliyunLoading.value = true;
  try {
    const data = await saveAliyunCredentials(aliyun);
    const next = data.user || data;
    Object.assign(user, next);
    setSession({ token: getAccessToken(), user: next });
    aliyun.access_key_secret = '';
    aliyun.account_id = next.aliyun_account_id || aliyun.account_id;
    aliyun.access_key_id = next.aliyun_access_key_id || aliyun.access_key_id;
    ElMessage.success('阿里云凭证已写入个人信息');
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    aliyunLoading.value = false;
  }
}

async function onClearAliyun() {
  aliyunLoading.value = true;
  try {
    const data = await clearAliyunCredentials();
    const next = data.user || data;
    Object.assign(user, next);
    setSession({ token: getAccessToken(), user: next });
    aliyun.account_id = '';
    aliyun.access_key_id = '';
    aliyun.access_key_secret = '';
    ElMessage.success('已清除阿里云凭证');
  } catch (err) {
    ElMessage.error(err.message || '清除失败');
  } finally {
    aliyunLoading.value = false;
  }
}

async function onChangePwd() {
  await pwdRef.value?.validate().catch(() => Promise.reject());
  pwdLoading.value = true;
  try {
    await changePassword(pwd);
    pwd.old_password = '';
    pwd.new_password = '';
    ElMessage.success('密码已更新');
  } catch (err) {
    ElMessage.error(err.message || '修改失败');
  } finally {
    pwdLoading.value = false;
  }
}

async function onSetup() {
  mfaLoading.value = true;
  try {
    setup.value = await setupMfa();
  } catch (err) {
    ElMessage.error(err.message || '生成失败');
  } finally {
    mfaLoading.value = false;
  }
}

async function onConfirm() {
  mfaLoading.value = true;
  try {
    const data = await confirmMfa({ code: mfaCode.value });
    Object.assign(user, data.user || data);
    setSession({ token: getAccessToken(), user: data.user || data });
    setup.value = null;
    mfaCode.value = '';
    ElMessage.success('二次验证已开启');
  } catch (err) {
    ElMessage.error(err.message || '开启失败');
  } finally {
    mfaLoading.value = false;
  }
}

async function onDisable() {
  mfaLoading.value = true;
  try {
    const data = await disableMfa(off);
    Object.assign(user, data.user || data);
    setSession({ token: getAccessToken(), user: data.user || data });
    off.password = '';
    off.code = '';
    ElMessage.success('已关闭二次验证');
  } catch (err) {
    ElMessage.error(err.message || '关闭失败');
  } finally {
    mfaLoading.value = false;
  }
}
</script>
