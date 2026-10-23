<template>
  <PageShell :title="store.project?.name ? `${store.project.name} · 剪辑` : '剪辑成片'">
    <template #extra>
      <el-button v-if="route.name !== 'workbench'" @click="router.push(`/projects/${projectId}`)">返回详情</el-button>
      <el-button :disabled="!canMake() || !store.past.length" @click="store.undo()">撤销</el-button>
      <el-button :disabled="!canMake() || !store.future.length" @click="store.redo()">重做</el-button>
      <el-button type="primary" :disabled="!canMake() || !store.edit || !store.dirty" :loading="saving" @click="save">保存</el-button>
      <el-button type="primary" plain :disabled="!canMake() || !canExport" :loading="exporting" @click="startExport">导出成片</el-button>
    </template>

    <el-alert
      v-if="loaded && !store.tools.ffmpeg"
      class="cartoon-edit-alert"
      type="warning"
      show-icon
      :closable="false"
      title="本机没有 ffmpeg，只能预览"
    />
    <p v-else-if="store.dirty" class="cartoon-module__hint">先保存，再导出。字幕和背景音乐这一期不会烧进成片。</p>

    <section v-if="loaded && !store.edit" class="cartoon-module">
      <el-empty description="还没有成片时间线" />
      <p class="cartoon-module__hint">先在分镜上生成视频，再按镜序排进时间线。</p>
      <el-button type="primary" :disabled="!canMake()" :loading="seeding" @click="seed(false)">从产物排列</el-button>
    </section>

    <template v-else-if="store.edit">
      <div class="cartoon-edit-layout">
        <PreviewStage />
        <ClipInspector />
      </div>
      <TimelineBoard />
      <div class="cartoon-edit-toolbar">
        <el-button :disabled="!canMake()" :loading="seeding" @click="seed(true)">重新从产物排列</el-button>
        <el-radio-group :model-value="canvasKey" @change="onCanvas">
          <el-radio-button value="portrait">竖版 720×1280</el-radio-button>
          <el-radio-button value="landscape">横版 1280×720</el-radio-button>
        </el-radio-group>
      </div>
      <p v-if="job" class="cartoon-module__hint">导出{{ jobLabel }}<span v-if="job.error_message">：{{ job.error_message }}</span></p>
      <el-progress v-if="job && (job.status === 'queued' || job.status === 'running')" :percentage="job.progress || 0" />
      <video v-if="latest" :src="fileUrl(latest.id)" controls class="cartoon-edit-result" />
    </template>
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
const job = ref(null);
let pollTimer = null;

const canvasKey = computed(() => {
  if (store.edit?.width === 1280 && store.edit?.height === 720) return 'landscape';
  if (store.edit?.width === 720 && store.edit?.height === 1280) return 'portrait';
  return '';
});
const canExport = computed(() => store.edit && store.tools.ffmpeg && !store.dirty && store.clips.length && !exporting.value);
const latest = computed(() => store.exports[0] || null);
const jobLabel = computed(() => ({ queued: '排队', running: '进行中', success: '完成', failed: '失败' }[job.value?.status] || ''));

function fileUrl(id) {
  return `${resolveApiBase()}/outputs/${id}/file`;
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
async function reload() {
  const payload = await request(`/projects/${projectId.value}/edit`);
  store.applyPayload(payload);
}
async function save() {
  if (!store.edit) return;
  saving.value = true;
  try {
    const payload = await request(`/projects/${projectId.value}/edit`, {
      method: 'put',
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
            source_output_id: clip.source_output_id,
            start_ms: clip.start_ms,
            duration_ms: clip.duration_ms,
            trim_in_ms: clip.trim_in_ms,
            text: clip.text || '',
            sort_order: clip.sort_order,
          })),
        })),
      },
    });
    store.applyPayload(payload);
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
      data: { replace },
    });
    store.applyPayload(payload);
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
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    loaded.value = true;
  }
});
onUnmounted(stopPoll);
</script>

<style scoped>
.cartoon-edit-alert { margin-bottom: 12px; }
.cartoon-edit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(260px, 0.8fr);
  gap: 16px;
}
.cartoon-edit-toolbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
.cartoon-edit-result { display: block; max-width: 420px; margin-top: 12px; }
@media (max-width: 960px) {
  .cartoon-edit-layout { grid-template-columns: 1fr; }
}
</style>
