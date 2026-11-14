<template>
  <div>
    <div class="precheck-preview-stage">
    <div class="precheck-preview-main">
    <el-form label-position="top" class="precheck-preview-form">
      <el-form-item class="precheck-preview-duration" label="画风">
        <el-checkbox-group v-if="styleGroups.length" v-model="styleIds" class="precheck-style-box">
          <div v-for="group in styleGroups" :key="group.label" class="precheck-style-group">
            <p>{{ group.label }}</p>
            <el-checkbox v-for="item in group.items" :key="item.value" :value="item.value">{{ item.name }}</el-checkbox>
          </div>
        </el-checkbox-group>
        <p v-else class="precheck-preview-hint">画风列表还没读到。风格提示词可以手动填写。</p>
      </el-form-item>
      <el-form-item class="precheck-preview-duration" label="风格提示词">
        <el-input v-model="stylePrompt" type="textarea" :rows="4" placeholder="勾选画风后，这里会填入该画风的描述。生成时拼在提示词前面。" />
      </el-form-item>
      <el-form-item class="precheck-preview-duration" label="产物名称">
        <el-input v-model="outputName" maxlength="80" placeholder="留空时使用「产物」。落库和下载名称是产物名称加种子" />
      </el-form-item>
    </el-form>
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
        :class="{ 'precheck-preview-duration': field.type === 'duration' || field.type === 'image' || field.type === 'video' || (batchable && isSeedField(field)) }"
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
        <div v-else-if="field.type === 'note'" class="precheck-preview-relation">
          <p v-for="(line, index) in field.lines" :key="index">{{ line }}</p>
        </div>
        <el-input
          v-else-if="field.id === 'caption_fps'"
          v-model="field.value"
          :disabled="field.disabled"
          placeholder="留空使用文件真实帧率"
        />
        <el-input v-else-if="field.type === 'text'" v-model="field.value" type="textarea" :rows="3" />
        <el-input-number
          v-else-if="field.type === 'number'"
          v-model="field.value"
          :controls="false"
          :disabled="frameLocked(field) || field.disabled"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :precision="field.precision"
          :placeholder="batchable && isSeedField(field) ? '留空则按批次自动生成' : ''"
          :value-on-clear="batchable && isSeedField(field) ? null : undefined"
          @change="batchable && isSeedField(field) ? clearShownSeeds() : undefined"
        />
        <el-input v-else v-model="field.value" />
        <p v-if="field.hint && field.type !== 'note'" class="precheck-preview-hint">{{ field.hint }}</p>
        <p v-if="field.class_type === 'TextEncodeQwenImage21' && field.key === 'height'" class="precheck-preview-hint">宽度和高度都填了才按这个尺寸出图。都留 0 时，出图跟着分辨率和参考图比例。</p>
        <div v-if="batchable && field.id === primarySeedId && shownSeeds.length" class="precheck-preview-seeds">
          <span v-for="(code, index) in shownSeeds" :key="`${code}-${index}`" class="precheck-preview-seed">{{ shownSeeds.length > 1 ? `第 ${index + 1} ${batchUnit} ` : '' }}{{ code }}</span>
        </div>
      </el-form-item>
      <el-form-item v-if="batchable && field.id === primarySeedId" class="precheck-preview-duration" label="批次">
        <el-input-number
          v-model="batchCount"
          :min="1"
          :max="seedFilled ? 1 : BATCH_MAX"
          :step="1"
          :precision="0"
          :value-on-clear="1"
          @change="clearShownSeeds"
        />
        <p class="precheck-preview-hint">{{ batchHint() }}</p>
      </el-form-item>
      </template>
    </el-form>
    <div class="precheck-preview-actions">
      <el-button type="primary" :loading="submitting" :disabled="!apiJson || stopping" @click="generate">生成产物</el-button>
      <el-button :disabled="!canClear || clearing" :loading="clearing" @click="clearRuns">清空产物</el-button>
      <el-button v-if="submitting || hasRunning" type="danger" plain :loading="stopping" @click="stopWork">停止</el-button>
    </div>
    <div v-if="overallTasks.length" class="precheck-preview-progress">
      <el-progress :percentage="overallPercent" :format="formatOverall" :stroke-width="8" color="#2f8a5b" />
      <p class="precheck-preview-note">{{ progressText }}</p>
    </div>
    <p v-if="notice" class="precheck-preview-note">{{ notice }}</p>
    </div>
    <div class="precheck-preview-side">
    <aside class="precheck-preview-used">
      <p class="precheck-preview-used__title">本次实际选项</p>
      <p v-if="!focusRun" class="precheck-preview-hint">生成之后，这里显示这次提交的参数和引用图片。</p>
      <p v-else-if="!usedOptions.length" class="precheck-preview-hint">这次生成没有提示词以外的选项。</p>
      <ul v-else class="precheck-preview-options">
        <li v-for="(item, index) in usedOptions" :key="`${item.label}-${index}`" :class="{ 'is-media': item.images && item.images.length }">
          <span>{{ item.label }}</span>
          <p v-if="item.text">{{ item.text }}</p>
          <div v-if="item.images && item.images.length" class="precheck-preview-refs">
            <template v-for="image in item.images" :key="image.file">
              <video v-if="image.kind === 'video'" :src="optionSrc(image)" muted controls playsinline />
              <el-image
                v-else
                :src="optionSrc(image)"
                :preview-src-list="imagePreviewList(item)"
                :initial-index="imagePreviewIndex(item, image)"
                fit="cover"
                preview-teleported
              />
            </template>
          </div>
        </li>
      </ul>
    </aside>
    <aside class="precheck-preview-used">
      <p class="precheck-preview-used__title">本次实际提示词</p>
      <p v-if="usedTitle" class="precheck-preview-hint">产物 {{ usedTitle }}</p>
      <p v-if="!focusRun" class="precheck-preview-hint">生成之后，这里显示实际交给 ComfyUI 的提示词，包括自动拼上的风格描述。</p>
      <p v-else-if="!usedPrompts.length" class="precheck-preview-hint">这次生成没有文本提示词。</p>
      <ul v-else>
        <li v-for="item in usedPrompts" :key="item.label">
          <span>{{ item.label }}</span>
          <p>{{ item.text }}</p>
        </li>
      </ul>
    </aside>
    </div>
    </div>
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
            <span v-if="productTitle(item)">{{ productTitle(item) }} · </span>{{ runLabel(item) }}
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
        <p v-if="item.status === 'cancelled'" class="precheck-preview-status">
          <span class="precheck-preview-note">已停止</span>
          <el-button link type="danger" @click="removeRun(item)">删除</el-button>
        </p>
        <p v-else-if="item.status === 'failed'" class="precheck-preview-status">
          <span class="precheck-preview-error">{{ item.error || '生成失败' }}</span>
          <el-button link type="danger" @click="removeRun(item)">删除</el-button>
        </p>
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
const styles = ref([]);
const styleIds = ref([]);
const stylePrompt = ref('');
const outputName = ref('');
const styleGroups = computed(() => {
  const grouped = new Map();
  styles.value.forEach(item => {
    const key = item.group || '其他';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  });
  return [ ...grouped.entries() ].map(([ label, items ]) => ({ label, items }));
});
const focusRun = computed(() => runs.value.find(item => item.status === 'running') || runs.value[0] || null);
const usedPrompts = computed(() => (focusRun.value?.submitted || []).filter(item => item.type === 'text'));
function hiddenOption(item) {
  const label = String(item?.label || '');
  return label === '种子' || /frame_idx/i.test(label);
}
const usedOptions = computed(() => {
  const run = focusRun.value;
  if (!run) return [];
  const source = Array.isArray(run.options) && run.options.length
    ? run.options
    : [
      ...(run.output_name ? [{ label: '产物名称', text: run.output_name }] : []),
      ...(run.submitted || []).filter(item => item && item.type !== 'text').map(item => ({
        label: item.label || '参数',
        text: item.text || '',
      })),
    ];
  return source.filter(item => !hiddenOption(item));
});
const usedTitle = computed(() => productTitle(focusRun.value));
const framePacks = computed(() => runs.value.filter(item => item.status === 'success' && item.media_kind === 'video' && item.zip_name));
const mediaCardCount = computed(() => runs.value.filter(item => item.media_kind !== 'text').length);
const hasRunning = computed(() => runs.value.some(item => item.status === 'running'));
const canClear = computed(() => runs.value.some(item => item.status !== 'running'));
const batchCount = ref(1);
const shownSeeds = ref([]);
const batchable = computed(() => imageWorkflow(props.apiJson) || videoWorkflow(props.apiJson));
const batchUnit = computed(() => videoWorkflow(props.apiJson) ? '条' : '张');
const primarySeedId = computed(() => fields.value.find(field => field.key === 'seed' || field.key === 'noise_seed')?.id || '');
const seedFilled = computed(() => {
  const field = fields.value.find(item => item.id === primarySeedId.value);
  return field != null && field.value != null && field.value !== '' && Number.isFinite(Number(field.value));
});
let timer = null;

