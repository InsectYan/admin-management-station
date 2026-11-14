<template>
  <div class="video-with-rate">
    <video ref="el" v-bind="videoAttrs" @loadedmetadata="onReady" />
    <PlaybackRate v-model="speed" />
  </div>
</template>

<script setup>
import { computed, ref, useAttrs, watch } from 'vue';
import PlaybackRate from './PlaybackRate.vue';

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const el = ref(null);
const speed = ref(1);
const videoAttrs = computed(() => {
  const { onLoadedmetadata, ...rest } = attrs;
  return rest;
});

function applyRate() {
  if (el.value) el.value.playbackRate = speed.value;
}
function onReady(event) {
  applyRate();
  const hook = attrs.onLoadedmetadata;
  const list = Array.isArray(hook) ? hook : [ hook ];
  list.forEach(fn => { if (typeof fn === 'function') fn(event); });
}
watch(speed, applyRate);
defineExpose({ el });
</script>

<style scoped>
.video-with-rate { width: 100%; }
</style>
