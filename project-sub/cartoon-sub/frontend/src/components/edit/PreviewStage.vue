<template>
  <section class="cartoon-edit-preview cartoon-module">
    <h3 class="cartoon-module__title">预览</h3>
    <div
      class="cartoon-edit-stage"
      :style="{ aspectRatio: `${width} / ${height}` }"
    >
      <video
        v-show="clip && !clip.missing"
        ref="videoRef"
        class="cartoon-edit-video"
        playsinline
        @timeupdate="onTime"
        @ended="onEnded"
      />
      <p v-if="!clip" class="cartoon-edit-empty">时间线上还没有片段</p>
      <p v-else-if="clip.missing" class="cartoon-edit-empty">素材缺失</p>
      <p v-if="cue" class="cartoon-edit-cue">{{ cue }}</p>
    </div>
    <div class="cartoon-edit-transport">
      <el-button @click="toggle">{{ playing ? '暂停' : '播放' }}</el-button>
      <span>{{ clock(playheadMs) }} / {{ clock(duration) }}</span>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useEditTimelineStore } from '../../stores/editTimeline.js';
import { resolveApiBase } from '../../services/apiConfig.js';

const store = useEditTimelineStore();
const { playheadMs, playing, seekSerial } = storeToRefs(store);
const videoRef = ref(null);
let lock = false;

const width = computed(() => store.edit?.width || 720);
const height = computed(() => store.edit?.height || 1280);
const duration = computed(() => store.edit?.duration_ms || 0);
const clip = computed(() => store.clips.find(item => playheadMs.value >= item.start_ms && playheadMs.value < item.start_ms + item.duration_ms) || null);
const cue = computed(() => {
  const track = store.edit?.tracks?.find(item => item.kind === 'subtitle');
  const row = track?.clips?.find(item => playheadMs.value >= item.start_ms && playheadMs.value < item.start_ms + item.duration_ms);
  return row?.text || '';
});

function clock(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
function fileUrl(id) {
  return `${resolveApiBase()}/outputs/${id}/file`;
}
async function syncTo(target, offsetMs) {
  const video = videoRef.value;
  if (!video) return;
  if (!target || target.missing || !target.source_output_id) {
    video.pause();
    return;
  }
  const at = Math.max(0, (target.trim_in_ms + offsetMs) / 1000);
  lock = true;
  try {
    if (video.dataset.outputId !== String(target.source_output_id)) {
      video.dataset.outputId = String(target.source_output_id);
      video.src = fileUrl(target.source_output_id);
      await new Promise((resolve, reject) => {
        const ok = () => { cleanup(); resolve(); };
        const bad = () => { cleanup(); reject(new Error('load')); };
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', ok);
          video.removeEventListener('error', bad);
        };
        video.addEventListener('loadedmetadata', ok);
        video.addEventListener('error', bad);
      });
    }
    if (Math.abs((video.currentTime || 0) - at) > 0.08) {
      await new Promise(resolve => {
        const done = () => { video.removeEventListener('seeked', done); resolve(); };
        video.addEventListener('seeked', done);
        video.currentTime = at;
      });
    }
    if (playing.value) await video.play();
    else video.pause();
  } catch {
    store.playing = false;
  } finally {
    lock = false;
  }
}
watch(seekSerial, () => {
  if (!clip.value) return;
  syncTo(clip.value, playheadMs.value - clip.value.start_ms);
});
watch(playing, value => {
  const video = videoRef.value;
  if (!video || lock) return;
  if (value) {
    if (!clip.value) {
      store.playing = false;
      return;
    }
    if (video.dataset.outputId !== String(clip.value.source_output_id)) {
      syncTo(clip.value, playheadMs.value - clip.value.start_ms);
      return;
    }
    video.play().catch(() => { store.playing = false; });
  } else video.pause();
});
function onTime() {
  if (lock || !playing.value || !clip.value) return;
  const video = videoRef.value;
  const timeline = clip.value.start_ms + (video.currentTime * 1000 - clip.value.trim_in_ms);
  if (timeline >= clip.value.start_ms + clip.value.duration_ms - 40) {
    const next = store.clips.find(item => item.start_ms >= clip.value.start_ms + clip.value.duration_ms - 1);
    if (!next) {
      store.playing = false;
      store.playheadMs = duration.value;
      video.pause();
      return;
    }
    store.playheadMs = next.start_ms;
    syncTo(next, 0);
    return;
  }
  store.playheadMs = Math.max(clip.value.start_ms, Math.round(timeline));
}
function onEnded() {
  if (lock || !clip.value) return;
  onTime();
}
function toggle() {
  if (!store.clips.length) return;
  if (!playing.value && playheadMs.value >= duration.value) store.seek(0);
  store.playing = !store.playing;
}
</script>

<style scoped>
.cartoon-edit-stage {
  position: relative;
  max-height: 420px;
  margin: 0 auto;
  background: #17241c;
  overflow: hidden;
}
.cartoon-edit-video { width: 100%; height: 100%; object-fit: contain; background: #17241c; }
.cartoon-edit-empty {
  margin: 0;
  padding: 48px 16px;
  text-align: center;
  color: #d7e6dc;
}
.cartoon-edit-cue {
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: 10%;
  margin: 0;
  text-align: center;
  color: #fff;
  font-size: 18px;
  text-shadow: 0 1px 2px #000;
}
.cartoon-edit-transport { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
</style>
