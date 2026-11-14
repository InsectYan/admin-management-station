<template>
  <PageShell :loading="loading && !loaded">
    <template #extra>
      <el-button link type="primary" @click="back">← 返回</el-button>
      <el-button v-if="shot" :disabled="!canMake()" @click="openGenerate">继续生成</el-button>
      <el-button @click="openEdit">剪辑成片</el-button>
    </template>
    <section class="cartoon-module">
      <el-empty v-if="loaded && !tasks.length" description="这条分镜还没有产物" />
      <el-tabs v-else-if="loaded" v-model="previewTab">
        <el-tab-pane label="资产" name="assets">
          <section v-if="outputChoices.length > 1" class="cartoon-compare">
            <span class="cartoon-compare__label">逐帧对比</span>
            <el-select v-model="leftId" style="width: 140px">
              <el-option v-for="item in outputChoices" :key="`l-${item.id}`" :label="`产物 ${item.id}`" :value="item.id" />
            </el-select>
            <el-select v-model="rightId" style="width: 140px">
              <el-option v-for="item in outputChoices" :key="`r-${item.id}`" :label="`产物 ${item.id}`" :value="item.id" />
            </el-select>
            <el-button @click="compare">对比</el-button>
            <span v-if="frames.length" class="cartoon-module__hint">
              <template v-for="frame in frames" :key="frame.index">第 {{ frame.index }} 秒{{ frame.same ? '一致' : '有差异' }}　</template>
            </span>
          </section>
          <div class="cartoon-output-wrap">
            <div class="cartoon-output-grid" :class="{ 'is-single': cards.length === 1 }">
              <el-card v-for="card in cards" :key="card.key" shadow="never" class="cartoon-output">
                <div class="cartoon-output__head">
                  <p>
                    <span class="cartoon-record">记录 #{{ card.task.id }}</span>
                    {{ statusLabel(card.task.status) }} · {{ taskKindLabel(card.task) }}
                    <template v-if="card.output"> · {{ stageLabel(card.output.version_stage) }} · {{ faceLabel(card.output) }}</template>
                  </p>
                  <el-button
                    v-if="!busy(card.task)"
                    link
                    type="danger"
                    @click="card.output ? removeOutput(card.output) : removeTask(card.task)"
                  >删除</el-button>
                </div>
                <el-progress
                  v-if="busy(card.task)"
                  :percentage="percentOf(card.task)"
                  :indeterminate="percentOf(card.task) === 0 && !(Number(card.task.progress_max) > 0)"
                  :stroke-width="8"
                  color="#2f8a5b"
                />
                <p v-if="busy(card.task)" class="cartoon-module__hint">{{ progressText(card.task) }}</p>
                <p v-if="card.task.error_message" class="cartoon-output__error">{{ card.task.error_message }}</p>
                <div v-if="card.output" class="cartoon-output-file">
                  <div class="cartoon-output-media">
                    <MediaFileList :items="[fileItem(card.output)]" :show-name="false" @remove="removeOutput(card.output)" />
                  </div>
                  <div class="cartoon-output-side">
                    <div v-if="profilesOf(card.output.id).length" class="cartoon-devices">
                      <div v-for="profile in profilesOf(card.output.id)" :key="profile.id" class="cartoon-device">
                        <span>{{ profile.label }}</span>
                        <div class="cartoon-device__frame" :style="{ aspectRatio: profile.ratio }">
                          <video v-if="card.output.media_kind === 'video'" :src="profileSrc(profile, card.output.id)" muted preload="metadata"></video>
                          <img v-else :src="profileSrc(profile, card.output.id)" :alt="profile.label" />
                        </div>
                      </div>
                    </div>
                    <div class="cartoon-output__marks">
                      <el-button size="small" @click="markFace(card.output, true)">画面正常</el-button>
                      <el-button size="small" @click="markFace(card.output, false)">有串脸</el-button>
                    </div>
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="基础信息" name="info">
          <article v-for="task in tasks" :key="task.id" class="cartoon-brief">
            <header class="cartoon-brief__head">
              <strong>{{ taskKindLabel(task) }} · {{ statusLabel(task.status) }}</strong>
              <span class="cartoon-record">记录 #{{ task.id }}</span>
            </header>
            <dl class="cartoon-brief__list">
              <div>
                <dt>工作流</dt>
                <dd>
                  {{ generationOf(task).workflow_name || '没有记下名称' }}
                  <template v-if="generationOf(task).workflow_id"> · #{{ generationOf(task).workflow_id }}</template>
                  <a
                    v-if="generationOf(task).workflow_id"
                    class="cartoon-precheck-link"
                    :href="precheckHref(generationOf(task).workflow_id)"
                    target="_blank"
                    rel="noreferrer"
                  >打开预检</a>
                </dd>
              </div>
              <div>
                <dt>涉及资产</dt>
                <dd>
                  <template v-if="generationOf(task).assets.length">
                    <span v-if="generationOf(task).assets_from_prompt" class="cartoon-module__hint">从提交的提示词里读到：</span>
                    <span v-for="asset in generationOf(task).assets" :key="asset.id" class="cartoon-brief__asset">
                      {{ assetKindLabel(asset.kind) }}「{{ asset.name }}」
                    </span>
                  </template>
                  <template v-else-if="generationOf(task).assets_recorded">这次生成没有关联资产</template>
                  <template v-else>这次生成没有记下涉及资产</template>
                </dd>
              </div>
              <div>
                <dt>提交的提示词</dt>
                <dd><pre class="cartoon-brief__prompt">{{ generationOf(task).positive || '没有留下提交时的提示词' }}</pre></dd>
              </div>
              <div>
                <dt>负向提示词</dt>
                <dd><pre class="cartoon-brief__prompt">{{ generationOf(task).negative || '无' }}</pre></dd>
              </div>
              <div>
                <dt>生成参数</dt>
                <dd>
                  种子 {{ generationOf(task).seed ?? '未记' }}
                  · 时长 {{ durationText(task) }}
                  · 操作人 {{ task.operator_name || '未记' }}
                  <template v-if="task.model_profile"> · 模型 {{ task.model_profile }}</template>
                </dd>
              </div>
            </dl>
            <p v-if="task.error_message" class="cartoon-output__error">{{ task.error_message }}</p>
          </article>
        </el-tab-pane>
      </el-tabs>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import MediaFileList from '../components/MediaFileList.vue';
