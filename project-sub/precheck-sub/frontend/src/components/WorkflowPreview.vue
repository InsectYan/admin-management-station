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
        <p class="precheck-preview-hint">按选择顺序对应 &lt;Picture 1&gt;、&lt;Picture 2&gt;。人物和场景可以一起选。也可以不选包，直接上传最多 9 张参考图。总共不超过 9 张。首尾帧工作流不使用这个包。</p>
        <el-upload
          v-model:file-list="refFileList"
          class="precheck-image-upload"
          action="#"
          list-type="picture"
          multiple
          accept="image/png,image/jpeg,image/webp"
          :auto-upload="false"
          :limit="9"
          :on-change="onRefImages"
          :on-remove="onRefImages"
        >
          <el-button type="primary" plain>上传参考图</el-button>
        </el-upload>
      </el-form-item>
      <template v-for="field in fields" :key="field.id">
      <el-form-item
        :label="field.label"
        :class="{ 'precheck-preview-duration': field.type === 'duration' || field.type === 'image' || field.type === 'video' || (imageBatchable && isSeedField(field)) }"
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
        <template v-else-if="field.type === 'image' || field.type === 'video'">
          <div class="precheck-image-field">
            <el-upload
              :key="field.id"
              v-model:file-list="imageLists[field.id]"
              class="precheck-image-upload"
              action="#"
              :list-type="field.type === 'video' ? 'text' : 'picture'"
              :accept="field.type === 'video' ? 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov' : 'image/png,image/jpeg,image/webp'"
              :auto-upload="false"
              :multiple="(field.limit || 1) > 1"
              :limit="field.limit || 1"
              :on-change="(file, files) => onImage(field, file, files)"
              :on-remove="(file, files) => onImage(field, file, files)"
              :on-exceed="files => onImageExceed(field, files)"
            >
              <el-button type="primary" plain>{{ field.type === 'video' ? '选择视频' : '选择图片' }}</el-button>
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
          :placeholder="imageBatchable && isSeedField(field) ? '留空则按批次自动生成' : ''"
          :value-on-clear="imageBatchable && isSeedField(field) ? null : undefined"
          @change="imageBatchable && isSeedField(field) ? clearShownSeeds() : undefined"
        />
        <el-input v-else v-model="field.value" />
        <div v-if="imageBatchable && field.id === primarySeedId && shownSeeds.length" class="precheck-preview-seeds">
          <span v-for="(code, index) in shownSeeds" :key="`${code}-${index}`" class="precheck-preview-seed">{{ shownSeeds.length > 1 ? `第 ${index + 1} 张 ` : '' }}{{ code }}</span>
        </div>
      </el-form-item>
      <el-form-item v-if="imageBatchable && field.id === primarySeedId" class="precheck-preview-duration" label="批次">
        <el-input-number
          v-model="batchCount"
          :min="1"
          :max="seedFilled ? 1 : BATCH_MAX"
          :step="1"
          :precision="0"
          :value-on-clear="1"
          @change="clearShownSeeds"
        />
        <p class="precheck-preview-hint">{{ seedFilled ? '种子已填写，这次只出 1 张。' : `一次出这么多张，最多 ${BATCH_MAX} 张。每张图单独排队，所以一次最多提交 8 张；模型本身不限制张数。种子留空时，每张使用各自的 8 到 10 位种子。` }}</p>
      </el-form-item>
      </template>
    </el-form>
    <div class="precheck-preview-actions">
      <el-button type="primary" :loading="submitting" :disabled="!apiJson || stopping" @click="generate">生成产物</el-button>
      <el-button :disabled="!canClear || clearing" :loading="clearing" @click="clearRuns">清空产物</el-button>
      <el-button v-if="submitting || hasRunning" type="danger" plain :loading="stopping" @click="stopWork">停止</el-button>
    </div>
    <div v-if="preview && preview.status === 'running'" class="precheck-preview-progress">
      <el-progress :percentage="barPercent(preview)" :indeterminate="barWaiting(preview)" :stroke-width="8" color="#2f8a5b" />
      <p class="precheck-preview-note">{{ progressText }}</p>
    </div>
    <ul v-if="preview?.submitted?.length" class="precheck-preview-submitted">
      <li v-for="item in preview.submitted" :key="item.label">{{ item.label }}：{{ item.text }}</li>
    </ul>
    <p v-if="notice" class="precheck-preview-note">{{ notice }}</p>
    <div v-if="runs.length" class="precheck-preview-wrap">
    <div class="precheck-preview-list" :class="{ 'is-single': mediaCardCount <= 1 }">
      <el-card
        v-for="item in runs"
        :key="item.id"
        shadow="never"
        class="precheck-preview-card"
        :class="{ 'precheck-preview-card-text': item.media_kind === 'text' }"
      >
        <div class="precheck-preview-card__head">
          <p>
            <span v-if="item.seed">种子 {{ item.seed }} · </span>{{ runLabel(item) }}
          </p>
        </div>
        <el-progress
          v-if="item.status === 'running'"
          :percentage="barPercent(item)"
          :indeterminate="barWaiting(item)"
          :stroke-width="8"
          color="#2f8a5b"
        />
        <p v-if="item.status === 'running'" class="precheck-preview-hint">{{ runProgress(item) }}</p>
        <p v-if="item.status === 'cancelled'" class="precheck-preview-note">已停止</p>
        <p v-else-if="item.error" class="precheck-preview-error">{{ item.error }}</p>
        <p v-if="item.status === 'success' && item.caption" class="precheck-caption">{{ item.caption }}</p>
        <div v-if="item.status === 'success' && item.media_kind !== 'text'" class="precheck-preview-media">
          <MediaFileList :items="[mediaItem(item)]" :show-name="false" @remove="removeRun" />
        </div>
      </el-card>
    </div>
    </div>
    <ol v-if="framePacks.length" class="precheck-frame-packs">
      <li v-for="item in framePacks" :key="item.id">
        <span>{{ runLabel(item) }}<template v-if="item.frame_count"> · {{ item.frame_count }} 帧</template></span>
        <el-button type="primary" plain size="small" @click="downloadFrames(item)">下载帧压缩包</el-button>
      </li>
    </ol>
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
const BATCH_MAX = 8;
const IMAGE_TYPES = new Set([ 'image/png', 'image/jpeg', 'image/webp' ]);
const VIDEO_TYPES = new Set([ 'video/mp4', 'video/webm', 'video/quicktime' ]);
const fields = ref([]);
const packs = ref([]);
const characterPacks = computed(() => packs.value.filter(item => item.kind !== 'scene'));
const scenePacks = computed(() => packs.value.filter(item => item.kind === 'scene'));
const refmodIds = ref([]);
const refFileList = ref([]);
const refImages = ref([]);
const imageLists = reactive({});
const loaded = ref(false);
const frameBackup = ref(null);
const running = ref(false);
const submitting = ref(false);
const stopping = ref(false);
const clearing = ref(false);
const notice = ref('');
const preview = ref(null);
const runs = ref([]);
const framePacks = computed(() => runs.value.filter(item => item.status === 'success' && item.media_kind === 'video' && item.zip_name));
const mediaCardCount = computed(() => runs.value.filter(item => item.media_kind !== 'text').length);
const hasRunning = computed(() => runs.value.some(item => item.status === 'running'));
const canClear = computed(() => runs.value.some(item => item.status !== 'running'));
const batchCount = ref(1);
const shownSeeds = ref([]);
const imageBatchable = computed(() => imageWorkflow(props.apiJson));
const primarySeedId = computed(() => fields.value.find(field => field.key === 'seed' || field.key === 'noise_seed')?.id || '');
const seedFilled = computed(() => {
  const field = fields.value.find(item => item.id === primarySeedId.value);
  return field != null && field.value != null && field.value !== '' && Number.isFinite(Number(field.value));
});
let timer = null;

