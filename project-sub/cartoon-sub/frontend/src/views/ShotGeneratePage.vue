<template>
  <PageShell v-if="shot" :title="plain ? '' : (shot.description || '生成产物')">
    <template v-if="!plain" #extra>
      <el-button link type="primary" @click="back">← 返回</el-button>
      <el-button @click="openOutputs">查看产物</el-button>
    </template>
    <el-alert v-if="notice" :title="notice" :type="noticeType" show-icon class="cartoon-module" />
    <section class="cartoon-module">
      <p class="cartoon-module__hint">{{ chapterTitle }} · {{ shot.shot_size || '中景' }} / {{ shot.camera_move || '固定' }}</p>
      <el-form label-position="top">
        <el-form-item label="关联资产">
          <el-select v-model="assetIds" multiple filterable placeholder="可多选角色、场景、道具" style="width: 100%">
            <el-option-group v-for="group in assetGroups" :key="group.kind" :label="group.label">
              <el-option v-for="item in group.items" :key="item.id" :label="item.name" :value="item.id" />
            </el-option-group>
          </el-select>
          <p class="cartoon-module__hint">按选择顺序带上人物、场景、道具的描述。镜头提示词单独附在最后。生图和生视频都用这组条件。</p>
        </el-form-item>
        <el-form-item label="类型">
          <el-button :type="media === 'image' ? 'primary' : 'default'" @click="media = 'image'">生图</el-button>
          <el-button :type="media === 'video' ? 'primary' : 'default'" @click="media = 'video'">生视频</el-button>
        </el-form-item>
        <el-form-item label="工作流">
          <el-select v-model="workflowId" filterable placeholder="选择工作流" style="width: 100%">
            <el-option v-for="item in choices" :key="item.id" :label="workflowLabel(item)" :value="item.id" />
          </el-select>
          <p class="cartoon-module__hint">生图列出文生图和改图。生视频列出文生视频、首尾帧、图生视频和带 [RefMod] 的工作流。</p>
        </el-form-item>
        <el-form-item v-if="needsRefmod" label="RefMod 对应">
          <p v-if="!picturePlan.length" class="cartoon-module__hint">先在关联资产里选择已经绑了 RefMod 的角色、场景或道具。</p>
          <div v-for="item in picturePlan" :key="item.id" class="cartoon-refmod-bind">
            <p class="cartoon-module__hint">
              <template v-if="item.count">{{ kindLabel(item.kind) }}「{{ item.name }}」 · {{ item.count }} 张</template>
              <template v-else>{{ kindLabel(item.kind) }}「{{ item.name }}」还没有 RefMod，只写入提示词</template>
            </p>
            <button v-if="item.count" type="button" class="cartoon-refmod-strip" @click="openRefmodDetail(item)">
              <img v-for="image in item.images.slice(0, 4)" :key="image.name" :src="image.url" alt="" />
              <span v-if="item.images.length > 4">+{{ item.images.length - 4 }}</span>
            </button>
          </div>
          <p class="cartoon-module__hint">点图片组查看全部参考图。生成时按这个顺序补上图片对应，不写进下面的提示词。</p>
        </el-form-item>
        <el-form-item label="镜头提示词">
          <el-input v-model="promptText" type="textarea" :rows="12" />
        </el-form-item>
        <el-form-item v-if="selectedAssets.length" label="这次的生成条件">
          <el-input :model-value="conditionPreview" type="textarea" :rows="6" readonly />
        </el-form-item>
        <el-form-item v-if="media === 'video'" label="时长（秒）">
          <el-input-number v-model="durationSec" :min="1" :max="60" :step="1" :precision="0" />
          <p class="cartoon-module__hint">按这条工作流的帧率写成帧数，并对齐到模型要求的倍数。生图不用填。</p>
        </el-form-item>
        <p v-if="contractError" class="cartoon-module__hint">{{ contractError }}</p>
        <el-form-item v-for="slot in slots" :key="slot.id" :label="slot.label">
          <div class="cartoon-image-field">
            <el-upload
              :key="`${workflowId}-${slot.id}`"
              v-model:file-list="imageLists[slot.id]"
              class="cartoon-image-upload"
              action="#"
              list-type="picture"
              accept="image/png,image/jpeg,image/webp"
              :auto-upload="false"
              :limit="1"
              :on-change="file => onImage(slot, file)"
              :on-remove="() => clearImage(slot)"
              :on-exceed="files => replaceImage(slot, files)"
            >
              <el-button type="primary" plain>选择图片</el-button>
            </el-upload>
            <p class="cartoon-module__hint">{{ slot.spec }}</p>
          </div>
        </el-form-item>
        <div class="cartoon-generate-actions">
          <el-button type="primary" :disabled="!canMake()" :loading="generating" @click="generate">生成</el-button>
          <el-button v-if="plain" @click="openOutputs">查看产物</el-button>
          <RandomSeedField ref="seedField" v-model="seed" />
        </div>
        <p class="cartoon-module__hint">同一提示词、同一种子只会出同一张图或同一段视频。开关打开时，每次生成先换成一个 8 到 10 位的新种子。关掉后只使用手填的数字。</p>
        <el-progress v-if="jobLive" :percentage="jobPercent" :stroke-width="8" color="#2f8a5b" class="cartoon-job-progress" />
        <p v-if="jobLive" class="cartoon-module__hint">{{ jobNote }}</p>
      </el-form>
    </section>
    <el-dialog v-model="refmodDetailOpen" :title="refmodDetailTitle" width="720px" append-to-body>
      <div v-if="refmodDetail" class="cartoon-refmod-detail">
        <img v-for="image in refmodDetail.images" :key="image.name" :src="image.url" alt="" />
      </div>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import RandomSeedField from '../components/RandomSeedField.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const props = defineProps({
  plain: { type: Boolean, default: false },
  shotIdOverride: { type: [ String, Number ], default: '' },
});
const route = useRoute();
const router = useRouter();
const shot = ref(null);
const chapterTitle = ref('');
const promptText = ref('');
const media = ref('image');
const durationSec = ref(10);
const workflowId = ref(null);
const contracts = ref({});
const IMAGE_TYPES = new Set([ 'image/png', 'image/jpeg', 'image/webp' ]);
const files = reactive({});
const imageLists = reactive({});
const generating = ref(false);
const seed = ref(null);
const seedField = ref(null);
const notice = ref('');
const noticeType = ref('info');
const packs = ref([]);
const projectAssets = ref([]);
const assetIds = ref([]);
const refmodDetailOpen = ref(false);
const refmodDetail = ref(null);
let pollTimer = null;

