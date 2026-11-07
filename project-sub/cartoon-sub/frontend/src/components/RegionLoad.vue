<template>
  <div :style="boxStyle">
    <div v-if="pane" :style="scrollStyle">
      <slot />
    </div>
    <slot v-else />
    <LoadMask :loading="visible" />
  </div>
</template>

<script setup>
import { computed, provide, ref } from 'vue';
import LoadMask from './LoadMask.vue';

const props = defineProps({
  loading: { type: Boolean, default: false },
  pane: { type: Boolean, default: false },
});

const count = ref(0);
const visible = computed(() => props.loading || count.value > 0);

async function track(work) {
  count.value += 1;
  try {
    return await work();
  } finally {
    count.value = Math.max(0, count.value - 1);
  }
}

provide('cartoon-region-load', track);
defineExpose({ track });

const boxStyle = computed(() => (
  props.pane
    ? {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 'calc(100vh - 128px)',
      overflow: 'hidden',
    }
    : { position: 'relative', minHeight: '0', height: '100%' }
));

const scrollStyle = {
  flex: '1 1 auto',
  minHeight: '0',
  height: '100%',
  overflow: 'auto',
};
</script>
