<template>
  <div class="project-headers-page">
    <el-alert
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #title>项目默认请求头</template>
      此处配置对本项目下<strong>所有用例</strong>生效。合并顺序为：
      <code>{ ...环境请求头, ...本页请求头, ...用例配置页请求头 }</code>，同名键由用例配置覆盖。
      执行前<strong>不再校验</strong>鉴权头是否已配置；未配齐时实际请求可能由服务端返回 401。
    </el-alert>
    <div class="toolbar">
      <el-button type="primary" @click="addHeader">新增请求头</el-button>
      <el-button :loading="saving" @click="saveHeaders">保存</el-button>
      <el-button :loading="loading" @click="loadHeaders">刷新</el-button>
    </div>
    <el-table v-loading="loading" :data="headers" border stripe>
      <el-table-column prop="key" label="Header 名" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.key" placeholder="如 Authorization" />
        </template>
      </el-table-column>
      <el-table-column prop="value" label="Header 值" min-width="280">
        <template #default="{ row }">
          <el-input
            v-if="isSecretKey(row.key)"
            v-model="row.value"
            type="password"
            show-password
            placeholder="如 Bearer xxx"
          />
          <el-input
            v-else
            v-model="row.value"
            placeholder="请求头值"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80">
        <template #default="{ $index }">
          <el-button link type="danger" @click="headers.splice($index, 1)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchProjectRequestHeaders, saveProjectRequestHeaders } from '@/services/projectService.js';

const props = defineProps({
  project: { type: Object, required: true },
});

const loading = ref(false);
const saving = ref(false);
const headers = ref([]);

function isSecretKey(key) {
  return /authorization|token|secret|key|password/i.test(String(key || ''));
}

function defaultHeaders() {
  return [
    { key: 'Authorization', value: '' },
  ];
}

function addHeader() {
  headers.value.push({ key: '', value: '' });
}

async function loadHeaders() {
  if (!props.project?.project_code) return;
  loading.value = true;
  try {
    const data = await fetchProjectRequestHeaders(props.project.project_code);
    const list = data?.list || [];
    headers.value = list.length ? list : defaultHeaders();
  } catch (e) {
    ElMessage.warning(e.message || '加载请求头失败');
    headers.value = defaultHeaders();
  } finally {
    loading.value = false;
  }
}

async function saveHeaders() {
  saving.value = true;
  try {
    const data = await saveProjectRequestHeaders(props.project.project_code, {
      headers: headers.value,
    });
    headers.value = data?.list?.length ? data.list : headers.value;
    ElMessage.success('已保存');
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

watch(() => props.project.project_code, loadHeaders);
onMounted(loadHeaders);
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
}
code {
  font-size: 12px;
}
</style>
