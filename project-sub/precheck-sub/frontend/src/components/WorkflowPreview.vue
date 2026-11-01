<template>
  <div>
    <el-empty v-if="!fields.length && loaded" description="这份工作流没有可改的提示词或尺寸参数，仍可直接生成" />
    <el-form v-else label-position="top" class="precheck-preview-form">
      <el-form-item v-if="refmod" class="precheck-preview-duration" label="检测包">
        <el-select v-model="refmodIds" multiple placeholder="选择人物或场景" style="width: 100%">
          <el-option-group label="人物">
            <el-option v-for="pack in characterPacks" :key="pack.id" :label="`${pack.name}（${pack.image_count} 张）`" :value="pack.id" />
          </el-option-group>
          <el-option-group label="场景">
            <el-option v-for="pack in scenePacks" :key="pack.id" :label="`${pack.name}（${pack.image_count} 张）`" :value="pack.id" />
          </el-option-group>
        </el-select>
        <p class="precheck-preview-hint">按选择顺序对应 &lt;Picture 1&gt;、&lt;Picture 2&gt;。人物和场景可以一起选，总共不超过 9 张图。这里用的是预检检测包。首尾帧工作流不使用这个包。</p>
      </el-form-item>
      <el-form-item
        v-for="field in fields"
        :key="field.id"
        :label="field.label"
        :class="{ 'precheck-preview-duration': field.type === 'duration' || field.type === 'image' }"
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
        <template v-else-if="field.type === 'image'">
          <div class="precheck-image-field">
            <el-upload
              :key="field.id"
              v-model:file-list="imageLists[field.id]"
              class="precheck-image-upload"
              action="#"
              list-type="picture"
              accept="image/png,image/jpeg,image/webp"
              :auto-upload="false"
              :limit="1"
              :on-change="file => onImage(field, file)"
              :on-remove="() => clearImage(field)"
              :on-exceed="files => replaceImage(field, files)"
            >
              <el-button type="primary" plain>选择图片</el-button>
            </el-upload>
            <p class="precheck-preview-hint">{{ field.spec }}</p>
          </div>
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
    <el-button type="primary" :loading="submitting" :disabled="!apiJson" @click="generate">生成产物</el-button>
    <div v-if="preview && preview.status === 'running'" class="precheck-preview-progress">
      <el-progress :percentage="preview.progress_percent || 0" :stroke-width="8" color="#2f8a5b" />
      <p class="precheck-preview-note">{{ progressText }}</p>
    </div>
    <ul v-if="preview?.submitted?.length" class="precheck-preview-submitted">
      <li v-for="item in preview.submitted" :key="item.label">{{ item.label }}：{{ item.text }}</li>
    </ul>
    <p v-if="notice" class="precheck-preview-note">{{ notice }}</p>
    <div v-if="runs.length" class="precheck-preview-list">
      <article v-for="item in runs" :key="item.id" class="precheck-preview-card">
        <MediaFileList v-if="item.status === 'success'" :items="[mediaItem(item)]" @remove="removeRun" />
        <template v-else>
          <p>{{ runLabel(item) }}</p>
          <el-progress v-if="item.status === 'running'" :percentage="item.progress_percent || 0" :stroke-width="8" color="#2f8a5b" />
          <p v-if="item.status === 'running'">{{ runProgress(item) }}</p>
          <p v-if="item.error">{{ item.error }}</p>
          <el-button v-if="item.status !== 'running'" link type="danger" @click="removeRun(item)">删除</el-button>
        </template>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import MediaFileList from './MediaFileList.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';

const props = defineProps({
  workflowId: { type: [String, Number], default: '' },
  apiJson: { type: Object, default: null },
  refmod: { type: Boolean, default: false },
});

const FRAME_KEYS = new Set([ 'length', 'frames', 'num_frames', 'frame_count' ]);
const IMAGE_TYPES = new Set([ 'image/png', 'image/jpeg', 'image/webp' ]);
const fields = ref([]);
const packs = ref([]);
const characterPacks = computed(() => packs.value.filter(item => item.kind !== 'scene'));
const scenePacks = computed(() => packs.value.filter(item => item.kind === 'scene'));
const refmodIds = ref([]);
const imageLists = reactive({});
const loaded = ref(false);
const frameBackup = ref(null);
const running = ref(false);
const submitting = ref(false);
const notice = ref('');
const preview = ref(null);
const runs = ref([]);
let timer = null;

