<template>
  <div ref="root" :style="boxStyle">
    <div v-if="pane" :style="scrollStyle">
      <slot />
    </div>
    <slot v-else />
    <LoadMask :loading="visible" />
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, provide, ref } from 'vue';
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

const root = ref(null);

function pinDrawerBody() {
  const body = root.value?.closest('.el-drawer__body');
  if (!body) return;
  body.style.overflow = 'hidden';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.minHeight = '0';
}

onMounted(async () => {
  if (!props.pane) return;
  await nextTick();
  pinDrawerBody();
});

const boxStyle = computed(() => (
  props.pane
    ? {
      position: 'relative',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0%',
      width: '100%',
      minHeight: '0',
      overflow: 'hidden',
    }
    : { position: 'relative', minHeight: '0', height: '100%' }
));

const scrollStyle = {
  flex: '1 1 0%',
  minHeight: '0',
  overflow: 'auto',
};
</script>
