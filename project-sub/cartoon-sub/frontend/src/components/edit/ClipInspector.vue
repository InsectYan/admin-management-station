<template>
  <section class="cartoon-edit-inspector cartoon-module">
    <h3 class="cartoon-module__title">片段</h3>
    <el-empty v-if="!clip" description="点时间线上的一段" />
    <el-form v-else label-position="top">
      <el-form-item label="绑定的视频">
        <el-select :model-value="clip.source_output_id" @change="onSource">
          <el-option
            v-for="item in store.videos"
            :key="item.id"
            :label="optionLabel(item)"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="入点（秒）">
        <el-input-number :model-value="seconds(clip.trim_in_ms)" :min="0" :step="0.1" :precision="1" @change="onTrimIn" />
      </el-form-item>
      <el-form-item label="片段时长（秒）">
        <el-input-number :model-value="seconds(clip.duration_ms)" :min="0.2" :step="0.1" :precision="1" @change="onDuration" />
      </el-form-item>
      <p v-if="clip.missing" class="cartoon-module__hint">素材文件不在磁盘上，预览和导出都会停在这里。</p>
      <p v-else class="cartoon-module__hint">源时长 {{ seconds(clip.source_duration_ms || 0) }} 秒。出点不能超过源片。</p>
    </el-form>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useEditTimelineStore } from '../../stores/editTimeline.js';

const store = useEditTimelineStore();
const clip = computed(() => store.clips.find(item => item.id === store.selectedClipId) || null);

function seconds(ms) {
  return Math.round(Number(ms || 0) / 100) / 10;
}
function optionLabel(item) {
  const name = item.description || `分镜 ${item.shot_id || item.id}`;
  return `${name} · #${item.id}`;
}
function commit(patch) {
  if (!clip.value) return;
  store.begin();
  store.updateClip(clip.value.id, patch);
  store.end();
}
function limit(trim, duration, max) {
  let nextTrim = Math.max(0, Math.round(trim));
  let nextDuration = Math.max(200, Math.round(duration));
  if (max && nextTrim + nextDuration > max) nextDuration = Math.max(200, max - nextTrim);
  if (max && nextTrim > max - 200) nextTrim = Math.max(0, max - 200);
  return { trim_in_ms: nextTrim, duration_ms: nextDuration };
}
function onSource(id) {
  const source = store.videos.find(item => item.id === id);
  const duration = source?.duration_ms || clip.value.duration_ms;
  commit({
    source_output_id: id,
    trim_in_ms: 0,
    duration_ms: duration,
    missing: Boolean(source?.missing),
    source_duration_ms: source?.duration_ms || null,
    shot_description: source?.description || '',
  });
}
function onTrimIn(value) {
  const max = clip.value.source_duration_ms;
  const next = limit(Number(value) * 1000, clip.value.duration_ms, max);
  commit(next);
}
function onDuration(value) {
  const max = clip.value.source_duration_ms;
  commit(limit(clip.value.trim_in_ms, Number(value) * 1000, max));
}
</script>
