<template>
  <div v-if="code" class="code-name-cell">
    <code>{{ code }}</code>
    <span v-if="name" class="name">{{ name }}</span>
  </div>
  <span v-else>—</span>
</template>

<script setup>
defineProps({
  code: { type: String, default: '' },
  name: { type: String, default: '' },
});
</script>

<style scoped>
.code-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}
.code-name-cell code {
  font-size: 12px;
}
.code-name-cell .name {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