const projectId = computed(() => route.params.id);
const shotId = computed(() => props.shotIdOverride || route.params.shotId || route.query.shot);
const inWorkbench = computed(() => route.name === 'workbench');
const choices = computed(() => (contracts.value.workflows || []).filter(item => item.media === media.value));
const selected = computed(() => choices.value.find(item => item.id === workflowId.value) || null);
const slots = computed(() => selected.value?.images || []);
const needsRefmod = computed(() => String(selected.value?.name || '').includes('[RefMod]'));
const visualAssets = computed(() => projectAssets.value.filter(item => [ 'character', 'scene', 'prop' ].includes(item.kind) && !item.disabled));
const assetGroups = computed(() => [
  { kind: 'character', label: '角色', items: visualAssets.value.filter(item => item.kind === 'character') },
  { kind: 'scene', label: '场景', items: visualAssets.value.filter(item => item.kind === 'scene') },
  { kind: 'prop', label: '道具', items: visualAssets.value.filter(item => item.kind === 'prop') },
].filter(group => group.items.length));
const selectedAssets = computed(() => assetIds.value
  .map(id => visualAssets.value.find(item => item.id === id))
  .filter(Boolean));
const picturePlan = computed(() => {
  let cursor = 1;
  return selectedAssets.value.map(asset => {
    const pack = packs.value.find(item => item.asset_id === asset.id);
    const names = pack?.images?.length ? pack.images : (pack?.cover ? [ pack.cover ] : []);
    const count = names.length;
    const from = count ? cursor : 0;
    if (count) cursor += count;
    return {
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      count,
      from,
      to: count ? from + count - 1 : 0,
      images: names.map(name => ({ name, url: packFileUrl(pack, name) })),
    };
  });
});
const refmodDetailTitle = computed(() => (
  refmodDetail.value ? `${kindLabel(refmodDetail.value.kind)}「${refmodDetail.value.name}」` : 'RefMod'
));
const conditionPreview = computed(() => composeCondition(selectedAssets.value, promptText.value, false, packs.value));
const submitKind = computed(() => {
  if (needsRefmod.value) return 'refmod';
  if (media.value === 'image') return slots.value.length ? 'edit' : 'image';
  if (slots.value.some(slot => slot.role === 'end') || slots.value.length >= 2) return 'video';
  if (slots.value.length) return 'i2v';
  return 't2v';
});
const contractError = computed(() => contracts.value.error || '');
function packFileUrl(pack, name) {
  return `${resolveApiBase()}/projects/${projectId.value}/refmods/${pack.id}/files/${encodeURIComponent(name)}`;
}
function openRefmodDetail(item) {
  refmodDetail.value = item;
  refmodDetailOpen.value = true;
}
function kindLabel(kind) {
  return { character: '人物', scene: '场景', prop: '道具' }[kind] || '资产';
}
function assetBrief(asset) {
  const bits = [];
  const push = value => {
    const text = String(value || '').trim();
    if (text) bits.push(text);
  };
  push(asset.description);
  if (asset.kind === 'character') {
    push(asset.consistency_note);
    if (String(asset.costume_note || '').trim()) bits.push(`服装：${String(asset.costume_note).trim()}`);
    if (String(asset.expression_note || '').trim()) bits.push(`表情：${String(asset.expression_note).trim()}`);
  }
  if (asset.kind === 'scene') push(asset.scene_type);
  if (asset.kind === 'prop') push(asset.prop_category);
  return bits.join('。');
}
function composeCondition(assets, shotPrompt, pictures, packRows) {
  const lines = [];
  let cursor = 1;
  assets.forEach(asset => {
    const pack = packRows.find(item => item.asset_id === asset.id);
    const count = pictures ? (pack?.image_count || 0) : 0;
    const tags = [];
    if (count) {
      for (let index = 0; index < count; index += 1) tags.push(`<Picture ${cursor + index}>`);
      cursor += count;
    }
    const brief = assetBrief(asset);
    const head = tags.length ? `${tags.join(' ')} 是${kindLabel(asset.kind)}「${asset.name}」` : `${kindLabel(asset.kind)}「${asset.name}」`;
    lines.push(brief ? `${head}。${brief}` : head);
  });
  const shot = String(shotPrompt || '').trim();
  if (!lines.length) return shot;
  return [ lines.join('\n'), shot ? `镜头：${shot}` : '' ].filter(Boolean).join('\n');
}

