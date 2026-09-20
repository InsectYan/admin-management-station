<template>
  <el-menu
    class="ops-detail-tabs"
    :key="String(active)"
    :default-active="String(active)"
    @select="onSelect"
  >
    <el-menu-item
      v-for="item in items"
      :key="item.id"
      :index="String(item.id)"
      :disabled="item.disabled"
    >
      {{ item.label }}
    </el-menu-item>
  </el-menu>
</template>

<script setup>
defineProps({
  active: { type: [Number, String], required: true },
  items: { type: Array, required: true },
});

const emit = defineEmits(['change']);

function onSelect(index) {
  emit('change', Number(index));
}
</script>

<style scoped>
.ops-detail-tabs {
  border-right: none;
  background: transparent;
}

.ops-detail-tabs :deep(.el-menu-item) {
  height: 40px;
  line-height: 40px;
  border-radius: var(--ops-radius-sm);
  margin-bottom: 4px;
}

.ops-detail-tabs :deep(.el-menu-item.is-active) {
  background: rgba(47, 138, 91, 0.12);
  color: var(--ops-color-primary);
}
</style>
