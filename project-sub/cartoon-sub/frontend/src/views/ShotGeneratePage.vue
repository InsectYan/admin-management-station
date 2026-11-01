<template>
  <PageShell v-if="shot" :title="shot.description || '生成产物'">
    <template #extra>
      <el-button link type="primary" @click="back">← 返回</el-button>
      <el-button @click="openOutputs">查看产物</el-button>
    </template>
    <el-alert v-if="notice" :title="notice" :type="noticeType" show-icon class="cartoon-module" />
    <section class="cartoon-module">
      <p class="cartoon-module__hint">{{ chapterTitle }} · {{ shot.shot_size || '中景' }} / {{ shot.camera_move || '固定' }}</p>
      <el-form label-position="top">
        <el-form-item label="正向提示词">
          <el-input v-model="promptText" type="textarea" :rows="4" />
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
        <el-form-item v-if="needsRefmod" label="本项目的包">
          <el-select v-model="refmodIds" multiple placeholder="先选人物，再选场景" style="width: 100%">
            <el-option-group label="人物">
              <el-option v-for="item in characterPacks" :key="item.id" :label="`${item.name}（${item.image_count} 张）`" :value="item.id" />
            </el-option-group>
            <el-option-group label="场景">
              <el-option v-for="item in scenePacks" :key="item.id" :label="`${item.name}（${item.image_count} 张）`" :value="item.id" />
            </el-option-group>
          </el-select>
          <p class="cartoon-module__hint">按选择顺序对应 &lt;Picture 1&gt;。人物和场景一起算，最多 9 张图。包在左侧 RefMod 里按项目保存。</p>
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
          <RandomSeedField ref="seedField" v-model="seed" />
        </div>
        <p class="cartoon-module__hint">同一提示词、同一种子只会出同一张图或同一段视频。开关打开时，每次生成先换成一个 8 到 10 位的新种子。关掉后只使用手填的数字。</p>
        <el-progress v-if="jobLive" :percentage="jobPercent" :stroke-width="8" color="#2f8a5b" class="cartoon-job-progress" />
        <p v-if="jobLive" class="cartoon-module__hint">{{ jobNote }}</p>
      </el-form>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import RandomSeedField from '../components/RandomSeedField.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const route = useRoute();
const router = useRouter();
const shot = ref(null);
const chapterTitle = ref('');
const promptText = ref('');
const media = ref('image');
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
const refmodIds = ref([]);
let pollTimer = null;

const projectId = computed(() => route.params.id);
const shotId = computed(() => route.params.shotId || route.query.shot);
const inWorkbench = computed(() => route.name === 'workbench');
const choices = computed(() => (contracts.value.workflows || []).filter(item => item.media === media.value));
const selected = computed(() => choices.value.find(item => item.id === workflowId.value) || null);
const slots = computed(() => selected.value?.images || []);
const needsRefmod = computed(() => String(selected.value?.name || '').includes('[RefMod]'));
const submitKind = computed(() => {
  if (needsRefmod.value) return 'refmod';
  if (media.value === 'image') return slots.value.length ? 'edit' : 'image';
  if (slots.value.some(slot => slot.role === 'end') || slots.value.length >= 2) return 'video';
  if (slots.value.length) return 'i2v';
  return 't2v';
});
const contractError = computed(() => contracts.value.error || '');
const characterPacks = computed(() => packs.value.filter(item => item.kind !== 'scene'));
const scenePacks = computed(() => packs.value.filter(item => item.kind === 'scene'));

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
    router.push({ path: `/projects/${projectId.value}/work`, query: { step: '3' } });
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
    back();
    return;
  }
  shot.value = found;
  promptText.value = found.prompt?.positive_zh || '';
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
  if (needsRefmod.value && !refmodIds.value.length) {
    ElMessage.error('请选择本项目的人物包或场景包');
    return;
  }
  const missing = slots.value.filter(slot => !files[slot.id]?.data_base64);
  if (missing.length) {
    ElMessage.error(`请上传${missing.map(slot => slot.label).join('、')}`);
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
        refmod_ids: needsRefmod.value ? refmodIds.value : [],
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
onMounted(load);
onUnmounted(stopPoll);
</script>

<style scoped>
.cartoon-image-field { width: 100%; max-width: 420px; }
.cartoon-image-upload { display: block; }
.cartoon-generate-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cartoon-job-progress { max-width: 420px; margin-top: 12px; }
.cartoon-image-upload :deep(.el-upload-list--picture .el-upload-list__item) {
  border-radius: 10px;
  border-color: rgba(47, 138, 91, 0.16);
}
</style>
