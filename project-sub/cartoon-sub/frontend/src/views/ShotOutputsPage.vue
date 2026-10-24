<template>
  <PageShell :title="shot ? (shot.description || '产物') : '产物'">
    <template #extra>
      <el-button link type="primary" @click="back">← 返回</el-button>
      <el-button v-if="shot" :disabled="!canMake()" @click="openGenerate">继续生成</el-button>
      <el-button @click="openEdit">剪辑成片</el-button>
    </template>
    <section class="cartoon-module">
      <p v-if="chapterTitle" class="cartoon-module__hint">{{ chapterTitle }}</p>
      <el-empty v-if="loaded && !tasks.length" description="这条分镜还没有产物" />
      <section v-if="outputChoices.length > 1" class="cartoon-module">
        <h3 class="cartoon-module__title">逐帧对比</h3>
        <p class="cartoon-module__hint">抽出每一秒的画面再比较。抽不到画面时，只比较时长和尺寸。</p>
        <el-select v-model="leftId" style="width: 160px">
          <el-option v-for="item in outputChoices" :key="`l-${item.id}`" :label="`产物 ${item.id}`" :value="item.id" />
        </el-select>
        <el-select v-model="rightId" style="width: 160px">
          <el-option v-for="item in outputChoices" :key="`r-${item.id}`" :label="`产物 ${item.id}`" :value="item.id" />
        </el-select>
        <el-button @click="compare">对比</el-button>
        <p v-if="diffError">{{ diffError }}</p>
        <ul v-if="frames.length">
          <li v-for="frame in frames" :key="frame.index">
            第 {{ frame.index }} 秒 · {{ frame.same ? '两侧一致' : '有差异' }}
          </li>
        </ul>
      </section>
      <el-card v-for="task in tasks" :key="task.id" shadow="never" class="cartoon-output">
        <p>{{ statusLabel(task.status) }} · {{ kindLabel(task.kind) }}</p>
        <p v-if="task.error_message">{{ task.error_message }}</p>
        <p v-if="task.precheck_workflow_id">
          <a class="cartoon-precheck-link" :href="precheckHref(task.precheck_workflow_id)" target="_blank" rel="noreferrer">打开预检梳理</a>
        </p>
        <div v-for="output in task.outputs" :key="output.id">
          <video v-if="output.media_kind === 'video'" :src="fileUrl(output.id)" controls class="cartoon-media"></video>
          <img v-else :src="fileUrl(output.id)" :alt="task.shot_description" class="cartoon-media" />
          <p class="cartoon-module__hint">串脸由人工标记，这里不自动检测。</p>
          <p>{{ faceLabel(output) }}</p>
          <el-button size="small" @click="markFace(output, true)">画面正常</el-button>
          <el-button size="small" @click="markFace(output, false)">有串脸</el-button>
          <div v-if="profilesOf(output.id).length" class="cartoon-devices">
            <div v-for="profile in profilesOf(output.id)" :key="profile.id" class="cartoon-device">
              <span>{{ profile.label }}</span>
              <div class="cartoon-device__frame" :style="{ aspectRatio: profile.ratio }">
                <video v-if="output.media_kind === 'video'" :src="profileSrc(profile, output.id)" muted></video>
                <img v-else :src="profileSrc(profile, output.id)" :alt="profile.label" />
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '../components/PageShell.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const route = useRoute();
const router = useRouter();
const shot = ref(null);
const chapterTitle = ref('');
const tasks = ref([]);
const loaded = ref(false);
const profiles = ref({});
const leftId = ref(null);
const rightId = ref(null);
const frames = ref([]);
const diffError = ref('');
const outputChoices = computed(() => tasks.value.flatMap(item => item.outputs || []));
let pollTimer = null;
const projectId = computed(() => route.params.id);
const shotId = computed(() => route.params.shotId || route.query.shot);
const inWorkbench = computed(() => route.name === 'workbench');

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
function faceLabel(output) {
  if (!output.face_checked) return '还没有标记串脸';
  return output.face_ok ? '已标记：画面正常' : '已标记：有串脸';
}
async function markFace(output, ok) {
  try {
    const data = await request(`/outputs/${output.id}/face-check`, { method: 'post', data: { ok } });
    output.face_checked = data.face_checked;
    output.face_ok = data.face_ok;
  } catch (err) {
    ElMessage.error(err.message);
  }
}
function profileSrc(profile, outputId) {
  return `${resolveApiBase()}/${profile.file || `outputs/${outputId}/file`}`;
}
function profilesOf(id) { return profiles.value[id] || []; }
async function loadProfiles(outputs) {
  const next = { ...profiles.value };
  await Promise.all(outputs.map(async output => {
    if (next[output.id]) return;
    try {
      const data = await request(`/outputs/${output.id}/preview-profiles`);
      next[output.id] = data.profiles || [];
    } catch {
      next[output.id] = [];
    }
  }));
  profiles.value = next;
}
async function compare() {
  diffError.value = '';
  frames.value = [];
  try {
    const data = await request(`/projects/${projectId.value}/frame-diff`, {
      params: { left: leftId.value, right: rightId.value },
    });
    frames.value = data.frames || [];
  } catch (err) {
    diffError.value = err.message;
    ElMessage.error(err.message);
  }
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
function openGenerate() {
  if (inWorkbench.value) {
    router.replace({ query: { node: 'generate', shot: String(shotId.value) } });
    return;
  }
  router.push({
    path: `/projects/${projectId.value}/shots/${shotId.value}/generate`,
    query: { from: route.query.from || 'detail', tab: route.query.tab || '3' },
  });
}
function openEdit() {
  if (inWorkbench.value) {
    router.replace({ query: { node: 'compose' } });
    return;
  }
  router.push(`/projects/${projectId.value}/edit`);
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
async function load() {
  const detail = await request(`/projects/${projectId.value}`);
  shot.value = (detail.shots || []).find(item => String(item.id) === String(shotId.value)) || null;
  const chapter = (detail.imports || []).find(item => String(item.id) === String(shot.value?.import_id));
  chapterTitle.value = chapter?.chapter_title || '';
  tasks.value = (detail.tasks || []).filter(item => String(item.shot_id) === String(shotId.value));
  const outputs = tasks.value.flatMap(item => item.outputs || []);
  if (outputs.length > 1 && !leftId.value) {
    leftId.value = outputs[0].id;
    rightId.value = outputs[1].id;
  }
  await loadProfiles(outputs);
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
.cartoon-devices { display: flex; gap: 12px; margin-top: 8px; }
.cartoon-device { width: 120px; }
.cartoon-device__frame { width: 100%; overflow: hidden; background: #111; }
.cartoon-device__frame video,
.cartoon-device__frame img { width: 100%; height: 100%; object-fit: cover; }
</style>
