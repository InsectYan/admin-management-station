<template>
  <PageShell :loading="loading && !loaded">
    <template #extra>
      <el-button link type="primary" @click="back">← 返回</el-button>
      <el-button v-if="shot" :disabled="!canMake()" @click="openGenerate">继续生成</el-button>
      <el-button @click="openEdit">剪辑成片</el-button>
    </template>
    <section class="cartoon-module cartoon-preview-page">
      <el-empty v-if="loaded && !shot" description="没有找到这条分镜" />
      <el-tabs v-else-if="loaded" v-model="previewTab">
        <el-tab-pane label="资产" name="assets">
          <el-empty v-if="!tasks.length" description="这条分镜还没有产物" />
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
          <el-table v-if="submitRows.length" :data="submitRows" row-key="key" size="small" style="margin-bottom: 12px">
            <el-table-column label="记录" width="90" prop="record" />
            <el-table-column label="提交" width="90" prop="part" />
            <el-table-column label="工作流" min-width="180" prop="workflow" />
            <el-table-column label="尺寸" width="130" prop="size" />
            <el-table-column label="种子" width="120" prop="seed" />
            <el-table-column label="生成时间" width="120" prop="elapsed" />
            <el-table-column label="参考图" width="90" prop="refs" />
            <el-table-column label="提示词字数" width="110" prop="chars" />
            <el-table-column label="状态" width="100" prop="status" />
          </el-table>
          <p v-else class="cartoon-module__hint">还没有生图或生视频的提交记录。</p>
          <article v-for="task in infoRecords" :key="task.id" class="cartoon-brief">
            <header class="cartoon-brief__head">
              <strong>{{ taskKindLabel(task) }} · {{ statusLabel(task.status) }}</strong>
              <span class="cartoon-record">记录 #{{ task.id }}</span>
              <div class="cartoon-brief__switch">
                <button type="button" :class="{ 'is-active': briefTab(task) === 'video' }" @click="setBriefTab(task, 'video')">视频</button>
                <button type="button" :class="{ 'is-active': briefTab(task) === 'start' }" @click="setBriefTab(task, 'start')">首帧</button>
                <button type="button" :class="{ 'is-active': briefTab(task) === 'end' }" @click="setBriefTab(task, 'end')">尾帧</button>
              </div>
            </header>
            <template v-if="panelOf(task)">
              <div v-if="panelPicture(task) || panelRefs(task).length" class="cartoon-brief__visual">
                <figure v-if="panelPicture(task)" class="cartoon-brief__product">
                  <video v-if="briefTab(task) === 'video'" :src="panelPicture(task)" controls></video>
                  <el-image
                    v-else
                    :src="panelPicture(task)"
                    fit="contain"
                    :preview-src-list="[panelPicture(task)]"
                    preview-teleported
                    hide-on-click-modal
                  />
                  <figcaption>{{ briefTab(task) === 'video' ? '成片' : (briefTab(task) === 'end' ? '尾帧' : '首帧') }}</figcaption>
                </figure>
                <div v-if="panelRefs(task).length" class="cartoon-brief__refs">
                  <figure v-for="item in panelRefs(task)" :key="item.url">
                    <el-image :src="item.url" fit="cover" :preview-src-list="panelRefs(task).map(row => row.url)" preview-teleported hide-on-click-modal />
                    <figcaption>{{ item.label }}</figcaption>
                  </figure>
                </div>
              </div>
              <dl class="cartoon-brief__list">
                <div>
                  <dt>工作流</dt>
                  <dd>
                    {{ panelOf(task).generation?.workflow_name || '没有记下名称' }}
                    <template v-if="panelOf(task).generation?.workflow_id"> · #{{ panelOf(task).generation.workflow_id }}</template>
                    <a
                      v-if="panelOf(task).generation?.workflow_id"
                      class="cartoon-precheck-link"
                      :href="precheckHref(panelOf(task).generation.workflow_id)"
                      target="_blank"
                      rel="noreferrer"
                    >打开预检</a>
                  </dd>
                </div>
                <div v-if="!panelRefs(task).length || panelRefsLive(task)">
                  <dt>参考图</dt>
                  <dd>
                    <p v-if="panelRefs(task).length && panelRefsLive(task)" class="cartoon-module__hint">当时没有单独存档，这里显示资产里现在的设定图。</p>
                    <template v-else>{{ refEmptyText(task) }}</template>
                  </dd>
                </div>
                <div>
                  <dt>涉及资产</dt>
                  <dd>
                    <template v-if="(panelOf(task).generation?.assets || []).length">
                      <span v-if="panelOf(task).generation.assets_from_prompt" class="cartoon-module__hint">从提交的提示词里读到：</span>
                      <span v-for="asset in panelOf(task).generation.assets" :key="asset.id" class="cartoon-brief__asset">
                        {{ assetKindLabel(asset.kind) }}「{{ asset.name }}」
                      </span>
                    </template>
                    <template v-else-if="panelOf(task).generation?.assets_recorded">这次生成没有关联资产</template>
                    <template v-else>这次生成没有记下涉及资产</template>
                  </dd>
                </div>
                <div>
                  <dt>提交的提示词</dt>
                  <dd><pre class="cartoon-brief__prompt">{{ panelOf(task).generation?.positive || '没有留下提交时的提示词' }}</pre></dd>
                </div>
                <div>
                  <dt>负向提示词</dt>
                  <dd><pre class="cartoon-brief__prompt">{{ panelOf(task).generation?.negative || '无' }}</pre></dd>
                </div>
                <div>
                  <dt>生成参数</dt>
                  <dd>
                    种子 {{ panelOf(task).generation?.seed ?? '未记' }}
                    · 生成时间 {{ elapsedText(panelOf(task).generation, panelOf(task)) }}
                    <template v-if="briefTab(task) === 'video'"> · 成片时长 {{ durationText(panelOf(task)) }}</template>
                    <template v-if="panelOf(task).generation?.width && panelOf(task).generation?.height">
                      · {{ panelOf(task).generation.width }} × {{ panelOf(task).generation.height }}
                    </template>
                    · 操作人 {{ panelOf(task).operator_name || task.operator_name || '未记' }}
                  </dd>
                </div>
              </dl>
              <p v-if="panelOf(task).error_message || (briefTab(task) === 'video' && task.error_message)" class="cartoon-output__error">
                {{ panelOf(task).error_message || task.error_message }}
              </p>
            </template>
            <div v-else>
              <div v-if="panelPicture(task)" class="cartoon-brief__visual">
                <figure class="cartoon-brief__product">
                  <el-image :src="panelPicture(task)" fit="contain" :preview-src-list="[panelPicture(task)]" preview-teleported hide-on-click-modal />
                  <figcaption>{{ briefTab(task) === 'end' ? '尾帧' : '首帧' }}</figcaption>
                </figure>
              </div>
              <p class="cartoon-module__hint">{{ emptyBrief(task) }}</p>
            </div>
          </article>
        </el-tab-pane>
        <el-tab-pane label="提示词" name="prompt">
          <PromptTracePanel :shot-id="shotId" />
        </el-tab-pane>
      </el-tabs>
    </section>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import MediaFileList from '../components/MediaFileList.vue';