function isSeedField(field) {
  return field?.key === 'seed' || field?.key === 'noise_seed';
}
function imageWorkflow(graph) {
  const nodes = Object.values(graph || {});
  const video = nodes.some(node => {
    const name = String(node?.class_type || '');
    if (!name || name === 'LoadVideo' || name === 'GetVideoComponents') return false;
    if (/video|(?:^|[^a-z])wan|vhs_|svd|hunyuan|ltxv|animatediff|mochi/i.test(name)) return true;
    const inputs = node?.inputs || {};
    return [ 'length', 'frames', 'num_frames', 'frame_count', 'fps', 'frame_rate' ].some(key => {
      const value = inputs[key];
      return value != null && !Array.isArray(value) && typeof value !== 'object';
    });
  });
  if (video) return false;
  if (nodes.some(node => /AILab_QwenVL|^JC$|Florence2|WD14Tagger/i.test(String(node?.class_type || '')))) return false;
  return nodes.some(node => node?.class_type === 'SaveImage' || node?.class_type === 'PreviewImage');
}
function clearShownSeeds() {
  shownSeeds.value = [];
}
function makeSeeds(count) {
  const used = new Set();
  const list = [];
  while (list.length < count) {
    const digits = 8 + Math.floor(Math.random() * 3);
    const min = 10 ** (digits - 1);
    const value = min + Math.floor(Math.random() * ((10 ** digits) - min));
    if (used.has(value)) continue;
    used.add(value);
    list.push(value);
  }
  return list;
}

