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
        <el-form-item label="生成方式">
          <el-button
            v-for="item in kinds"
            :key="item.value"
            :type="kind === item.value ? 'primary' : 'default'"
            @click="kind = item.value"
          >{{ item.label }}</el-button>
        </el-form-item>
        <p v-if="contractError" class="cartoon-module__hint">{{ contractError }}</p>
        <el-form-item v-for="slot in slots" :key="slot.id" :label="slot.label">
          <input :key="`${kind}-${slot.id}`" type="file" accept="image/png,image/jpeg,image/webp" @change="onImage(slot, $event)" />
          <p class="cartoon-module__hint">{{ slot.spec }}{{ files[slot.id]?.filename ? ` · 已选 ${files[slot.id].filename}` : '' }}</p>
        </el-form-item>
        <el-button type="primary" :disabled="!canMake()" :loading="generating" @click="generate">生成</el-button>
      </el-form>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const route = useRoute();
const router = useRouter();
const shot = ref(null);
const chapterTitle = ref('');
const promptText = ref('');
const kind = ref('image');
const contracts = ref({});
const files = reactive({});
const kinds = [
  { value: 'image', label: '文生图' },
  { value: 'video', label: '首尾帧视频' },
  { value: 'i2v', label: '图生视频' },
  { value: 'edit', label: '改图' },
];
const generating = ref(false);
const notice = ref('');
const noticeType = ref('info');
let pollTimer = null;

const projectId = computed(() => route.params.id);
const shotId = computed(() => route.params.shotId || route.query.shot);
const inWorkbench = computed(() => route.name === 'workbench');
const slots = computed(() => contracts.value[kind.value]?.images || []);
const contractError = computed(() => contracts.value[kind.value]?.error || '');

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
}
function onImage(slot, event) {
  const file = event.target.files?.[0];
  delete files[slot.id];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    files[slot.id] = { filename: file.name, data_base64: String(reader.result || '') };
  };
  reader.readAsDataURL(file);
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
  } catch (err) {
    notice.value = err.message;
    noticeType.value = 'error';
  }
}
async function generate() {
  const missing = slots.value.filter(slot => !files[slot.id]?.data_base64);
  if (missing.length) {
    ElMessage.error(`请上传${missing.map(slot => slot.label).join('、')}`);
    return;
  }
  generating.value = true;
  notice.value = '排队';
  noticeType.value = 'info';
  try {
    const task = await request(`/projects/${projectId.value}/shots/${shotId.value}/generate?kind=${kind.value}`, {
      method: 'post',
      data: {
        positive_zh: promptText.value,
        images: slots.value.map(slot => ({
          slot_id: slot.id,
          filename: files[slot.id].filename,
          data_base64: files[slot.id].data_base64,
        })),
      },
    });
    notice.value = task.error_message ? `${statusLabel(task.status)}：${task.error_message}` : statusLabel(task.status);
    noticeType.value = task.status === 'failed' ? 'error' : 'info';
    if ([ 'queued', 'running' ].includes(task.status)) {
      stopPoll();
      pollTimer = setInterval(async () => {
        const detail = await request(`/projects/${projectId.value}`);
        const latest = (detail.tasks || []).find(item => item.shot_id === shot.value.id);
        if (!latest || ![ 'queued', 'running', 'saving' ].includes(latest.status)) {
          stopPoll();
          if (latest) {
            notice.value = latest.error_message ? `${statusLabel(latest.status)}：${latest.error_message}` : statusLabel(latest.status);
            noticeType.value = latest.status === 'success' ? 'success' : 'error';
          }
        }
      }, 2000);
    }
  } catch (err) {
    notice.value = err.message;
    noticeType.value = 'error';
  } finally {
    generating.value = false;
  }
}
watch(kind, resetFiles);
onMounted(load);
onUnmounted(stopPoll);
</script>
