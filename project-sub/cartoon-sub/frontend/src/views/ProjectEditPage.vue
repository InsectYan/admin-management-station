<template>
  <PageShell :title="store.project?.name ? `${store.project.name} · 剪辑` : '剪辑成片'" :loading="!loaded">
    <template #extra>
      <el-button :disabled="!canMake()" :loading="importing" @click="pickImport">导入视频</el-button>
      <input ref="importInput" class="cartoon-edit-file" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv" @change="onImportFile" />
      <el-button v-if="route.name !== 'workbench'" @click="router.push(`/projects/${projectId}`)">返回详情</el-button>
      <el-button :disabled="!canMake() || !store.past.length" @click="store.undo()">撤销</el-button>
      <el-button :disabled="!canMake() || !store.future.length" @click="store.redo()">重做</el-button>
      <el-button type="primary" :disabled="!canMake() || !store.edit || !store.dirty" :loading="saving" @click="save">保存</el-button>
      <el-button type="primary" plain :disabled="!canMake() || !canExport" :loading="exporting" @click="startExport">导出成片</el-button>
    </template>

    <el-tabs v-if="loaded" v-model="composeTab" class="cartoon-edit-tabs">
      <el-tab-pane label="预览" name="preview">
        <div class="cartoon-edit-preview">
          <el-alert
            v-if="!store.tools.ffmpeg"
            class="cartoon-edit-alert"
            type="warning"
            show-icon
            :closable="false"
            title="本机没有 ffmpeg，只能预览"
          />
          <p v-else-if="store.dirty" class="cartoon-module__hint">先保存，再导出。字幕和背景音乐这一期不会烧进成片。</p>

          <section v-if="!store.edit" class="cartoon-module">
            <el-empty description="还没有成片时间线" />
            <p class="cartoon-module__hint">先在分镜上生成视频，再按镜序排进时间线。</p>
            <el-button type="primary" :disabled="!canMake()" :loading="seeding" @click="seed(false)">从产物排列</el-button>
          </section>

          <template v-else>
            <div class="cartoon-edit-layout">
              <PreviewStage />
              <ClipInspector
                :imports="composeImports"
                :import-id="composeImportId"
                :busy="seeding"
                @snapshot="applySnapshot"
              />
            </div>
            <TimelineBoard />
            <div class="cartoon-edit-toolbar">
              <el-button :disabled="!canMake()" :loading="seeding" @click="seed(true)">重新从产物排列</el-button>
              <el-radio-group :model-value="canvasKey" @change="onCanvas">
                <el-radio-button value="portrait">竖版 720×1280</el-radio-button>
                <el-radio-button value="landscape">横版 1280×720</el-radio-button>
              </el-radio-group>
            </div>
            <p v-if="job" class="cartoon-module__hint" :class="{ 'is-error': job.error_message }">导出{{ jobLabel }}<span v-if="job.error_message">：{{ job.error_message }}</span></p>
            <el-progress v-if="job && (job.status === 'queued' || job.status === 'running')" :percentage="job.progress || 0" />
          </template>
        </div>
      </el-tab-pane>
      <el-tab-pane label="本地视频" name="local">
        <section class="cartoon-edit-imports">
          <h3 class="cartoon-module__title">导入的视频</h3>
          <p class="cartoon-module__hint">这些视频只放在本机临时目录，不写入数据库。可以删除。它们会出现在「绑定的视频」里，选中后当前片段改用这条；点「加入剪辑」会在时间线末尾再加一段。保存后才会写进时间线。</p>
          <div class="cartoon-edit-import-scroll">
            <el-empty v-if="!importedVideos.length" description="还没有导入的视频" />
            <div v-else class="cartoon-edit-import-grid">
              <article v-for="item in importedVideos" :key="item.id" class="cartoon-edit-import">
                <video :src="importUrl(item)" controls muted playsinline></video>
                <p>{{ item.description || '导入视频' }}</p>
                <p class="cartoon-module__hint">{{ item.duration_ms ? `${Math.round(item.duration_ms / 1000)} 秒` : '没有时长' }}</p>
                <div>
                  <el-button link type="primary" :disabled="!canMake() || item.missing || !item.duration_ms" @click="addImport(item)">加入剪辑</el-button>
                  <el-button link type="danger" :disabled="!canMake()" @click="removeImport(item)">删除</el-button>
                </div>
              </article>
            </div>
          </div>
        </section>
      </el-tab-pane>
      <el-tab-pane label="导出视频" name="exported">
        <section class="cartoon-edit-imports">
          <h3 class="cartoon-module__title">导出的视频</h3>
          <p class="cartoon-module__hint">每次导出的成片都留在这里，并记下所属项目。点「查看」可预览这一条成片。</p>
          <p v-if="job && (job.status === 'queued' || job.status === 'running')" class="cartoon-module__hint">导出{{ jobLabel }}</p>
          <el-progress v-if="job && (job.status === 'queued' || job.status === 'running')" :percentage="job.progress || 0" />
          <div class="cartoon-edit-import-scroll">
            <el-empty v-if="!store.exports.length" description="还没有导出的成片" />
            <div v-else class="cartoon-edit-import-grid">
              <article v-for="item in store.exports" :key="item.id" class="cartoon-edit-import">
                <video :src="fileUrl(item.id)" controls muted playsinline></video>
                <p>{{ item.title || '成片' }} · #{{ item.id }}</p>
                <p class="cartoon-module__hint">{{ exportMeta(item) }}</p>
                <p class="cartoon-module__hint">{{ item.project_name || store.project?.name || '当前项目' }} · {{ exportWhen(item.created_at) }}</p>
                <div>
                  <el-button link type="primary" @click="openFinal(item)">查看</el-button>
                </div>
              </article>
            </div>
          </div>
        </section>
      </el-tab-pane>
    </el-tabs>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import PreviewStage from '../components/edit/PreviewStage.vue';
