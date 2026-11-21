<template>
  <div class="cartoon-clamp" :style="clampStyle" @click.stop="open = true">{{ text || '—' }}</div>
  <el-dialog v-model="open" :title="title" width="640px" append-to-body>
    <div class="cartoon-clamp__full">{{ text || '—' }}</div>
  </el-dialog>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  text: { type: String, default: '' },
  title: { type: String, default: '全文' },
  lines: { type: Number, default: 5 },
});
const clampStyle = computed(() => ({
  WebkitLineClamp: String(props.lines),
  maxHeight: `calc(1.5em * ${props.lines})`,
}));
const open = ref(false);
</script>

<style scoped>
.cartoon-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  cursor: pointer;
}
.cartoon-clamp__full {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  max-height: 60vh;
  overflow: auto;
}
</style>
