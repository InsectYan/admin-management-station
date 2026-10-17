<template>
  <section class="cartoon-edit-board cartoon-module">
    <h3 class="cartoon-module__title">视频轨</h3>
    <div ref="scroller" class="cartoon-edit-scroll" @pointerdown="onSeekDown">
      <div class="cartoon-edit-ruler" :style="{ width: `${trackWidth}px` }">
        <span
          v-for="mark in marks"
          :key="mark"
          class="cartoon-edit-mark"
          :style="{ left: `${mark * pxPerMs}px` }"
        >{{ mark / 1000 }}s</span>
      </div>
      <div class="cartoon-edit-track" :style="{ width: `${trackWidth}px` }">
        <div
          v-for="(clip, index) in store.clips"
          :key="clip.id"
          class="cartoon-edit-clip"
          :class="{ 'is-selected': clip.id === store.selectedClipId, 'is-missing': clip.missing }"
          :style="{ left: `${clip.start_ms * pxPerMs}px`, width: `${Math.max(clip.duration_ms * pxPerMs, 28)}px` }"
          @pointerdown.stop="onClipDown($event, clip, index)"
        >
          <button type="button" class="cartoon-edit-handle" aria-label="调整入点" @pointerdown.stop="onTrimDown($event, clip, 'in')" />
          <span class="cartoon-edit-clip-label">{{ clip.shot_description || `片段 ${index + 1}` }}</span>
          <button type="button" class="cartoon-edit-handle is-out" aria-label="调整出点" @pointerdown.stop="onTrimDown($event, clip, 'out')" />
        </div>
        <div class="cartoon-edit-playhead" :style="{ left: `${store.playheadMs * pxPerMs}px` }" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { useEditTimelineStore } from '../../stores/editTimeline.js';

const store = useEditTimelineStore();
const scroller = ref(null);
const pxPerMs = 0.08;
let drag = null;

const trackWidth = computed(() => Math.max((store.edit?.duration_ms || 0) * pxPerMs + 80, 480));
const marks = computed(() => {
  const step = 1000;
  const list = [];
  const end = store.edit?.duration_ms || 0;
  for (let ms = 0; ms <= end; ms += step) list.push(ms);
  return list;
});

function onSeekDown(event) {
  if (event.target.closest('.cartoon-edit-clip')) return;
  const seekAt = clientX => {
    const rect = scroller.value.getBoundingClientRect();
    store.seek((clientX - rect.left + scroller.value.scrollLeft) / pxPerMs);
  };
  seekAt(event.clientX);
  const move = ev => seekAt(ev.clientX);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}
function onClipDown(event, clip, index) {
  store.selectClip(clip.id);
  store.seek(clip.start_ms);
  store.begin();
  drag = { type: 'move', index, last: index, startX: event.clientX };
  bind();
}
function onTrimDown(event, clip, edge) {
  store.selectClip(clip.id);
  store.begin();
  drag = {
    type: edge,
    id: clip.id,
    startX: event.clientX,
    trim: clip.trim_in_ms,
    duration: clip.duration_ms,
    max: clip.source_duration_ms || clip.trim_in_ms + clip.duration_ms,
  };
  bind();
}
function bind() {
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
function onMove(event) {
  if (!drag) return;
  const delta = Math.round((event.clientX - drag.startX) / pxPerMs);
  if (drag.type === 'in') {
    let trim = drag.trim + delta;
    let duration = drag.duration - (trim - drag.trim);
    if (trim < 0) {
      duration += trim;
      trim = 0;
    }
    if (duration < 200) {
      trim = drag.trim + drag.duration - 200;
      duration = 200;
    }
    if (trim + duration > drag.max) duration = Math.max(200, drag.max - trim);
    store.updateClip(drag.id, { trim_in_ms: Math.max(0, Math.round(trim)), duration_ms: Math.round(duration) });
    return;
  }
  if (drag.type === 'out') {
    let duration = Math.max(200, drag.duration + delta);
    if (drag.trim + duration > drag.max) duration = Math.max(200, drag.max - drag.trim);
    store.updateClip(drag.id, { duration_ms: Math.round(duration) });
    return;
  }
  const rect = scroller.value.getBoundingClientRect();
  const ms = (event.clientX - rect.left + scroller.value.scrollLeft) / pxPerMs;
  let to = store.clips.findIndex(clip => ms < clip.start_ms + clip.duration_ms / 2);
  if (to < 0) to = store.clips.length - 1;
  if (to !== drag.last) {
    store.reorder(drag.last, to);
    drag.last = to;
  }
}
function onUp() {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  store.end();
  drag = null;
}
onBeforeUnmount(onUp);
</script>

<style scoped>
.cartoon-edit-scroll {
  overflow-x: auto;
  padding-bottom: 8px;
  cursor: text;
}
.cartoon-edit-ruler { position: relative; height: 22px; }
.cartoon-edit-mark {
  position: absolute;
  top: 0;
  color: var(--cartoon-color-muted, #5c6b62);
  font-size: 12px;
}
.cartoon-edit-track {
  position: relative;
  height: 72px;
  border-radius: 8px;
  background: rgba(47, 138, 91, 0.08);
}
.cartoon-edit-clip {
  position: absolute;
  top: 8px;
  height: 56px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  border-radius: 8px;
  background: #2f8a5b;
  color: #fff;
  box-sizing: border-box;
  cursor: grab;
  overflow: hidden;
}
.cartoon-edit-clip.is-selected { outline: 2px solid #1f3d2c; }
.cartoon-edit-clip.is-missing { background: #8a4b4b; }
.cartoon-edit-clip-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
}
.cartoon-edit-handle {
  width: 8px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.75);
  cursor: ew-resize;
}
.cartoon-edit-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e36a3a;
  pointer-events: none;
}
</style>
