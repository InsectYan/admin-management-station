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
            <el-form-item v-if="showSize" class="precheck-workflow-steps" label="出图尺寸">
              <div class="precheck-workflow-size">
                <el-input-number v-model="width" :min="64" :max="4096" :step="32" :controls="false" @change="writeSize" />
                <span>×</span>
                <el-input-number v-model="height" :min="64" :max="4096" :step="32" :controls="false" @change="writeSize" />
              </div>
              <p class="precheck-module__hint">宽和高分开记在工作流里。封面可以用 768×1024，横版视频可以用 1344×768。Qwen-Image 2.1 按这里的宽高出图，参考图仍按较长边缩放。MiniMax 会把画面收到短边约 768、总像素不超过 768×1344，并按 32 对齐。</p>
            </el-form-item>
            <el-form-item v-if="stepNodeIds.length" class="precheck-workflow-steps" label="默认步数">
              <el-input-number v-model="steps" :min="1" :max="50" :step="1" :controls="false" @change="writeSteps" />
              <p class="precheck-module__hint">写入采样器的 steps。Z-Image Turbo 和 Qwen-Image 2.1 Turbo 用 8 步，Qwen-Image 2.1 用 25 步。预览里还可以临时改这一次的步数。</p>
            </el-form-item>
            <div v-if="slots.length" class="precheck-workflow-models">
              <p class="precheck-module__hint">模型来自当前 ComfyUI 已加载的列表。有子目录时逐级选到文件。改完后点保存，工作流才换成新模型。</p>
              <el-form-item v-for="slot in slots" :key="`${slot.id}:${slot.key}`" :label="slotLabel(slot)">
                <ModelCascader :folder="slot.folder" :model-value="slot.value" @update:model-value="value => writeModel(slot, value)" />
              </el-form-item>
            </div>
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
          <p class="precheck-module__hint">改提示词、宽高或时长。每次生成都会留下一条，可以删除。</p>
          <WorkflowPreview :workflow-id="workflowId" :api-json="previewJson" :refmod="name.includes('[RefMod]')" />
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
import ModelCascader from '../components/ModelCascader.vue';
import { request } from '../services/apiConfig.js';
import { WORKFLOW_CATEGORIES } from '../lib/workflowCategory.js';
import { FOLDER_LABEL, modelSlots } from '../lib/modelFolders.js';

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
const steps = ref(8);
const width = ref(1024);
const height = ref(1024);
const SIZE_CATEGORIES = new Set([ 'text_to_image', 'image_edit', 'text_to_video', 'image_to_video' ]);

function sizeTargets(apiJson) {
  const widthIds = [];
  const heightIds = [];
  const resolutionIds = [];
  if (!apiJson || typeof apiJson !== 'object' || Array.isArray(apiJson)) {
    return { widthIds, heightIds, resolutionIds, width: null, height: null };
  }
  let foundWidth = null;
  let foundHeight = null;
  let foundResolution = null;
  Object.entries(apiJson).forEach(([ id, node ]) => {
    const inputs = node?.inputs;
    if (!inputs) return;
    if (typeof inputs.width === 'number') {
      widthIds.push(id);
      if (foundWidth == null) foundWidth = inputs.width;
    }
    if (typeof inputs.height === 'number') {
      heightIds.push(id);
      if (foundHeight == null) foundHeight = inputs.height;
    }
    if (typeof inputs.resolution === 'number') {
      resolutionIds.push(id);
      if (foundResolution == null) foundResolution = inputs.resolution;
    }
  });
  return {
    widthIds,
    heightIds,
    resolutionIds,
    width: foundWidth ?? foundResolution,
    height: foundHeight ?? foundResolution,
  };
}
const showSize = computed(() => {
  const size = sizeTargets(parseRawQuiet());
  return SIZE_CATEGORIES.has(category.value) || size.width != null || size.height != null;
});

function stepNodeIdsOf(apiJson) {
  if (!apiJson || typeof apiJson !== 'object' || Array.isArray(apiJson)) return [];
  return Object.entries(apiJson)
    .filter(([, node]) => node?.inputs && typeof node.inputs.steps === 'number')
    .map(([id]) => id);
}
const stepNodeIds = computed(() => stepNodeIdsOf(parseRawQuiet()));
const slots = computed(() => modelSlots(parseRawQuiet()));
function slotLabel(slot) {
  const title = FOLDER_LABEL[slot.folder] || slot.folder;
  const same = slots.value.filter(item => item.folder === slot.folder).length;
  return same > 1 ? `${title}（节点 ${slot.id}）` : title;
}
function writeModel(slot, value) {
  if (typeof value !== 'string' || !value || value === slot.value) return;
  const apiJson = parseRawQuiet();
  if (!apiJson?.[slot.id]?.inputs) return;
  apiJson[slot.id].inputs[slot.key] = value;
  raw.value = JSON.stringify(apiJson, null, 2);
}
function parseRawQuiet() {
  try {
    return JSON.parse(raw.value);
  } catch {
    return null;
  }
}
function syncSteps() {
  const apiJson = parseRawQuiet();
  const id = stepNodeIdsOf(apiJson)[0];
  if (!apiJson || !id) return;
  steps.value = apiJson[id].inputs.steps;
}
function syncSize() {
  const size = sizeTargets(parseRawQuiet());
  if (size.width != null) width.value = size.width;
  if (size.height != null) height.value = size.height;
}
function writeSize() {
  const nextWidth = Number(width.value);
  const nextHeight = Number(height.value);
  const apiJson = parseRawQuiet();
  if (!apiJson || !Number.isFinite(nextWidth) || !Number.isFinite(nextHeight)) return;
  const size = sizeTargets(apiJson);
  size.widthIds.forEach(id => {
    apiJson[id].inputs.width = nextWidth;
  });
  size.heightIds.forEach(id => {
    apiJson[id].inputs.height = nextHeight;
  });
  size.resolutionIds.forEach(id => {
    const inputs = apiJson[id].inputs;
    if (typeof inputs.width !== 'number') inputs.width = nextWidth;
    if (typeof inputs.height !== 'number') inputs.height = nextHeight;
    inputs.resolution = Math.max(nextWidth, nextHeight);
  });
  raw.value = JSON.stringify(apiJson, null, 2);
}
function writeSteps(value) {
  const count = Number(value);
  const apiJson = parseRawQuiet();
  if (!apiJson || !Number.isFinite(count)) return;
  const ids = stepNodeIdsOf(apiJson);
  if (!ids.length) return;
  ids.forEach(id => {
    apiJson[id].inputs.steps = count;
  });
  raw.value = JSON.stringify(apiJson, null, 2);
}
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
  syncSteps();
  syncSize();
}
watch(tab, value => {
  if (value !== 'preview') return;
  previewJson.value = parseRaw();
});
onMounted(load);
</script>

<style scoped>
.precheck-workflow-form { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 0 16px; }
.precheck-workflow-steps { grid-column: 1 / -1; }
.precheck-workflow-steps .precheck-module__hint { margin: 6px 0 0; }
.precheck-workflow-size { display: flex; align-items: center; gap: 8px; }
.precheck-workflow-models { grid-column: 1 / -1; }
.precheck-workflow-models .precheck-module__hint { margin: 0 0 8px; }
.precheck-workflow-actions { margin-top: 12px; }
.precheck-workflow-check { margin-top: 16px; }
.precheck-module__hint { margin: 0 0 12px; color: #5c6b62; }
@media (max-width: 900px) {
  .precheck-workflow-form { grid-template-columns: 1fr; }
}
</style>
