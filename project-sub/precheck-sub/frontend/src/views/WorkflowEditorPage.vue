<template>
  <PageShell :title="isNew ? '导入工作流' : '编辑工作流'">
    <template #extra>
      <el-button link type="primary" @click="router.push('/workflows')">← 返回列表</el-button>
    </template>
    <el-tabs v-model="tab">
      <el-tab-pane label="配置" name="config">
        <div class="precheck-module">
          <el-form label-position="top" class="precheck-workflow-form">
            <el-form-item label="名称"><el-input v-model="name" /></el-form-item>
            <el-form-item label="分类">
              <el-select v-model="category" style="width: 100%">
                <el-option v-for="item in WORKFLOW_CATEGORIES" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="建议显存（GB）">
              <el-input v-model="suggestedVram" placeholder="留空表示不限制" />
            </el-form-item>
          </el-form>
          <el-form-item label="工作流 JSON" label-position="top">
            <el-input v-model="raw" type="textarea" :rows="12" placeholder="Save (API Format) 的内容" />
          </el-form-item>
          <div class="precheck-workflow-actions">
            <el-button type="primary" :loading="saving" @click="save">{{ isNew ? '导入' : '保存修改' }}</el-button>
          </div>
          <DependencyCheck class="precheck-workflow-check" :run="inspect" />
        </div>
      </el-tab-pane>
      <el-tab-pane label="预览" name="preview">
        <div class="precheck-module">
          <p class="precheck-module__hint">改提示词、尺寸和采样参数后生成。多次生成只保留最新的图片或视频。</p>
          <WorkflowPreview :workflow-id="workflowId" :api-json="previewJson" />
        </div>
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import DependencyCheck from '../components/DependencyCheck.vue';
import WorkflowPreview from '../components/WorkflowPreview.vue';
import { request } from '../services/apiConfig.js';
import { WORKFLOW_CATEGORIES } from '../lib/workflowCategory.js';

const route = useRoute();
const router = useRouter();
const isNew = computed(() => route.name === 'workflow-new');
const workflowId = computed(() => (isNew.value ? '' : route.params.id));
const tab = ref('config');
const name = ref('');
const category = ref('text_to_image');
const suggestedVram = ref('');
const raw = ref('');
const saving = ref(false);
const previewJson = ref(null);

function parseRaw() {
  try {
    return JSON.parse(raw.value);
  } catch {
    ElMessage.error('JSON 无法解析');
    return null;
  }
}
function payload(apiJson) {
  const vram = String(suggestedVram.value).trim();
  return {
    name: name.value.trim(),
    category: category.value,
    api_json: apiJson,
    suggested_vram_gb: vram === '' ? null : Number(vram),
  };
}
async function inspect() {
  const apiJson = parseRaw();
  if (!apiJson) throw new Error('JSON 无法解析');
  return request('/workflows/inspect', { method: 'post', data: { api_json: apiJson } });
}
async function save() {
  const apiJson = parseRaw();
  if (!apiJson) return;
  if (!name.value.trim()) {
    ElMessage.warning('请填写名称');
    return;
  }
  saving.value = true;
  try {
    if (isNew.value) {
      const row = await request('/workflows', { method: 'post', data: payload(apiJson) });
      ElMessage.success('已导入');
      router.replace(`/workflows/${row.id}`);
      return;
    }
    await request(`/workflows/${workflowId.value}`, { method: 'put', data: payload(apiJson) });
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
async function load() {
  if (isNew.value) return;
  const row = await request(`/workflows/${workflowId.value}`);
  name.value = row.name || '';
  category.value = row.category || 'text_to_image';
  suggestedVram.value = row.suggested_vram_gb ?? '';
  raw.value = JSON.stringify(row.api_json, null, 2);
}
watch(tab, value => {
  if (value !== 'preview') return;
  previewJson.value = parseRaw();
});
onMounted(load);
</script>

<style scoped>
.precheck-workflow-form { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 0 16px; }
.precheck-workflow-actions { margin-top: 12px; }
.precheck-workflow-check { margin-top: 16px; }
.precheck-module__hint { margin: 0 0 12px; color: #5c6b62; }
@media (max-width: 900px) {
  .precheck-workflow-form { grid-template-columns: 1fr; }
}
</style>
