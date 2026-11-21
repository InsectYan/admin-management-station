<template>
  <section class="cartoon-module">
    <h3 class="cartoon-module__title">片库</h3>
    <p class="cartoon-module__hint">这一项目生成的视频、首尾帧，以及合成导出的成片。点记录编号打开对应预览。</p>
    <el-tabs v-model="tab">
      <el-tab-pane :label="`视频（${videos.length}）`" name="video" />
      <el-tab-pane :label="`首尾帧（${frames.length}）`" name="frame" />
      <el-tab-pane :label="`成片（${finals.length}）`" name="final" />
    </el-tabs>
    <p v-if="loading" class="cartoon-module__hint">正在读取片库。</p>
    <el-empty v-else-if="failed" description="片库没有读到" />
    <el-empty v-else-if="!current.length" :description="emptyText" />
    <div v-else class="reel-grid">
      <article v-for="card in current" :key="cardKey(card)" class="reel-card">
        <header>
          <strong>{{ headTitle(card) }}</strong>
          <span>{{ headMeta(card) }}</span>
          <button type="button" @click="emit('open', card)">记录 #{{ recordId(card) }}</button>
        </header>
        <VideoWithRate v-if="card.media_kind === 'video'" :src="fileUrl(card.id)" muted controls preload="metadata" />
        <img v-else :src="fileUrl(card.id)" alt="" />
        <p class="reel-card__note">{{ noteOf(card) }}</p>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import VideoWithRate from './VideoWithRate.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
});
const emit = defineEmits([ 'open' ]);
const tab = ref('video');
const loading = ref(true);
const failed = ref(false);
const videos = ref([]);
const frames = ref([]);
const finals = ref([]);
const current = computed(() => {
  if (tab.value === 'frame') return frames.value;
  if (tab.value === 'final') return finals.value;
  return videos.value;
});
const emptyText = computed(() => ({
  video: '还没有生成的视频',
  frame: '还没有首尾帧',
  final: '还没有导出的成片',
}[tab.value]));

function fileUrl(id) {
  return `${resolveApiBase()}/outputs/${id}/file`;
}
function cardKey(card) {
  return `${tab.value}-${card.id}`;
}
function recordId(card) {
  return card.task_id || card.job_id || card.id;
}
function headTitle(card) {
  if (tab.value === 'final') return card.title || '成片';
  return card.chapter_title || '未关联章节';
}
function headMeta(card) {
  if (tab.value === 'final') return card.project_name || '当前项目';
  return card.shot_code || '—';
}
function noteOf(card) {
  if (tab.value === 'frame') return card.frame_role === 'end' ? '尾帧' : '首帧';
  if (tab.value === 'final') {
    const sec = Number(card.duration_ms) > 0 ? `${Math.round(card.duration_ms / 1000)} 秒` : '时长未记';
    const size = card.width && card.height ? `${card.width}×${card.height}` : '';
    return [ size, sec ].filter(Boolean).join(' · ');
  }
  return Number(card.duration_ms) > 0 ? `${Math.round(card.duration_ms / 1000)} 秒` : '视频';
}
onMounted(async () => {
  try {
    const data = await request(`/projects/${props.projectId}/reel`);
    videos.value = data?.videos || [];
    frames.value = data?.frames || [];
    finals.value = data?.finals || [];
  } catch (err) {
    failed.value = true;
    ElMessage.error(err.message || '没有读到片库');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.reel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 12px;
  margin-top: 12px;
}
.reel-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(47, 138, 91, 0.16);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.84);
}
.reel-card header {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.reel-card header strong,
.reel-card header span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reel-card header strong { flex: 1; }
.reel-card header span { color: #5c6b62; }
.reel-card header button {
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: #2f8a5b;
  cursor: pointer;
}
.reel-card img,
.reel-card :deep(.video-with-rate video) {
  display: block;
  width: 100%;
  height: 160px;
  object-fit: contain;
  background: #f3f6f4;
  border-radius: 8px;
}
.reel-card__note { margin: 0; color: #5c6b62; font-size: 12px; }
</style>
