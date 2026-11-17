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
            <el-form-item v-if="fpsTargets.length" class="precheck-workflow-steps" label="每秒帧数">
              <el-input-number v-model="fps" :min="1" :max="120" :step="1" :precision="0" :controls="false" @change="writeFps" />
              <p class="precheck-module__hint">写入成片节点的每秒帧数。预览里填写生成时间时，按这个数把秒数换成帧数。MiniMax H3 常用 24，Wan 常用 8。</p>
            </el-form-item>
            <el-form-item class="precheck-workflow-steps" label="双采">
              <div class="precheck-workflow-size">
                <el-switch v-model="dualSample" aria-label="开启双采" />
                <el-select v-if="dualSample" v-model="dualScale" style="width: 140px">
                  <el-option v-for="item in DUAL_SCALES" :key="item" :label="`${item} 倍`" :value="item" />
                </el-select>
              </div>
              <p class="precheck-module__hint">默认关闭。图片工作流开启后先采样，再按倍数放大潜空间并采样第二次。MiniMax H3 的采样画布有上限，第二次扩散不会把画面采得更大，开启后改为采样完成再按倍数放大成片画面。卡通生成视频走已保存的这份配置。</p>
            </el-form-item>
            <el-form-item class="precheck-workflow-steps" label="基础提示词规则">
              <el-input v-model="promptRule" type="textarea" :rows="4" placeholder="留空则不追加" />
              <p class="precheck-module__hint">有内容时，这条工作流每次生成都会把这段接在正向提示词末尾。画风仍拼在前面。留空就只提交原来的提示词。规则跟工作流走，换工作流或换模型时改这里，不用改项目。</p>
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
          <WorkflowPreview :workflow-id="workflowId" :api-json="previewJson" :refmod="name.includes('[RefMod]')" :dual-sample="dualSample" :dual-scale="dualScale" />
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
const fps = ref(24);
const promptRule = ref('');
const dualSample = ref(false);
const dualScale = ref(2);
const DUAL_SCALES = [ 1.5, 2, 2.5, 3 ];
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
function fpsTargetsOf(apiJson) {
  const found = [];
  if (!apiJson || typeof apiJson !== 'object' || Array.isArray(apiJson)) return found;
  Object.entries(apiJson).forEach(([id, node]) => {
    const inputs = node?.inputs;
    if (!inputs) return;
    [ 'fps', 'frame_rate' ].forEach(key => {
      if (typeof inputs[key] === 'number') found.push({ id, key, classType: node.class_type });
    });
  });
  const preferred = found.findIndex(item => item.classType === 'CreateVideo' || item.classType === 'SaveVideo');
  if (preferred > 0) {
    const [item] = found.splice(preferred, 1);
    found.unshift(item);
  }
  return found;
}
const fpsTargets = computed(() => fpsTargetsOf(parseRawQuiet()));
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
function syncFps() {
  const apiJson = parseRawQuiet();
  const target = fpsTargetsOf(apiJson)[0];
  if (!apiJson || !target) return;
  const value = apiJson[target.id].inputs[target.key];
  if (value !== fps.value) fps.value = value;
}
function writeFps(value) {
  const count = Number(value);
  const apiJson = parseRawQuiet();
  if (!apiJson || !Number.isFinite(count)) return;
  const targets = fpsTargetsOf(apiJson);
  if (!targets.length) return;
  targets.forEach(target => {
    apiJson[target.id].inputs[target.key] = count;
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
    prompt_rule: promptRule.value,
    dual_sample: dualSample.value,
    dual_scale: dualScale.value,
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
  promptRule.value = row.prompt_rule || '';
  dualSample.value = Boolean(row.dual_sample);
  dualScale.value = DUAL_SCALES.includes(Number(row.dual_scale)) ? Number(row.dual_scale) : 2;
  raw.value = JSON.stringify(row.api_json, null, 2);
  syncSteps();
  syncSize();
  syncFps();
}
watch(raw, syncFps);
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
