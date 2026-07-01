<template>
  <div class="project-sync-page">
    <el-form v-loading="loading" label-width="120px" style="max-width: 560px">
      <el-form-item label="源环境">
        <el-select v-model="form.source" placeholder="选择源环境" style="width: 100%">
          <el-option v-for="e in envNames" :key="e" :label="e" :value="e" />
        </el-select>
      </el-form-item>
      <el-form-item label="目标环境">
        <el-checkbox-group v-model="form.targets">
          <el-checkbox v-for="e in targetOptions" :key="e" :label="e" :value="e" />
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="同步范围">
        <el-checkbox-group v-model="form.fields">
          <el-checkbox label="base_url" value="base_url">域名 / IP</el-checkbox>
          <el-checkbox label="base_path" value="base_path">基础路径</el-checkbox>
          <el-checkbox label="auth" value="auth">认证信息</el-checkbox>
          <el-checkbox label="database" value="database">数据库连接</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="syncing" @click="doSync">一键同步</el-button>
      </el-form-item>
    </el-form>

    <el-divider v-if="lastResult" content-position="left">最近同步结果</el-divider>
    <el-alert v-if="lastResult" type="success" show-icon :closable="false">
      <div>
        {{ lastResult.source }} → {{ lastResult.targets.join('、') }}（{{ lastResult.fields.join('、') }}）
        <p style="margin: 4px 0 0">{{ formatTime(lastResult.synced_at) }}</p>
      </div>
    </el-alert>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchProjectEnvironments, syncProjectEnvironments } from '@/services/projectService.js';

const props = defineProps({
  project: { type: Object, required: true },
});

const loading = ref(false);
const envs = ref([]);
const lastResult = ref(null);
const syncing = ref(false);
const form = reactive({
  source: '',
  targets: [],
  fields: [ 'base_url', 'base_path', 'auth', 'database' ],
});

const envNames = computed(() => envs.value.map(e => e.name));
const targetOptions = computed(() => envNames.value.filter(n => n !== form.source));

function formatTime(v) {
  return v ? new Date(v).toLocaleString('zh-CN') : '-';
}

async function loadEnvs() {
  loading.value = true;
  try {
    const data = await fetchProjectEnvironments(props.project.project_code);
    envs.value = data.list || [];
    if (!form.source && envNames.value.length) form.source = envNames.value[0];
    form.targets = form.targets.filter(t => targetOptions.value.includes(t));
  } finally {
    loading.value = false;
  }
}

async function doSync() {
  if (!form.source || !form.targets.length || !form.fields.length) {
    ElMessage.warning('请选择源环境、目标环境与同步范围');
    return;
  }
  syncing.value = true;
  try {
    lastResult.value = await syncProjectEnvironments(props.project.project_code, { ...form });
    ElMessage.success('同步完成');
  } catch (e) {
    ElMessage.error(e.message || '同步失败');
  } finally {
    syncing.value = false;
  }
}

watch(() => props.project.project_code, loadEnvs);
onMounted(loadEnvs);
</script>