const progressText = computed(() => {
  const state = preview.value;
  if (!state || state.status !== 'running') return '';
  if (state.phase === 'frames') return '视频已经生成，正在导出全部帧并打包。离开页面不会中断。';
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
  const ids = new Set((next || []).filter(field => field.type === 'image' || field.type === 'video').map(field => field.id));
  Object.keys(imageLists).forEach(key => {
    if (!ids.has(key)) delete imageLists[key];
  });
  ids.forEach(id => {
    if (!imageLists[id]) imageLists[id] = [];
  });
}
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, data: String(reader.result || '') });
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}
function acceptedMedia(field, files) {
  const video = field?.type === 'video';
  const types = video ? VIDEO_TYPES : IMAGE_TYPES;
  const names = video ? /\.(mp4|webm|mov)$/i : /\.(png|jpe?g|webp)$/i;
  return (files || []).map(item => item.raw || item).filter(file => file && (types.has(file.type) || names.test(file.name || '')));
}
async function rememberImages(target, files) {
  const accepted = acceptedMedia(target, files);
  if ((files || []).length && !accepted.length) {
    ElMessage.warning(target?.type === 'video' ? '请上传 mp4、webm 或 mov' : '请上传 png、jpg 或 webp');
  }
  const ready = [];
  for (const file of accepted) ready.push(await readFile(file));
  target.files = ready;
  target.filename = ready.map(item => item.filename).join('、');
  target.data = ready[0]?.data || '';
}
function onImage(field, uploadFile, uploadFiles) {
  const list = uploadFiles || (uploadFile ? [ uploadFile ] : []);
  rememberImages(field, list).catch(err => ElMessage.error(err.message));
}
function clearImage(field) {
  field.filename = '';
  field.data = '';
  field.files = [];
}
async function onRefImages(uploadFile, uploadFiles) {
  const holder = { files: [], filename: '', data: '' };
  await rememberImages(holder, uploadFiles || (uploadFile ? [ uploadFile ] : []));
  refImages.value = holder.files;
}
function onImageExceed(field, files) {
  if ((field.limit || 1) <= 1) {
    replaceImage(field, files);
    return;
  }
  ElMessage.warning(field.type === 'video' ? `最多 ${field.limit} 个视频` : `最多 ${field.limit} 张`);
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
async function downloadFrames(item) {
  const base = props.workflowId
    ? `/workflows/${props.workflowId}/preview/frames`
    : `/workflows/drafts/${draftKey()}/frames`;
  const url = `${resolveApiBase()}${base}?run=${encodeURIComponent(item.id)}`;
  const res = await fetch(url);
  if (!res.ok) {
    ElMessage.error('下载帧压缩包失败');
    return;
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = String(item.created_at || item.id).replace(/[^\d]/g, '').slice(0, 12) || item.id;
  link.href = objectUrl;
  link.download = `frames-${stamp}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
function barPercent(item) {
  if (!item || item.status !== 'running') return 0;
  if (item.phase === 'frames') return 100;
  return Number(item.progress_percent) || 0;
}
function barWaiting(item) {
  return item?.status === 'running' && item.phase !== 'frames' && !(Number(item.progress_max) > 0);
}
function runProgress(item) {
  if (item.phase === 'frames') return '正在导出全部帧并打包';
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
  const status = { queued: '排队', running: '生成中', success: '成功', failed: '失败', cancelled: '已停止' }[item.status] || item.status;
  const when = item.created_at ? item.created_at.replace('T', ' ').slice(0, 16) : '';
  return [ status, when ].filter(Boolean).join(' · ');
}
function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}
async function stopWork() {
  if (stopping.value) return;
  stopping.value = true;
  try {
    const path = props.workflowId
      ? `/workflows/${props.workflowId}/preview/stop`
      : `/workflows/drafts/${draftKey()}/preview/stop`;
    const saved = await request(path, { method: 'post' });
    if (Array.isArray(saved?.runs)) runs.value = saved.runs;
    notice.value = '已停止';
    await refresh();
    if (!hasRunning.value) notice.value = '已停止';
  } catch (err) {
    notice.value = err.message;
  } finally {
    stopping.value = false;
  }
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
    if (imageWorkflow(props.apiJson)) {
      next.forEach(field => {
        if (isSeedField(field)) field.value = null;
      });
    }
    batchCount.value = 1;
    shownSeeds.value = [];
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
    notice.value = active.phase === 'queued'
      ? '已提交，正在排队'
      : active.phase === 'frames'
        ? '视频已经生成，正在导出全部帧并打包'
        : '正在生成，完成后会留在下面的列表里';
    follow(active);
    return;
  }
  running.value = false;
  stop();
  if (list[0]?.status === 'cancelled') notice.value = '已停止';
  else {
    const failed = list[0]?.status === 'failed' ? list[0] : null;
    notice.value = failed ? (failed.error || '生成失败') : '每次生成都会留下一条，可以删除';
  }
}
async function removeRun(item) {
  await ElMessageBox.confirm('删除这条产物？', '删除产物', { type: 'warning' });
  const path = props.workflowId
    ? `/workflows/${props.workflowId}/preview/${item.id}`
    : `/workflows/drafts/${draftKey()}/preview/${item.id}`;
  await request(path, { method: 'delete' });
  await refresh();
}
async function clearRuns() {
  if (!canClear.value || clearing.value) return;
  const kept = hasRunning.value;
  try {
    await ElMessageBox.confirm(
      kept ? '清空已经结束的产物？正在生成的会保留。' : '清空这个工作流下的全部产物？',
      '清空产物',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  clearing.value = true;
  try {
    const path = props.workflowId
      ? `/workflows/${props.workflowId}/preview`
      : `/workflows/drafts/${draftKey()}/preview`;
    const saved = await request(path, { method: 'delete' });
    if (Array.isArray(saved?.runs)) runs.value = saved.runs;
    await refresh();
    notice.value = kept ? '已清空结束的产物' : '已清空产物';
  } catch (err) {
    notice.value = err.message;
  } finally {
    clearing.value = false;
  }
}
async function generate() {
  if (!props.apiJson) return;
  if (props.refmod && !refmodIds.value.length && !refImages.value.length) {
    ElMessage.error('请选择检测包或上传参考图');
    return;
  }
  const missing = fields.value.filter(field => (field.type === 'image' || field.type === 'video') && !field.optional && !field.data && !(field.files || []).length);
  if (missing.length) {
    ElMessage.error(`请上传${missing.map(field => field.label).join('、')}`);
    return;
  }
  let seeds = [];
  if (imageBatchable.value) {
    const count = Math.min(BATCH_MAX, Math.max(1, Math.round(Number(batchCount.value) || 1)));
    if (seedFilled.value) {
      if (count > 1) {
        batchCount.value = 1;
        ElMessage.error('填写了种子时批次只能为 1');
        return;
      }
      const manual = Math.round(Number(fields.value.find(item => item.id === primarySeedId.value)?.value));
      if (!Number.isSafeInteger(manual) || manual < 0) {
        ElMessage.error('种子需要是非负整数');
        return;
      }
      seeds = [ manual ];
    } else {
      batchCount.value = count;
      seeds = makeSeeds(count);
    }
    shownSeeds.value = seeds.slice();
  }
  submitting.value = true;
  notice.value = '已提交到 ComfyUI';
  try {
    const data = {
      values: fields.value,
      api_json: props.apiJson,
      refmod_ids: refmodIds.value,
      ref_images: refImages.value,
      batch: seeds.length || 1,
      seeds,
    };
    const saved = props.workflowId
      ? await request(`/workflows/${props.workflowId}/preview`, { method: 'post', data })
      : await request(`/workflows/drafts/${draftKey()}/preview`, { method: 'post', data });
    if (Array.isArray(saved?.seeds) && saved.seeds.length) shownSeeds.value = saved.seeds;
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

watch(seedFilled, filled => { if (filled) batchCount.value = 1; });
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
.precheck-preview-seeds { display: flex; flex-flow: row wrap; gap: 8px; margin: 8px 0 0 8px; }
.precheck-preview-seed { padding: 2px 10px; border-radius: 999px; background: #e7f3ec; color: #243028; font-size: 13px; line-height: 22px; }
.precheck-preview-actions { display: flex; gap: 8px; align-items: center; }
.precheck-preview-wrap { container-type: inline-size; margin-top: 12px; }
.precheck-preview-list { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.precheck-preview-list.is-single { grid-template-columns: minmax(0, 520px); }
@container (min-width: 640px) {
  .precheck-preview-list:not(.is-single) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (min-width: 980px) {
  .precheck-preview-list:not(.is-single) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@container (min-width: 1280px) {
  .precheck-preview-list:not(.is-single) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.precheck-preview-card { min-width: 0; margin: 0; }
.precheck-preview-card-text { grid-column: 1 / -1; }
.precheck-preview-card__head { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
.precheck-preview-card__head p { margin: 0; }
.precheck-preview-error { margin: 8px 0 0; color: #b54747; }
.precheck-preview-media { margin-top: 8px; }
.precheck-preview-media :deep(.media-file-list),
.precheck-preview-media :deep(.media-file-list__cell),
.precheck-preview-media :deep(.el-upload-list),
.precheck-preview-media :deep(.el-upload-list__item) { width: 100%; }
.precheck-preview-media :deep(.el-upload-list__item) {
  height: auto;
  aspect-ratio: 1;
  background: #f3f6f4;
}
.precheck-preview-list.is-single .precheck-preview-media :deep(.el-upload-list__item) { aspect-ratio: 4 / 3; }
.precheck-caption { margin: 0 0 8px; white-space: pre-wrap; color: #243028; font-size: 13px; line-height: 1.5; }
.precheck-preview-progress { max-width: 420px; margin-top: 12px; }
.precheck-preview-submitted { margin: 8px 0 0; padding-left: 18px; color: #5c6b62; font-size: 13px; }
.precheck-preview-note { color: #5c6b62; }
.precheck-frame-packs { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
.precheck-frame-packs li { display: flex; align-items: center; gap: 12px; color: #243028; font-size: 13px; }
@media (max-width: 800px) {
  .precheck-preview-form { grid-template-columns: 1fr; }
}
</style>
