<template>
  <div class="project-vars-page">
    <el-alert
      title="全局变量支持手动配置与响应提取自动赋值，当前为前端预览；保存时将提示服务端接口尚未实现。"
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />
    <div class="toolbar">
      <el-button type="primary" @click="addVar">新增变量</el-button>
      <el-button @click="saveVars">保存变量</el-button>
    </div>
    <el-table :data="variables" border stripe>
      <el-table-column prop="key" label="变量名" width="160">
        <template #default="{ row }">
          <el-input v-model="row.key" placeholder="如 access_token" />
        </template>
      </el-table-column>
      <el-table-column prop="value" label="默认值" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.value" placeholder="静态值或留空" />
        </template>
      </el-table-column>
      <el-table-column prop="source" label="赋值方式" width="140">
        <template #default="{ row }">
          <el-select v-model="row.source" style="width: 100%">
            <el-option label="手动" value="manual" />
            <el-option label="响应提取" value="extract" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="提取规则" min-width="220">
        <template #default="{ row }">
          <el-input
            v-if="row.source === 'extract'"
            v-model="row.extract_path"
            placeholder="JSONPath，如 $.data.token"
          />
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="from_step" label="来源步骤" width="120">
        <template #default="{ row }">
          <el-input v-if="row.source === 'extract'" v-model="row.from_step" placeholder="步骤 ID" />
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80">
        <template #default="{ $index }">
          <el-button link type="danger" @click="variables.splice($index, 1)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { saveProjectVariables } from '@/services/projectService.js';

const props = defineProps({
  project: { type: Object, required: true },
});

const storageKey = () => `testgen:project-vars:${props.project.project_code}`;
const variables = ref([]);

function loadLocal() {
  try {
    const raw = localStorage.getItem(storageKey());
    variables.value = raw ? JSON.parse(raw) : defaultVars();
  } catch {
    variables.value = defaultVars();
  }
}

function defaultVars() {
  return [
    { key: 'base_url', value: '', source: 'manual', extract_path: '', from_step: '' },
    { key: 'access_token', value: '', source: 'extract', extract_path: '$.data.token', from_step: 'login' },
  ];
}

function addVar() {
  variables.value.push({ key: '', value: '', source: 'manual', extract_path: '', from_step: '' });
}

function persistLocal() {
  localStorage.setItem(storageKey(), JSON.stringify(variables.value));
}

async function saveVars() {
  persistLocal();
  try {
    await saveProjectVariables(props.project.project_code, { variables: variables.value });
  } catch (e) {
    ElMessage.warning(e.message || '服务端尚未实现，已保存至本地');
    return;
  }
  ElMessage.success('已保存');
}

watch(() => props.project.project_code, loadLocal);
onMounted(loadLocal);
</script>

<style scoped>
.toolbar {
  margin-bottom: 12px;
  display: flex;
  gap: 8px;
}
.muted {
  color: #c0c4cc;
}
</style>