import PageShell from '../components/PageShell.vue';
import PromptTracePanel from '../components/PromptTracePanel.vue';
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
const assets = ref([]);
const loaded = ref(false);
const profiles = ref({});
const leftId = ref(null);
const rightId = ref(null);
const frames = ref([]);
const previewTab = ref('assets');
const briefTabs = reactive({});
const VIDEO_KINDS = new Set([ 'video', 'i2v', 't2v', 'refmod' ]);
const infoRecords = computed(() => {
  const hidden = new Set();
  tasks.value.forEach(task => {
    const startId = Number(task.generation?.frame_start?.id);
    const endId = Number(task.generation?.frame_end?.id);
    if (startId) hidden.add(startId);
    if (endId) hidden.add(endId);
  });
  return tasks.value.filter(task => !hidden.has(Number(task.id)));
});
function submitLine(part, generation, task) {
  if (!generation) return null;
  return {
    key: `${task.id}-${part}`,
    record: `#${task.id}`,
    part,
    workflow: generation.workflow_name || '未记',
    size: generation.width && generation.height ? `${generation.width} × ${generation.height}` : '—',
    seed: generation.seed ?? '—',
    elapsed: elapsedText(generation, task),
    refs: Array.isArray(generation.references) ? generation.references.length : 0,
    chars: String(generation.positive || '').length,
    status: statusLabel(task.status),
  };
}
const submitRows = computed(() => infoRecords.value.flatMap(task => {
  const generation = task.generation || {};
  if (isVideoTask(task)) {
    return [
      submitLine('视频', generation, task),
      submitLine('首帧', generation.frame_start?.generation, generation.frame_start || task),
      submitLine('尾帧', generation.frame_end?.generation, generation.frame_end || task),
    ].filter(Boolean);
  }
  return [ submitLine(generation.part === 'end' ? '尾帧' : '生图', generation, task) ].filter(Boolean);
}));
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
function isVideoTask(task) {
  return VIDEO_KINDS.has(task?.kind);
}
function briefTab(task) {
  return briefTabs[task.id] || 'video';
}
function setBriefTab(task, name) {
  briefTabs[task.id] = name;
}
function panelOf(task) {
  const tab = briefTab(task);
  if (tab === 'video') {
    if (!isVideoTask(task)) return null;
    return {
      id: task.id,
      generation: task.generation || {},
      outputs: task.outputs || [],
      operator_name: task.operator_name,
      error_message: task.error_message,
    };
  }
  if (isVideoTask(task)) {
    const frame = tab === 'end' ? task.generation?.frame_end : task.generation?.frame_start;
    return frame || null;
  }
  const part = task.generation?.part === 'end' ? 'end' : 'start';
  if (tab !== part) return null;
  return {
    id: task.id,
    generation: task.generation || {},
    outputs: task.outputs || [],
    operator_name: task.operator_name,
    error_message: task.error_message,
  };
}
function emptyBrief(task) {
  const tab = briefTab(task);
  if (tab === 'video') return '这条记录没有视频。';
  return tab === 'end' ? '这条记录没有单独生成尾帧。' : '这条记录没有单独生成首帧。';
}
function panelPicture(task) {
  const panel = panelOf(task);
  const image = (panel?.outputs || []).find(item => (briefTab(task) === 'video' ? item.media_kind === 'video' : item.media_kind !== 'video'));
  if (image) return fileUrl(image.id);
  if (briefTab(task) === 'video' || !shot.value) return '';
  if (briefTab(task) === 'end') {
    if (!shot.value.end_frame_mtime) return '';
    return `${resolveApiBase()}/projects/${projectId.value}/shots/${shotId.value}/frame/end?v=${shot.value.end_frame_mtime}`;
  }
  const which = shot.value.manual_frame_path ? 'manual' : (shot.value.first_frame_path ? 'auto' : '');
  if (!which) return '';
  const version = which === 'manual' ? shot.value.manual_frame_mtime : shot.value.first_frame_mtime;
  return `${resolveApiBase()}/projects/${projectId.value}/shots/${shotId.value}/frame/${which}?v=${version || 1}`;
}
function liveAssetRefs(text) {
  return assets.value
    .filter(asset => (asset.kind === 'character' || asset.kind === 'scene') && asset.name && asset.reference_path && String(text || '').includes(asset.name))
    .sort((a, b) => String(b.name).length - String(a.name).length)
    .filter((asset, index, list) => !list.slice(0, index).some(kept => String(kept.name).includes(asset.name)));
}
function panelRefs(task) {
  const panel = panelOf(task);
  if (!panel) return [];
  const archived = panel.generation?.references || [];
  if (archived.length) {
    return archived.map(item => ({
      label: item.label || '参考图',
      url: `${resolveApiBase()}/tasks/${panel.id}/refs/${item.index}`,
      live: false,
    }));
  }
  return liveAssetRefs(panel.generation?.positive).map(asset => ({
    label: `${asset.kind === 'scene' ? '场景' : '人物'}「${asset.name}」`,
    url: String(asset.reference_path).startsWith('/') ? `${resolveApiBase()}${asset.reference_path}` : '',
    live: true,
  })).filter(item => item.url);
}
function panelRefsLive(task) {
  return panelRefs(task).some(item => item.live);
}
function refEmptyText(task) {
  const name = panelOf(task)?.generation?.workflow_name || '';
  if (name.includes('文生图')) return '这条是文生图，没有参考图。';
  return '这次没有记下参考图。';
}
function assetKindLabel(kind) {
  return { character: '人物', scene: '场景', prop: '道具' }[kind] || '资产';
}
function formatElapsed(ms) {
  const sec = Math.max(1, Math.round(ms / 1000));
  if (sec < 60) return `${sec} 秒`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest ? `${min} 分 ${rest} 秒` : `${min} 分`;
}
function elapsedText(generation, task) {
  const stored = Number(generation?.elapsed_ms);
  if (stored > 0) return formatElapsed(stored);
  const start = Date.parse(task?.created_at || task?.createdAt || '');
  const end = Date.parse(task?.updated_at || task?.updatedAt || '');
  if (task?.status === 'success' && Number.isFinite(start) && Number.isFinite(end) && end > start && end - start < 3 * 60 * 60 * 1000) {
    return formatElapsed(end - start);
  }
  return '未记';
}
function durationText(source) {
  const sec = Number(generationOf(source).duration_sec);
  if (sec > 0) return `${sec} 秒`;
  const ms = (source?.outputs || []).map(item => Number(item.duration_ms)).find(value => value > 0);
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
    const query = { node: 'preview' };
    if (route.query.import) query.import = String(route.query.import);
    router.replace({ query });
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
    assets.value = detail.assets || [];
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
.cartoon-preview-page { min-height: 0; }
.cartoon-preview-page :deep(.el-tabs) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cartoon-preview-page :deep(.el-tabs__header) { flex: none; }
.cartoon-preview-page :deep(.el-tabs__content) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.cartoon-preview-page :deep(.el-tab-pane) {
  height: 100%;
  overflow: auto;
}
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
.cartoon-brief__head { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.cartoon-brief__switch { display: inline-flex; border: 1px solid rgba(47, 138, 91, 0.35); border-radius: 6px; overflow: hidden; }
.cartoon-brief__switch button {
  border: 0;
  background: transparent;
  padding: 2px 10px;
  color: #1f3d2c;
  cursor: pointer;
}
.cartoon-brief__switch button.is-active { background: #2f8a5b; color: #fff; }
.cartoon-brief__visual { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 3fr); gap: 12px; align-items: start; margin-top: 12px; }
.cartoon-brief__visual:not(:has(.cartoon-brief__refs)),
.cartoon-brief__visual:not(:has(.cartoon-brief__product)) { grid-template-columns: minmax(0, 1fr); }
.cartoon-brief__visual:not(:has(.cartoon-brief__refs)) .cartoon-brief__product { max-width: 25%; }
.cartoon-brief__product { width: 100%; min-width: 0; margin: 0; }
.cartoon-brief__product video,
.cartoon-brief__product :deep(.el-image) {
  width: 100%;
  max-height: 220px;
  border-radius: 8px;
  background: #111;
  display: block;
  object-fit: contain;
}
.cartoon-brief__refs { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.cartoon-brief__refs figure { margin: 0; width: 96px; }
.cartoon-brief__refs :deep(.el-image) {
  width: 96px;
  height: 96px;
  border-radius: 8px;
  background: #eef3ef;
}
.cartoon-brief__product figcaption,
.cartoon-brief__refs figcaption { margin-top: 4px; color: #5c6b62; font-size: 12px; line-height: 1.4; }
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
