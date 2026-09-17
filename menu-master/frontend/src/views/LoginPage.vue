<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <h1 class="auth-title">{{ mfaTicket ? '二次验证' : '登录' }}</h1>
      <p class="auth-sub">{{ mfaTicket ? `输入 ${mfaName} 验证器中的 6 位码` : '私人管理平台' }}</p>
      <el-form v-if="!mfaTicket" ref="formRef" :model="form" :rules="rules" @submit.prevent="onSubmit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" autocomplete="username" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            show-password
            autocomplete="current-password"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button type="primary" class="auth-submit" :loading="loading" @click="onSubmit">
          登录
        </el-button>
      </el-form>
      <el-form v-else @submit.prevent="onMfa">
        <el-form-item>
          <el-input
            v-model="mfaCode"
            maxlength="6"
            placeholder="6 位验证码"
            @keyup.enter="onMfa"
          />
        </el-form-item>
        <el-button type="primary" class="auth-submit" :loading="loading" @click="onMfa">
          验证并登录
        </el-button>
        <el-button class="auth-submit" style="margin-top: 8px" @click="resetMfa">返回</el-button>
      </el-form>
      <p v-if="!mfaTicket" class="auth-foot">
        还没有账号？
        <router-link to="/register">注册</router-link>
      </p>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login, loginMfa } from '../services/authService.js';
import { getAccessToken, setSession } from '../lib/amsAuth.js';

const route = useRoute();
const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const mfaTicket = ref('');
const mfaName = ref('');
const mfaCode = ref('');
const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

function goAfterLogin(token) {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  if (/^https?:\/\//.test(redirect)) {
    const url = new URL(redirect);
    url.searchParams.set('ams_token', token);
    window.location.assign(url.toString());
    return true;
  }
  return false;
}

async function enter(data) {
  setSession({ token: data.token, user: data.user });
  if (goAfterLogin(data.token)) return;
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  await router.replace(redirect.startsWith('/login') ? '/' : redirect);
}

onMounted(() => {
  const token = getAccessToken();
  if (token) goAfterLogin(token);
});

function resetMfa() {
  mfaTicket.value = '';
  mfaCode.value = '';
}

async function onSubmit() {
  await formRef.value?.validate().catch(() => Promise.reject());
  loading.value = true;
  try {
    const data = await login(form);
    if (data.mfa_required) {
      mfaTicket.value = data.mfa_ticket;
      mfaName.value = data.user?.username || form.username;
      return;
    }
    await enter(data);
  } catch (err) {
    ElMessage.error(err.message || '登录失败');
  } finally {
    loading.value = false;
  }
}

async function onMfa() {
  if (!/^\d{6}$/.test(mfaCode.value)) {
    ElMessage.error('请输入 6 位验证码');
    return;
  }
  loading.value = true;
  try {
    const data = await loginMfa({ ticket: mfaTicket.value, code: mfaCode.value });
    await enter(data);
  } catch (err) {
    ElMessage.error(err.message || '验证失败');
  } finally {
    loading.value = false;
  }
}
</script>
