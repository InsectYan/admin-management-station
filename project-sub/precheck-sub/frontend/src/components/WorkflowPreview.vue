<template>
  <div>
    <el-empty v-if="!fields.length && loaded" description="这份工作流没有可改的提示词或尺寸参数，仍可直接生成" />
    <el-form v-else label-position="top" class="precheck-preview-form">
      <el-form-item
        v-for="field in fields"
        :key="field.id"
        :label="field.label"
        :class="{ 'precheck-preview-duration': field.type === 'duration' }"
      >
        <template v-if="field.type === 'duration'">
          <el-input-number
            v-model="field.value"
            :min="0.5"
            :max="20"
            :step="0.5"
            :precision="1"
            :controls="false"
            :value-on-clear="null"
            placeholder="留空沿用工作流帧数"
          />
          <p class="precheck-preview-hint">{{ durationHint(field) }}</p>
        </template>
        <el-input v-else-if="field.type === 'text'" v-model="field.value" type="textarea" :rows="3" />
        <el-input-number
          v-else-if="field.type === 'number'"
          v-model="field.value"
          :controls="false"
          :disabled="frameLocked(field)"
        />
        <el-input v-else v-model="field.value" />
      </el-form-item>
    </el-form>
    <el-button type="primary" :loading="running" :disabled="!apiJson" @click="generate">生成产物</el-button>
    <p v-if="notice" class="precheck-preview-note">{{ notice }}</p>
    <div v-if="preview && preview.status === 'success'" class="precheck-preview-media">
      <video v-if="preview.media_kind === 'video'" :src="fileUrl" controls></video>
      <img v-else :src="fileUrl" alt="最新预览产物" />
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { request, resolveApiBase } from '../services/apiConfig.js';

const props = defineProps({
  workflowId: { type: [String, Number], default: '' },
  apiJson: { type: Object, default: null },
});

const FRAME_KEYS = new Set([ 'length', 'frames', 'num_frames', 'frame_count' ]);
const fields = ref([]);
const loaded = ref(false);
const frameBackup = ref(null);
const running = ref(false);
const notice = ref('');
const preview = ref(null);
const fileUrl = ref('');
let timer = null;

function alignFrames(raw, align) {
  const count = Math.max(1, Math.round(Number(raw)));
  if (align === '4n1') return Math.max(1, 4 * Math.round((count - 1) / 4) + 1);
  if (align === '8n1') return Math.max(1, 8 * Math.round((count - 1) / 8) + 1);
  return count;
}
function frameAlign(classType) {
  if (/wan|hunyuan|mochi/i.test(classType || '')) return '4n1';
  if (/ltx/i.test(classType || '')) return '8n1';
  return 'round';
}
function durationField() {
  return fields.value.find(field => field.type === 'duration') || null;
}
function currentFps(fallback) {
  const rates = fields.value.filter(field => field.key === 'fps' || field.key === 'frame_rate');
  const preferred = rates.find(field => field.class_type === 'CreateVideo' || field.class_type === 'SaveVideo');
  const value = Number((preferred || rates[0])?.value);
  return Number.isFinite(value) && value > 0 ? value : (fallback || 16);
}
function durationHint(field) {
  const seconds = Number(field.value);
  const fps = currentFps(field.fps);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return `可选。留空则沿用工作流里的帧数，当前帧率 ${fps} fps。`;
  }
  const sample = fields.value.find(item => FRAME_KEYS.has(item.key));
  const frames = alignFrames(seconds * fps, sample ? frameAlign(sample.class_type) : field.align);
  const snap = field.align === '4n1' ? '，帧数取最接近的 4n+1' : '';
  return `将按 ${fps} fps 写成约 ${frames} 帧${snap}。`;
}
function frameLocked(field) {
  return FRAME_KEYS.has(field.key) && Number(durationField()?.value) > 0;
}
const durationWatch = computed(() => {
  const field = durationField();
  return `${field?.value ?? ''}|${currentFps(field?.fps)}`;
});
function syncFrames() {
  const field = durationField();
  const seconds = Number(field?.value);
  const active = Number.isFinite(seconds) && seconds > 0;
  const frameFields = fields.value.filter(item => FRAME_KEYS.has(item.key));
  if (!active) {
    if (frameBackup.value) {
      frameFields.forEach(item => {
        if (Object.prototype.hasOwnProperty.call(frameBackup.value, item.id)) item.value = frameBackup.value[item.id];
      });
      frameBackup.value = null;
    }
    return;
  }
  if (!frameBackup.value) {
    frameBackup.value = Object.fromEntries(frameFields.map(item => [ item.id, item.value ]));
  }
  const fps = currentFps(field.fps);
  frameFields.forEach(item => {
    item.value = alignFrames(seconds * fps, frameAlign(item.class_type));
  });
}
function draftKey() {
  const saved = sessionStorage.getItem('precheck-preview-draft');
  if (saved) return saved;
  const next = `draft${Date.now().toString(36)}`;
  sessionStorage.setItem('precheck-preview-draft', next);
  return next;
}
function statusPath() {
  return props.workflowId
    ? `/workflows/${props.workflowId}/preview`
    : `/workflows/drafts/${draftKey()}/preview`;
}
function mediaPath(stamp) {
  const base = props.workflowId
    ? `/workflows/${props.workflowId}/preview/file`
    : `/workflows/drafts/${draftKey()}/file`;
  return `${resolveApiBase()}${base}?t=${encodeURIComponent(stamp || '')}`;
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}
async function loadFields() {
  loaded.value = false;
  fields.value = [];
  if (!props.apiJson) return;
  try {
    frameBackup.value = null;
    fields.value = await request('/workflows/fields', { method: 'post', data: { api_json: props.apiJson } }) || [];
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loaded.value = true;
  }
}
async function refresh() {
  const state = await request(statusPath());
  preview.value = state;
  if (!state) return;
  if (state.status === 'success') {
    fileUrl.value = mediaPath(state.updated_at);
    notice.value = '已保留最新一次产物';
    running.value = false;
    stop();
  } else if (state.status === 'failed') {
    notice.value = state.error || '生成失败';
    running.value = false;
    stop();
  } else if (state.status === 'running') {
    notice.value = '正在生成，完成后只保留这一次的产物';
  }
}
async function generate() {
  if (!props.apiJson) return;
  running.value = true;
  notice.value = '已提交到 ComfyUI';
  try {
    const data = { values: fields.value, api_json: props.apiJson };
    if (props.workflowId) {
      await request(`/workflows/${props.workflowId}/preview`, { method: 'post', data });
    } else {
      await request(`/workflows/drafts/${draftKey()}/preview`, { method: 'post', data });
    }
    await refresh();
    stop();
    timer = setInterval(refresh, 2000);
  } catch (err) {
    notice.value = err.message;
    running.value = false;
  }
}

watch(durationWatch, () => { if (loaded.value) syncFrames(); });
watch(() => props.apiJson, () => { loadFields(); }, { immediate: true });
watch(() => props.workflowId, () => { if (props.workflowId) refresh().catch(() => {}); }, { immediate: true });
onUnmounted(stop);
</script>

<style scoped>
.precheck-preview-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.precheck-preview-duration { grid-column: 1 / -1; }
.precheck-preview-hint { margin: 6px 0 0; color: #5c6b62; font-size: 13px; }
.precheck-preview-note { color: #5c6b62; }
.precheck-preview-media img,
.precheck-preview-media video { max-width: 480px; display: block; margin-top: 12px; }
@media (max-width: 800px) {
  .precheck-preview-form { grid-template-columns: 1fr; }
}
</style>