import TimelineBoard from '../components/edit/TimelineBoard.vue';
import ClipInspector from '../components/edit/ClipInspector.vue';
import { useEditTimelineStore } from '../stores/editTimeline.js';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const route = useRoute();
const router = useRouter();
const store = useEditTimelineStore();
const projectId = computed(() => route.params.id);
const loaded = ref(false);
const saving = ref(false);
const seeding = ref(false);
const exporting = ref(false);
const importing = ref(false);
const composeTab = ref('preview');
const importInput = ref(null);
const job = ref(null);
const composeImports = ref([]);
const composeImportId = ref('');
let pollTimer = null;

const canvasKey = computed(() => {
  if (store.edit?.width === 1280 && store.edit?.height === 720) return 'landscape';
  if (store.edit?.width === 720 && store.edit?.height === 1280) return 'portrait';
  return '';
});
const canExport = computed(() => store.edit && store.tools.ffmpeg && !store.dirty && store.clips.length && !exporting.value);
const importedVideos = computed(() => (store.videos || []).filter(item => item.local));
const jobLabel = computed(() => ({ queued: '排队', running: '进行中', success: '完成', failed: '失败' }[job.value?.status] || ''));

function fileUrl(id) {
  return `${resolveApiBase()}/outputs/${id}/file`;
}
function exportMeta(item) {
  const parts = [];
  if (item.duration_ms) parts.push(`${Math.round(item.duration_ms / 1000)} 秒`);
  if (item.width && item.height) parts.push(`${item.width}×${item.height}`);
  return parts.join(' · ') || '成片';
}
function exportWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function importUrl(item) {
  return `${resolveApiBase()}/projects/${projectId.value}/edit/imports/${item.name}/file`;
}
function pickImport() {
  importInput.value?.click();
}
async function onImportFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const body = new FormData();
  body.append('file', file, file.name);
  importing.value = true;
  try {
    const item = await request(`/projects/${projectId.value}/edit/imports`, {
      method: 'post',
      data: body,
      timeout: 10 * 60 * 1000,
    });
    store.videos = [ ...store.videos.filter(row => row.id !== item.id), item ];
    ElMessage.success('已导入。可以在绑定的视频里选用，或点加入剪辑');
  } catch (err) {
    ElMessage.error(err.message || '没有导入');
  } finally {
    importing.value = false;
  }
}
async function addImport(item) {
  try {
    if (!store.edit) {
      const payload = await request(`/projects/${projectId.value}/edit/open`, { method: 'post' });
      takePayload(payload);
    }
    if (!store.appendVideo(item)) {
      ElMessage.error('这条视频没有时长，不能加入时间线');
      return;
    }
    ElMessage.success('已加入时间线，保存后写入');
  } catch (err) {
    ElMessage.error(err.message || '没有加入');
  }
}
async function removeImport(item) {
  try {
    await ElMessageBox.confirm('删除这条导入视频？时间线上还用着它的片段会缺素材。', '删除导入视频', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await request(`/projects/${projectId.value}/edit/imports/${item.name}`, { method: 'delete' });
    store.forgetImport(item.name);
    ElMessage.success('已删除');
  } catch (err) {
    ElMessage.error(err.message || '没有删除');
  }
}
function openFinal(row) {
  router.replace({ query: { node: 'preview', final: String(row.id) } });
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
function takePayload(payload) {
  composeImports.value = payload?.imports || [];
  store.applyPayload(payload);
}
async function reload() {
  const params = {};
  if (composeImportId.value) params.import_id = composeImportId.value;
  const payload = await request(`/projects/${projectId.value}/edit`, { params });
  takePayload(payload);
}
async function save() {
  if (!store.edit) return;
  saving.value = true;
  try {
    const payload = await request(`/projects/${projectId.value}/edit`, {
      method: 'put',
      params: composeImportId.value ? { import_id: composeImportId.value } : {},
      data: {
        updated_at: store.edit.updated_at,
        title: store.edit.title,
        width: store.edit.width,
        height: store.edit.height,
        fps: store.edit.fps,
        tracks: store.edit.tracks.map(track => ({
          kind: track.kind,
          volume: track.volume,
          muted: track.muted,
          clips: track.clips.map(clip => ({
            source_output_id: clip.source_import ? null : clip.source_output_id,
            source_import: clip.source_import || '',
            start_ms: clip.start_ms,
            duration_ms: clip.duration_ms,
            trim_in_ms: clip.trim_in_ms,
            text: clip.text || '',
            sort_order: clip.sort_order,
          })),
        })),
      },
    });
    takePayload(payload);
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
async function seed(replace) {
  if (replace) {
    try {
      await ElMessageBox.confirm('视频轨会按当前产物重排。', '重新排列');
    } catch {
      return;
    }
  }
  seeding.value = true;
  try {
    const payload = await request(`/projects/${projectId.value}/edit/seed`, {
      method: 'post',
      data: {
        replace,
        ...(composeImportId.value ? { import_id: Number(composeImportId.value) } : {}),
      },
    });
    takePayload(payload);
    if (payload.skipped?.length) {
      ElMessage.warning(payload.skipped.map(item => `分镜 ${item.shot_id}：${item.reason}`).join('；'));
    } else {
      ElMessage.success('已按镜序排列');
    }
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    seeding.value = false;
  }
}
async function applySnapshot(value) {
  const next = value ? String(value) : '';
  const previous = composeImportId.value;
  composeImportId.value = next;
  seeding.value = true;
  try {
    const payload = await request(`/projects/${projectId.value}/edit/seed`, {
      method: 'post',
      data: {
        replace: Boolean(store.edit),
        ...(next ? { import_id: Number(next) } : {}),
      },
    });
    takePayload(payload);
    ElMessage.success(next ? '已按这个快照重新排列' : '已恢复全部镜头的排列');
  } catch (err) {
    composeImportId.value = previous;
    ElMessage.error(err.message);
  } finally {
    seeding.value = false;
  }
}
function onCanvas(value) {
  if (value === 'landscape') store.setCanvas(1280, 720);
  else store.setCanvas(720, 1280);
}
async function startExport() {
  exporting.value = true;
  try {
    job.value = await request(`/projects/${projectId.value}/edit/export`, { method: 'post' });
    stopPoll();
    pollTimer = setInterval(async () => {
      job.value = await request(`/edit-jobs/${job.value.id}`);
      if (![ 'queued', 'running' ].includes(job.value.status)) {
        stopPoll();
        exporting.value = false;
        if (job.value.status === 'success') {
          ElMessage.success('成片已导出');
          composeTab.value = 'exported';
          await reload();
        } else {
          ElMessage.error(job.value.error_message || '导出失败');
        }
      }
    }, 2000);
  } catch (err) {
    exporting.value = false;
    ElMessage.error(err.message);
  }
}
onMounted(async () => {
  try {
    await reload();
    if (!store.edit && store.videos.some(item => item.shot_id && !item.missing && item.duration_ms)) {
      await seed(false);
      return;
    }
    if (store.useLatestPerShot()) {
      ElMessage.info('已按每个镜头的最新视频选好，保存后写入时间线');
    }
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loaded.value = true;
  }
});
onUnmounted(stopPoll);
</script>

<style scoped>
.cartoon-edit-tabs {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cartoon-edit-tabs :deep(.el-tabs__header) { flex: none; margin-bottom: 12px; }
.cartoon-edit-tabs :deep(.el-tabs__content) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.cartoon-edit-tabs :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.cartoon-edit-preview {
  min-height: 0;
  overflow: auto;
}
.cartoon-edit-alert { margin-bottom: 12px; }
.cartoon-edit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
  gap: 16px;
}
.cartoon-edit-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
.cartoon-edit-file { display: none; }
.cartoon-edit-imports {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cartoon-edit-import-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}
.cartoon-edit-import-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; align-content: start; }
.cartoon-edit-import { padding: 10px; border: 1px solid rgba(47, 138, 91, 0.16); border-radius: 12px; background: #f7fbf8; }
.cartoon-edit-import video { display: block; width: 100%; max-height: 160px; background: #111; border-radius: 8px; }
.cartoon-edit-import p { margin: 8px 0 0; }
@media (max-width: 960px) {
  .cartoon-edit-layout { grid-template-columns: 1fr; }
}
</style>
