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
        <el-form-item label="提示词">
          <el-input v-model="promptText" type="textarea" :rows="4" />
        </el-form-item>
        <el-button type="primary" :loading="generating" @click="generate('image')">生成图片</el-button>
        <el-button :loading="generating" @click="generate('video')">首尾帧视频</el-button>
        <el-button :loading="generating" @click="generate('i2v')">图生视频</el-button>
        <el-button :loading="generating" @click="generate('edit')">改图</el-button>
      </el-form>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';

const route = useRoute();
const router = useRouter();
const shot = ref(null);
const chapterTitle = ref('');
const promptText = ref('');
const generating = ref(false);
const notice = ref('');
const noticeType = ref('info');
let pollTimer = null;

const projectId = computed(() => route.params.id);
const shotId = computed(() => route.params.shotId);

function statusLabel(status) {
  return { queued: '排队', running: '生成中', saving: '生成中', success: '成功', failed: '失败' }[status] || status;
}
function back() {
  if (route.query.from === 'work') {
    router.push({ path: `/projects/${projectId.value}/work`, query: { step: '3' } });
    return;
  }
  router.push({ path: `/projects/${projectId.value}`, query: { tab: route.query.tab || '3' } });
}
function openOutputs() {
  router.push({
    path: `/projects/${projectId.value}/shots/${shotId.value}/outputs`,
    query: { from: route.query.from || 'detail', tab: route.query.tab || '3' },
  });
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
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
}
async function generate(kind) {
  generating.value = true;
  notice.value = '排队';
  noticeType.value = 'info';
  try {
    const task = await request(`/projects/${projectId.value}/shots/${shotId.value}/generate?kind=${kind}`, {
      method: 'post',
      data: { positive_zh: promptText.value },
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
onMounted(load);
onUnmounted(stopPoll);
</script>