function isSeedField(field) {
  return field?.key === 'seed' || field?.key === 'noise_seed';
}
function videoWorkflow(graph) {
  return Object.values(graph || {}).some(node => {
    const name = String(node?.class_type || '');
    if (!name || name === 'LoadVideo' || name === 'GetVideoComponents') return false;
    if (/video|(?:^|[^a-z])wan|vhs_|svd|hunyuan|ltxv|animatediff|mochi/i.test(name)) return true;
    const inputs = node?.inputs || {};
    return [ 'length', 'frames', 'num_frames', 'frame_count', 'fps', 'frame_rate' ].some(key => {
      const value = inputs[key];
      return value != null && !Array.isArray(value) && typeof value !== 'object';
    });
  });
}
function imageWorkflow(graph) {
  if (videoWorkflow(graph)) return false;
  const nodes = Object.values(graph || {});
  if (nodes.some(node => /AILab_QwenVL|^JC$|Florence2|WD14Tagger/i.test(String(node?.class_type || '')))) return false;
  return nodes.some(node => node?.class_type === 'SaveImage' || node?.class_type === 'PreviewImage');
}
function clearShownSeeds() {
  shownSeeds.value = [];
}
function batchHint() {
  const unit = batchUnit.value;
  if (seedFilled.value) return `种子已填写，这次只出 1 ${unit}。`;
  return `一次出这么多${unit}，最多 ${BATCH_MAX} ${unit}。每${unit}单独排队，所以一次最多提交 ${BATCH_MAX} ${unit}。种子留空时，每${unit}使用各自的 8 到 10 位种子。`;
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

const overallTasks = computed(() => {
  const list = runs.value;
  const running = list.filter(item => item.status === 'running');
  if (!running.length) return [];
  const ids = new Set(running.map(item => item.batch_id).filter(Boolean));
  const tasks = ids.size ? list.filter(item => ids.has(item.batch_id)) : running;
  return tasks.slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id)));
});
function taskPercent(item) {
  if (!item) return 0;
  if (item.status === 'success' || item.status === 'failed' || item.status === 'cancelled' || item.phase === 'frames') return 100;
  const value = Number(item.progress_percent);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
const overallPercent = computed(() => {
  const tasks = overallTasks.value;
  if (!tasks.length) return 0;
  const sum = tasks.reduce((total, item) => total + taskPercent(item), 0);
  return Math.round((sum / tasks.length) * 100) / 100;
});
function formatOverall(value) {
  return `${Number(value).toFixed(2)}%`;
}
const progressText = computed(() => {
  const tasks = overallTasks.value;
  if (!tasks.length) return '';
  const active = tasks.find(item => item.status === 'running' && item.phase !== 'queued')
    || tasks.find(item => item.status === 'running');
  const index = Math.max(1, tasks.indexOf(active) + 1);
  const current = taskPercent(active).toFixed(2);
  const done = tasks.filter(item => item.status !== 'running').length;
  return `共 ${tasks.length} 个任务，已结束 ${done} 个，正在执行第 ${index} 个（${current}%）。总进度 ${overallPercent.value.toFixed(2)}%。离开页面不会中断。`;
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
function optionSrc(image) {
  if (!image?.file || !focusRun.value?.id) return '';
  const base = props.workflowId
    ? `/workflows/${props.workflowId}/preview/option`
    : `/workflows/drafts/${draftKey()}/option`;
  return `${resolveApiBase()}${base}?run=${encodeURIComponent(focusRun.value.id)}&file=${encodeURIComponent(image.file)}`;
}
function imagePreviewList(item) {
  return (item?.images || []).filter(image => image.kind !== 'video').map(optionSrc);
}
function imagePreviewIndex(item, image) {
  return Math.max(0, imagePreviewList(item).indexOf(optionSrc(image)));
}
function mediaItem(item) {
  return {
    id: item.id,
    url: mediaPath(item),
    kind: item.media_kind === 'video' ? 'video' : 'image',
    name: productTitle(item) || runLabel(item),
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
function productTitle(item) {
  if (!item?.output_name) return '';
  return `${item.output_name}${item.seed ?? ''}`;
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
async function loadStyles() {
  try {
    const rows = await request('/visual-styles');
    styles.value = Array.isArray(rows) ? rows : [];
  } catch {
    styles.value = [];
  }
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
  try {
    await ElMessageBox.confirm(
      item?.status === 'failed' || item?.status === 'cancelled' ? '删除这条记录？' : '删除这条产物？',
      '删除',
      { type: 'warning' },
    );
  } catch {
    return;
  }
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
  if (batchable.value) {
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
      style_prompt: stylePrompt.value,
      output_name: outputName.value,
      style_names: styleIds.value.map(id => styles.value.find(item => item.value === id)?.name).filter(Boolean),
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

watch(styleIds, ids => {
  const picked = ids.map(id => styles.value.find(item => item.value === id)).filter(Boolean);
  stylePrompt.value = picked.map(item => String(item.prompt || '').trim()).filter(Boolean).join('\n\n');
});
watch(seedFilled, filled => { if (filled) batchCount.value = 1; });
watch(durationWatch, () => { if (loaded.value) syncFrames(); });
watch(() => props.apiJson, () => { loadFields(); }, { immediate: true });
watch(() => props.refmod, async enabled => {
  if (!enabled) return;
  packs.value = await request('/refmods') || [];
}, { immediate: true });
watch(() => props.workflowId, () => { refresh().catch(() => {}); }, { immediate: true });
loadStyles();
onUnmounted(stop);
</script>

<style scoped>
.precheck-preview-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.precheck-preview-stage { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 36%); gap: 16px; align-items: start; }
.precheck-preview-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.precheck-style-box { width: 100%; max-height: 220px; overflow: auto; padding: 8px 10px; border: 1px solid rgba(47, 138, 91, 0.16); border-radius: 10px; }
.precheck-style-group { margin-bottom: 8px; }
.precheck-style-group p { margin: 0 0 4px; color: #5c6b62; font-size: 12px; }
.precheck-style-group :deep(.el-checkbox) { margin-right: 12px; }
.precheck-preview-used { min-width: 0; padding: 12px; border: 1px solid rgba(47, 138, 91, 0.16); border-radius: 12px; background: #f7fbf8; }
.precheck-preview-used__title { margin: 0 0 8px; font-weight: 600; }
.precheck-preview-used ul { margin: 8px 0 0; padding: 0; list-style: none; }
.precheck-preview-used li + li { margin-top: 12px; }
.precheck-preview-options { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 16px; }
.precheck-preview-options li,
.precheck-preview-options li + li { min-width: 0; margin-top: 0; }
.precheck-preview-options li.is-media { grid-column: 1 / -1; }
.precheck-preview-used span { color: #5c6b62; font-size: 12px; }
.precheck-preview-used p { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; }
.precheck-preview-refs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 6px; }
.precheck-preview-refs :deep(.el-image),
.precheck-preview-refs video {
  display: block;
  width: 100%;
  max-width: 100%;
  height: 140px;
  min-width: 0;
  border-radius: 8px;
  background: #eef4f0;
  object-fit: contain;
}
.precheck-preview-refs :deep(.el-image__inner) { width: 100%; height: 100%; object-fit: contain; }
@media (max-width: 960px) {
  .precheck-preview-stage { grid-template-columns: 1fr; }
}
.precheck-preview-duration { grid-column: 1 / -1; }
.precheck-image-field { width: 100%; max-width: 420px; }
.precheck-image-upload { display: block; }
.precheck-image-upload :deep(.el-upload-list--picture .el-upload-list__item) {
  border-radius: 10px;
  border-color: rgba(47, 138, 91, 0.16);
}
.precheck-preview-hint { margin: 6px 0 0; color: #5c6b62; font-size: 13px; }
.precheck-preview-relation {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f3f7f4;
  color: #243028;
  font-size: 13px;
  line-height: 1.55;
}
.precheck-preview-relation p { margin: 0; }
.precheck-preview-seeds { display: flex; flex-flow: row wrap; gap: 8px; margin: 8px 0 0 8px; }
.precheck-preview-seed { padding: 2px 10px; border-radius: 999px; background: #e7f3ec; color: #243028; font-size: 13px; line-height: 22px; }
.precheck-preview-actions { display: flex; gap: 8px; align-items: center; }
.precheck-preview-wrap { container-type: inline-size; margin-top: 12px; }
.precheck-preview-list { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.precheck-preview-list.is-single { grid-template-columns: minmax(0, 70%); }
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
.precheck-preview-error { margin: 0; color: #b54747; }
.precheck-preview-status { display: flex; align-items: center; gap: 8px; margin: 8px 0 0; line-height: 12px }
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
