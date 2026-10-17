<template>
  <PageShell :title="shot ? (shot.description || '产物') : '产物'">
    <template #extra>
      <el-button link type="primary" @click="back">← 返回</el-button>
      <el-button v-if="shot" @click="openGenerate">继续生成</el-button>
      <el-button @click="router.push(`/projects/${projectId}/edit`)">剪辑成片</el-button>
    </template>
    <section class="cartoon-module">
      <p v-if="chapterTitle" class="cartoon-module__hint">{{ chapterTitle }}</p>
      <el-empty v-if="loaded && !tasks.length" description="这条分镜还没有产物" />
      <el-card v-for="task in tasks" :key="task.id" shadow="never" class="cartoon-output">
        <p>{{ statusLabel(task.status) }} · {{ kindLabel(task.kind) }}</p>
        <p v-if="task.error_message">{{ task.error_message }}</p>
        <p v-if="task.precheck_workflow_id">
          <a class="cartoon-precheck-link" :href="precheckHref(task.precheck_workflow_id)" target="_blank" rel="noreferrer">打开预检梳理</a>
        </p>
        <div v-for="output in task.outputs" :key="output.id">
          <video v-if="output.media_kind === 'video'" :src="fileUrl(output.id)" controls class="cartoon-media"></video>
          <img v-else :src="fileUrl(output.id)" :alt="task.shot_description" class="cartoon-media" />
        </div>
      </el-card>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '../components/PageShell.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';

const route = useRoute();
const router = useRouter();
const shot = ref(null);
const chapterTitle = ref('');
const tasks = ref([]);
const loaded = ref(false);
let pollTimer = null;
const projectId = computed(() => route.params.id);

function statusLabel(status) {
  return { queued: '排队', running: '生成中', saving: '生成中', success: '成功', failed: '失败' }[status] || status;
}
function kindLabel(kind) {
  return { image: '文生图', video: '首尾帧', i2v: '图生视频', edit: '改图' }[kind] || kind;
}
function precheckHref(id) {
  const origin = import.meta.env.VITE_PRECHECK_ORIGIN || 'http://localhost:5104';
  return `${origin.replace(/\/$/, '')}/workflows?id=${id}`;
}
function fileUrl(id) { return `${resolveApiBase()}/outputs/${id}/file`; }
function back() {
  if (route.query.from === 'work') {
    router.push({ path: `/projects/${projectId.value}/work`, query: { step: '3' } });
    return;
  }
  router.push({ path: `/projects/${projectId.value}`, query: { tab: route.query.tab || '3' } });
}
function openGenerate() {
  router.push({
    path: `/projects/${projectId.value}/shots/${route.params.shotId}/generate`,
    query: { from: route.query.from || 'detail', tab: route.query.tab || '3' },
  });
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
async function load() {
  const detail = await request(`/projects/${projectId.value}`);
  shot.value = (detail.shots || []).find(item => String(item.id) === String(route.params.shotId)) || null;
  const chapter = (detail.imports || []).find(item => String(item.id) === String(shot.value?.import_id));
  chapterTitle.value = chapter?.chapter_title || '';
  tasks.value = (detail.tasks || []).filter(item => String(item.shot_id) === String(route.params.shotId));
  loaded.value = true;
  const active = tasks.value.some(item => [ 'queued', 'running', 'saving' ].includes(item.status));
  if (active && !pollTimer) pollTimer = setInterval(load, 2000);
  if (!active) stopPoll();
}
onMounted(load);
onUnmounted(stopPoll);
</script>

<style scoped>
.cartoon-output { margin-bottom: 12px; }
.cartoon-media { max-width: 420px; display: block; margin-top: 8px; }
.cartoon-precheck-link { color: #2f8a5b; }
</style>