function workflowLabel(item) {
  const duplicated = choices.value.filter(row => row.name === item.name).length > 1;
  return duplicated ? `${item.name} #${item.id}` : item.name;
}
const jobLive = ref(false);
const jobPercent = ref(0);
const jobNote = ref('');
function progressText(task) {
  if (task.status === 'saving') return '正在保存产物';
  if (task.phase === 'queued') {
    return task.queue_ahead > 0 ? `排队，前面还有 ${task.queue_ahead} 个` : '排队中';
  }
  if (task.progress_max > 0) {
    const node = task.node ? `节点 ${task.node} ` : '';
    return `${node}${task.progress_value}/${task.progress_max}`;
  }
  return '正在生成，等待 ComfyUI 回报步数';
}
function statusLabel(status) {
  return { queued: '排队', running: '生成中', saving: '生成中', success: '成功', failed: '失败' }[status] || status;
}
function back() {
  if (inWorkbench.value) {
    router.replace({ query: { node: 'storyboard' } });
    return;
  }
  if (route.query.from === 'work') {
    router.push({ path: `/projects/${projectId.value}/work`, query: { step: '4' } });
    return;
  }
  router.push({ path: `/projects/${projectId.value}`, query: { tab: route.query.tab || '3' } });
}
function openOutputs() {
  if (inWorkbench.value) {
    router.replace({ query: { node: 'preview', shot: String(shotId.value) } });
    return;
  }
  router.push({
    path: `/projects/${projectId.value}/shots/${shotId.value}/outputs`,
    query: { from: route.query.from || 'detail', tab: route.query.tab || '3' },
  });
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
function resetFiles() {
  Object.keys(files).forEach(key => { delete files[key]; });
  Object.keys(imageLists).forEach(key => { delete imageLists[key]; });
}
function ensureList(slotId) {
  if (!imageLists[slotId]) imageLists[slotId] = [];
}
function readImage(slot, file) {
  if (!file) return;
  if (file.type && !IMAGE_TYPES.has(file.type)) {
    ElMessage.warning('请上传 png、jpg 或 webp');
    imageLists[slot.id] = [];
    delete files[slot.id];
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    files[slot.id] = { filename: file.name, data_base64: String(reader.result || '') };
  };
  reader.readAsDataURL(file);
}
function onImage(slot, uploadFile) {
  ensureList(slot.id);
  readImage(slot, uploadFile?.raw);
}
function clearImage(slot) {
  delete files[slot.id];
}
function replaceImage(slot, picked) {
  const file = picked?.[0];
  if (!file) return;
  imageLists[slot.id] = [{
    name: file.name,
    url: URL.createObjectURL(file),
    status: 'ready',
    uid: Date.now(),
    raw: file,
  }];
  readImage(slot, file);
}
async function load() {
  const detail = await request(`/projects/${projectId.value}`);
  const found = (detail.shots || []).find(item => String(item.id) === String(shotId.value));
  if (!found) {
    ElMessage.error('分镜不存在');
    if (!props.plain) back();
    return;
  }
  shot.value = found;
  projectAssets.value = detail.assets || [];
  const bound = (detail.bindings || [])
    .filter(item => String(item.shot_id) === String(found.id))
    .map(item => item.asset_id);
  assetIds.value = bound.filter(id => projectAssets.value.some(asset => asset.id === id && [ 'character', 'scene', 'prop' ].includes(asset.kind) && !asset.disabled));
  promptText.value = found.prompt?.positive_zh || '';
  if (Number(found.duration_ms) > 0) {
    durationSec.value = Math.min(60, Math.max(1, Math.round(found.duration_ms / 1000)));
  } else {
    durationSec.value = 10;
  }
  const chapter = (detail.imports || []).find(item => String(item.id) === String(found.import_id));
  chapterTitle.value = chapter?.chapter_title || '未关联快照';
  try {
    contracts.value = await request('/generate-inputs');
    packs.value = await request(`/projects/${projectId.value}/refmods`) || [];
    pickDefault(media.value);
  } catch (err) {
    notice.value = err.message;
    noticeType.value = 'error';
  }
}
function pickDefault(nextMedia) {
  const list = (contracts.value.workflows || []).filter(item => item.media === nextMedia);
  const preferred = nextMedia === 'image' ? contracts.value.image?.workflow_id : contracts.value.video?.workflow_id;
  const found = list.find(item => item.id === preferred) || list[0];
  workflowId.value = found ? found.id : null;
}
async function generate() {
  if (!workflowId.value) {
    ElMessage.error('请选择工作流');
    return;
  }
  if (needsRefmod.value && !picturePlan.value.some(item => item.count)) {
    ElMessage.error('请选择已经绑了 RefMod 的角色、场景或道具');
    return;
  }
  const missing = slots.value.filter(slot => !files[slot.id]?.data_base64);
  if (missing.length) {
    ElMessage.error(`请上传${missing.map(slot => slot.label).join('、')}`);
    return;
  }
  if (media.value === 'video' && !(Number(durationSec.value) >= 1)) {
    ElMessage.warning('请填写视频时长');
    return;
  }
  const nextSeed = seedField.value?.takeSeed();
  if (nextSeed == null) {
    ElMessage.warning('请填写种子，或打开随机开关');
    return;
  }
  generating.value = true;
  notice.value = '排队';
  noticeType.value = 'info';
  try {
    const task = await request(`/projects/${projectId.value}/shots/${shotId.value}/generate?kind=${submitKind.value}`, {
      method: 'post',
      data: {
        positive_zh: promptText.value,
        images: slots.value.map(slot => ({
          slot_id: slot.id,
          filename: files[slot.id].filename,
          data_base64: files[slot.id].data_base64,
        })),
        workflow_id: workflowId.value,
        asset_ids: assetIds.value,
        duration_sec: media.value === 'video' ? Number(durationSec.value) : undefined,
        seed: nextSeed,
      },
    });
    notice.value = task.error_message ? `${statusLabel(task.status)}：${task.error_message}` : statusLabel(task.status);
    noticeType.value = task.status === 'failed' ? 'error' : 'info';
    if ([ 'queued', 'running', 'saving' ].includes(task.status)) {
      stopPoll();
      const taskId = task.id;
      jobLive.value = true;
      jobPercent.value = task.progress_percent || 0;
      jobNote.value = progressText(task);
      pollTimer = setInterval(async () => {
        try {
          const detail = await request(`/projects/${projectId.value}`);
          const latest = (detail.tasks || []).find(item => String(item.id) === String(taskId));
          if (!latest || [ 'queued', 'running', 'saving' ].includes(latest.status)) {
            if (!latest) return;
            jobPercent.value = latest.status === 'saving' ? 99 : (latest.progress_percent || 0);
            jobNote.value = progressText(latest);
            notice.value = jobNote.value;
            noticeType.value = 'info';
            return;
          }
          stopPoll();
          jobPercent.value = latest.status === 'success' ? 100 : 0;
          jobLive.value = latest.status === 'success';
          notice.value = latest.error_message ? `${statusLabel(latest.status)}：${latest.error_message}` : statusLabel(latest.status);
          noticeType.value = latest.status === 'success' ? 'success' : 'error';
        } catch (err) {
          notice.value = err.message;
          noticeType.value = 'error';
        }
      }, 1000);
    }
  } catch (err) {
    notice.value = err.message;
    noticeType.value = 'error';
  } finally {
    generating.value = false;
  }
}
watch(media, () => {
  pickDefault(media.value);
  resetFiles();
});
watch(workflowId, resetFiles);
watch(slots, next => {
  (next || []).forEach(slot => ensureList(slot.id));
}, { immediate: true });
watch(shotId, (id) => { if (id) load(); }, { immediate: true });
onUnmounted(stopPoll);
</script>

<style scoped>
.cartoon-image-field { width: 100%; max-width: 420px; }
.cartoon-image-upload { display: block; }
.cartoon-generate-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cartoon-job-progress { max-width: 420px; margin-top: 12px; }
.cartoon-refmod-bind + .cartoon-refmod-bind { margin-top: 8px; }
.cartoon-refmod-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.cartoon-refmod-strip img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
}
.cartoon-refmod-strip span { color: #5c6b62; }
.cartoon-refmod-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cartoon-refmod-detail img {
  width: 160px;
  height: 160px;
  object-fit: cover;
  border-radius: 8px;
}
.cartoon-image-upload :deep(.el-upload-list--picture .el-upload-list__item) {
  border-radius: 10px;
  border-color: rgba(47, 138, 91, 0.16);
}
</style>
