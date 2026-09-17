<template>
  <div class="ops-deploy-term" @scroll="onScroll">
    <div v-if="!rows.length" class="ops-deploy-term__empty">{{ emptyText }}</div>
    <div v-for="line in rows" :key="line.id" class="ops-deploy-term__line" :class="`is-${line.level}`">
      <span class="ops-deploy-term__time">{{ formatTime(line.created_at) }}</span>
      <span class="ops-deploy-term__level">{{ line.level }}</span>
      <span class="ops-deploy-term__msg">{{ line.message }}</span>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  rows: { type: Array, default: () => [] },
  autoScroll: { type: Boolean, default: true },
  emptyText: { type: String, default: '等待执行器领取…' },
});

const emit = defineEmits(['pause-auto']);
const root = ref(null);

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function onScroll(ev) {
  root.value = ev.target;
  const el = ev.target;
  if (el.scrollHeight - el.scrollTop - el.clientHeight > 40) {
    emit('pause-auto');
  }
}

watch(
  () => [props.rows.length, props.autoScroll],
  async () => {
    if (!props.autoScroll) return;
    await nextTick();
    const el = root.value || document.querySelector('.ops-deploy-term');
    if (el) el.scrollTop = el.scrollHeight;
  },
);
</script>

<style scoped>
.ops-deploy-term {
  flex: 1;
  min-height: 320px;
  max-height: calc(100vh - 280px);
  overflow: auto;
  background: #122018;
  color: #c8d9ce;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  padding: 12px 14px;
  border-radius: 8px;
}

.ops-deploy-term__empty {
  color: #7d9186;
  padding: 24px 0;
  text-align: center;
}

.ops-deploy-term__line {
  display: grid;
  grid-template-columns: 72px 52px 1fr;
  gap: 10px;
}

.ops-deploy-term__time,
.ops-deploy-term__level {
  color: #7d9186;
}

.ops-deploy-term__line.is-warn .ops-deploy-term__level,
.ops-deploy-term__line.is-warn .ops-deploy-term__msg {
  color: #e6c36a;
}

.ops-deploy-term__line.is-error .ops-deploy-term__level,
.ops-deploy-term__line.is-error .ops-deploy-term__msg {
  color: #f07171;
}

.ops-deploy-term__line.is-info .ops-deploy-term__msg {
  color: #b7d0c2;
}
</style>
