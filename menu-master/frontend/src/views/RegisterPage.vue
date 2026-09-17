<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="never">
      <h1 class="auth-title">注册</h1>
      <p class="auth-sub">提交后需管理员开通才能登录</p>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" autocomplete="email" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-button type="primary" class="auth-submit" :loading="loading" @click="onSubmit">
          提交注册
        </el-button>
      </el-form>
      <p class="auth-foot">
        已有账号？
        <router-link to="/login">登录</router-link>
      </p>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { register } from '../services/authService.js';

const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const form = reactive({ username: '', email: '', password: '' });
const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      pattern: /^[a-zA-Z0-9_]{3,32}$/,
      message: '3–32 位字母、数字或下划线',
      trigger: 'blur',
    },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    {
      pattern: /^(?=.*[A-Za-z])(?=.*\d).{8,}$/,
      message: '至少 8 位，且包含字母和数字',
      trigger: 'blur',
    },
  ],
};

async function onSubmit() {
  await formRef.value?.validate().catch(() => Promise.reject());
  loading.value = true;
  try {
    await register(form);
    ElMessage.success('已提交，待管理员开通后再登录');
    await router.replace('/login');
  } catch (err) {
    ElMessage.error(err.message || '注册失败');
  } finally {
    loading.value = false;
  }
}
</script>