const progressText = computed(() => {
  const state = preview.value;
  if (!state || state.status !== 'running') return '';
  if (state.phase === 'queued') {
    return state.queue_ahead > 0
      ? `已离开页面也会继续生成。当前在排队，前面还有 ${state.queue_ahead} 个。`
      : '已离开页面也会继续生成。当前在排队。';
  }
  const node = state.node ? `节点 ${state.node}` : 'ComfyUI';
  if (state.progress_max > 0) {
    return `正在生成，离开页面不会中断。${node} ${state.progress_value}/${state.progress_max}`;
  }
  return `正在生成，离开页面不会中断。${node} 还没有回报节点进度。`;
});

function alignFrames(raw, align) {
  const count = Math.max(1, Math.round(Number(raw)));
  if (align === '4n1') return Math.max(1, 4 * Math.round((count - 1) / 4) + 1);
  if (align === '8n1') return Math.max(1, 8 * Math.round((count - 1) / 8) + 1);
  if (align === '17k5') {
    let frames = Math.max(5, count);
    while (frames % 17 !== 5) frames += 1;
    return frames;
  }
  return count;
}
function frameAlign(classType) {
  if (/minimax/i.test(classType || '')) return '17k5';
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
  const snap = field.align === '4n1'
    ? '，帧数取最接近的 4n+1'
    : field.align === '17k5'
      ? '，帧数向上对齐到 17k+5'
      : '';
  return `将按 ${fps} fps 写成约 ${frames} 帧${snap}。`;
}
function syncImageLists(next) {
  const ids = new Set((next || []).filter(field => field.type === 'image').map(field => field.id));
  Object.keys(imageLists).forEach(key => {
    if (!ids.has(key)) delete imageLists[key];
  });
  ids.forEach(id => {
    if (!imageLists[id]) imageLists[id] = [];
  });
}
function readImage(field, file) {
  if (!file) return;
  if (file.type && !IMAGE_TYPES.has(file.type)) {
    ElMessage.warning('请上传 png、jpg 或 webp');
    imageLists[field.id] = [];
    clearImage(field);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    field.filename = file.name;
    field.data = String(reader.result || '');
  };
  reader.readAsDataURL(file);
}
function onImage(field, uploadFile) {
  readImage(field, uploadFile?.raw);
}
function clearImage(field) {
  field.filename = '';
  field.data = '';
}
function replaceImage(field, files) {
  const file = files?.[0];
  if (!file) return;
  imageLists[field.id] = [{
    name: file.name,
    url: URL.createObjectURL(file),
    status: 'ready',
    uid: Date.now(),
    raw: file,
  }];
  readImage(field, file);
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
function mediaPath(item) {
  const stamp = item?.updated_at || item?.id || '';
  const base = props.workflowId
    ? `/workflows/${props.workflowId}/preview/file`
    : `/workflows/drafts/${draftKey()}/file`;
  return `${resolveApiBase()}${base}?run=${encodeURIComponent(item?.id || '')}&t=${encodeURIComponent(stamp)}`;
}
function mediaItem(item) {
  return {
    id: item.id,
    url: mediaPath(item),
    kind: item.media_kind === 'video' ? 'video' : 'image',
    name: runLabel(item),
  };
}
function runProgress(item) {
  if (item.phase === 'queued') {
    return item.queue_ahead > 0 ? `排队，前面还有 ${item.queue_ahead} 个` : '排队中';
  }
  if (item.progress_max > 0) {
    const node = item.node ? `节点 ${item.node} ` : '';
    return `${node}${item.progress_value}/${item.progress_max}`;
  }
  return '正在生成，等待 ComfyUI 回报步数';
}
function runLabel(item) {
  const status = { queued: '排队', running: '生成中', success: '成功', failed: '失败' }[item.status] || item.status;
  const when = item.created_at ? item.created_at.replace('T', ' ').slice(0, 16) : '';
  return [ status, when ].filter(Boolean).join(' · ');
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}
function follow(state) {
  if (state?.status !== 'running') return;
  running.value = true;
  if (timer) return;
  timer = setInterval(() => { refresh().catch(() => {}); }, 1000);
}
async function loadFields() {
  loaded.value = false;
  fields.value = [];
  if (!props.apiJson) return;
  try {
    frameBackup.value = null;
    const next = await request('/workflows/fields', { method: 'post', data: { api_json: props.apiJson } }) || [];
    syncImageLists(next);
    fields.value = next;
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loaded.value = true;
  }
}
async function refresh() {
  const state = await request(statusPath());
  const list = Array.isArray(state?.runs) ? state.runs : (state?.status ? [ state ] : []);
  runs.value = list;
  const active = list.find(item => item.status === 'running') || null;
  preview.value = active;
  if (!list.length) {
    running.value = false;
    stop();
    return;
  }
  if (active) {
    notice.value = active.phase === 'queued' ? '已提交，正在排队' : '正在生成，完成后会留在下面的列表里';
    follow(active);
    return;
  }
  running.value = false;
  stop();
  const failed = list[0]?.status === 'failed' ? list[0] : null;
  notice.value = failed ? (failed.error || '生成失败') : '每次生成都会留下一条，可以删除';
}
async function removeRun(item) {
  await ElMessageBox.confirm('删除这条产物？', '删除产物', { type: 'warning' });
  const path = props.workflowId
    ? `/workflows/${props.workflowId}/preview/${item.id}`
    : `/workflows/drafts/${draftKey()}/preview/${item.id}`;
  await request(path, { method: 'delete' });
  await refresh();
}
async function generate() {
  if (!props.apiJson) return;
  if (props.refmod && !refmodIds.value.length) {
    ElMessage.error('请选择至少一个包');
    return;
  }
  const missing = fields.value.filter(field => field.type === 'image' && !field.data);
  if (missing.length) {
    ElMessage.error(`请上传${missing.map(field => field.label).join('、')}`);
    return;
  }
  submitting.value = true;
  notice.value = '已提交到 ComfyUI';
  try {
    const data = { values: fields.value, api_json: props.apiJson, refmod_ids: refmodIds.value };
    const saved = props.workflowId
      ? await request(`/workflows/${props.workflowId}/preview`, { method: 'post', data })
      : await request(`/workflows/drafts/${draftKey()}/preview`, { method: 'post', data });
    if (Array.isArray(saved?.runs)) {
      runs.value = saved.runs;
      preview.value = saved.runs.find(item => item.status === 'running') || null;
    }
    running.value = true;
    await refresh();
    follow(preview.value);
  } catch (err) {
    notice.value = err.message;
    running.value = false;
  } finally {
    submitting.value = false;
  }
}

watch(durationWatch, () => { if (loaded.value) syncFrames(); });
watch(() => props.apiJson, () => { loadFields(); }, { immediate: true });
watch(() => props.refmod, async enabled => {
  if (!enabled) return;
  packs.value = await request('/refmods') || [];
}, { immediate: true });
watch(() => props.workflowId, () => { refresh().catch(() => {}); }, { immediate: true });
onUnmounted(stop);
</script>

<style scoped>
.precheck-preview-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.precheck-preview-duration { grid-column: 1 / -1; }
.precheck-image-field { width: 100%; max-width: 420px; }
.precheck-image-upload { display: block; }
.precheck-image-upload :deep(.el-upload-list--picture .el-upload-list__item) {
  border-radius: 10px;
  border-color: rgba(47, 138, 91, 0.16);
}
.precheck-preview-hint { margin: 6px 0 0; color: #5c6b62; font-size: 13px; }
.precheck-preview-progress { max-width: 420px; margin-top: 12px; }
.precheck-preview-submitted { margin: 8px 0 0; padding-left: 18px; color: #5c6b62; font-size: 13px; }
.precheck-preview-note { color: #5c6b62; }
.precheck-preview-list { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; margin-top: 12px; }
.precheck-preview-card { width: 220px; }
@media (max-width: 800px) {
  .precheck-preview-form { grid-template-columns: 1fr; }
}
</style>