import PageShell from '../components/PageShell.vue';
import { useRegionLoad } from '../lib/useRegionLoad.js';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';
import { taskKindLabel } from '../lib/taskKind.js';

const props = defineProps({
  reloadToken: { type: String, default: '' },
});
const route = useRoute();
const router = useRouter();
const shot = ref(null);
const tasks = ref([]);
const loaded = ref(false);
const profiles = ref({});
const leftId = ref(null);
const rightId = ref(null);
const frames = ref([]);
const previewTab = ref('assets');
const outputChoices = computed(() => tasks.value.flatMap(item => item.outputs || []));
const cards = computed(() => tasks.value.flatMap(task => {
  const outputs = task.outputs || [];
  if (!outputs.length) return [{ key: `task-${task.id}`, task, output: null }];
  return outputs.map(output => ({ key: `out-${output.id}`, task, output }));
}));
let pollTimer = null;
const projectId = computed(() => route.params.id);
const shotId = computed(() => route.params.shotId || route.query.shot);
const inWorkbench = computed(() => route.name === 'workbench');

function percentOf(task) {
  if (!task) return 0;
  if (task.status === 'saving') return 99;
  const max = Number(task.progress_max) || 0;
  const value = Number(task.progress_value) || 0;
  if (max > 0) return Math.min(99, Math.round((value / max) * 100));
  const percent = Number(task.progress_percent);
  return Number.isFinite(percent) ? Math.min(99, Math.max(0, Math.round(percent))) : 0;
}
function progressText(task) {
  if (task.status === 'saving') return '正在保存产物';
  if (task.phase === 'queued') {
    return task.queue_ahead > 0 ? `排队，前面还有 ${task.queue_ahead} 个` : '排队中';
  }
  if (task.progress_max > 0) {
    const node = task.node ? `节点 ${task.node} ` : '';
    return `${node}${task.progress_value}/${task.progress_max}`;
  }
  if (task.node) return `节点 ${task.node}，等待这一步的步数`;
  return '正在生成，等待 ComfyUI 回报步数';
}
function busy(task) {
  return [ 'queued', 'running', 'saving' ].includes(task?.status);
}
function generationOf(task) {
  return task?.generation || {};
}
function assetKindLabel(kind) {
  return { character: '人物', scene: '场景', prop: '道具' }[kind] || '资产';
}
function durationText(task) {
  const sec = Number(generationOf(task).duration_sec);
  if (sec > 0) return `${sec} 秒`;
  const ms = (task.outputs || []).map(item => Number(item.duration_ms)).find(value => value > 0);
  if (ms) return `成片 ${Math.round(ms / 1000)} 秒`;
  return '未记';
}
function statusLabel(status) {
  return { queued: '排队', running: '生成中', saving: '生成中', success: '成功', failed: '失败', cancelled: '已取消' }[status] || status;
}
function precheckHref(id) {
  const origin = import.meta.env.VITE_PRECHECK_ORIGIN || 'http://localhost:5104';
  return `${origin.replace(/\/$/, '')}/workflows?id=${id}`;
}
function fileUrl(id) { return `${resolveApiBase()}/outputs/${id}/file`; }
function fileItem(output) {
  return {
    id: output.id,
    url: fileUrl(output.id),
    kind: output.media_kind === 'video' ? 'video' : 'image',
    name: `${stageLabel(output.version_stage)} #${output.id}`,
  };
}
function stageLabel(stage) {
  return { draft: '草稿', generated: '生成版', revised: '修改版', final: '最终交付版', frame_first: '视频首帧', frame_last: '视频尾帧' }[stage] || '生成版';
}
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
  frames.value = [];
  try {
    const data = await request(`/projects/${projectId.value}/frame-diff`, {
      params: { left: leftId.value, right: rightId.value },
    });
    frames.value = data.frames || [];
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function removeTask(task) {
  await ElMessageBox.confirm('删除这条生成记录和它带的产物？剪辑里用到这些产物的片段会失去画面。', '删除产物', { type: 'warning' });
  await request(`/tasks/${task.id}`, { method: 'delete' });
  await load();
  ElMessage.success('已删除生成记录');
}
async function removeOutput(output) {
  if ([ 'queued', 'running', 'saving' ].includes(tasks.value.find(item => (item.outputs || []).some(row => row.id === output.id))?.status)) {
    ElMessage.warning('正在生成的产物不能删除');
    return;
  }
  await ElMessageBox.confirm('删除这条产物？剪辑里用到它的片段会失去画面。', '删除产物', { type: 'warning' });
  await request(`/outputs/${output.id}`, { method: 'delete' });
  await load();
  ElMessage.success('已删除产物');
}
function back() {
  if (inWorkbench.value) {
    router.replace({ query: { node: 'preview' } });
    return;
  }
  if (route.query.from === 'work') {
    router.push({ path: `/projects/${projectId.value}/work`, query: { step: '4' } });
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
const { loading, run } = useRegionLoad({ immediate: true });
async function load() {
  const first = !loaded.value;
  const pull = async () => {
    const detail = await request(`/projects/${projectId.value}`);
    shot.value = (detail.shots || []).find(item => String(item.id) === String(shotId.value)) || null;
    tasks.value = (detail.tasks || []).filter(item => String(item.shot_id) === String(shotId.value));
    const outputs = tasks.value.flatMap(item => item.outputs || []);
    if (outputs.length > 1 && !leftId.value) {
      leftId.value = outputs[0].id;
      rightId.value = outputs[1].id;
    }
    await loadProfiles(outputs);
    loaded.value = true;
    const active = tasks.value.some(item => [ 'queued', 'running', 'saving' ].includes(item.status));
    if (active && !pollTimer) pollTimer = setInterval(load, 3000);
    if (!active) stopPoll();
  };
  if (first) await run(pull);
  else await pull();
}
watch(() => props.reloadToken, (value) => {
  if (value) load();
});
onMounted(load);
onUnmounted(stopPoll);
</script>

<style scoped>
.cartoon-compare { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px; }
.cartoon-compare__label { font-weight: 600; }
.cartoon-output-wrap { container-type: inline-size; }
.cartoon-output-grid { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
@container (min-width: 880px) {
  .cartoon-output-grid:not(.is-single) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.cartoon-output { margin: 0; }
.cartoon-output__head { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
.cartoon-output__head p { margin: 0; }
.cartoon-record { color: #2f8a5b; font-weight: 600; }
.cartoon-output__error { margin: 8px 0 0; color: #b54747; }
.cartoon-output-file { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
@container (min-width: 720px) {
  .cartoon-output-grid.is-single .cartoon-output-file { flex-direction: row; align-items: flex-start; }
}
.cartoon-output-grid:not(.is-single) .cartoon-output-media :deep(.media-file-list),
.cartoon-output-grid:not(.is-single) .cartoon-output-media :deep(.media-file-list__cell),
.cartoon-output-grid:not(.is-single) .cartoon-output-media :deep(.el-upload-list),
.cartoon-output-grid:not(.is-single) .cartoon-output-media :deep(.el-upload-list__item) {
  width: 100%;
}
.cartoon-output-grid:not(.is-single) .cartoon-output-media :deep(.el-upload-list__item) { height: 168px; }
.cartoon-output-side { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cartoon-output-grid.is-single .cartoon-output-side { flex: 1; }
.cartoon-output__marks { display: flex; flex-wrap: wrap; gap: 8px; }
.cartoon-precheck-link { margin-left: 8px; color: #2f8a5b; }
.cartoon-devices { display: flex; flex-wrap: wrap; gap: 8px; }
.cartoon-device { width: 96px; flex: 0 0 96px; }
.cartoon-device span { display: block; margin-bottom: 4px; color: #5c6b62; font-size: 12px; }
.cartoon-device__frame { width: 100%; overflow: hidden; background: #111; }
.cartoon-device__frame video,
.cartoon-device__frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cartoon-brief { padding: 12px 0; border-top: 1px solid #e6ebe7; }
.cartoon-brief:first-child { border-top: 0; padding-top: 0; }
.cartoon-brief__head { display: flex; gap: 12px; align-items: baseline; }
.cartoon-brief__list { display: grid; gap: 10px; margin: 10px 0 0; }
.cartoon-brief__list div { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px; }
.cartoon-brief__list dt { margin: 0; color: #5c6b62; }
.cartoon-brief__list dd { margin: 0; }
.cartoon-brief__asset { margin-right: 8px; }
.cartoon-brief__prompt {
  max-height: 220px;
  margin: 0;
  padding: 8px 10px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  background: #f6f7f4;
  border-radius: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
}
</style>
