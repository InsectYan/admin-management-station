<template>
  <span v-if="resolved.plainText" class="fitness-status-plain">{{ resolved.label }}</span>
  <el-tag
    v-else-if="resolved.label && resolved.label !== '—'"
    :type="resolved.type || undefined"
    :color="resolved.color"
    :effect="resolved.effect || 'plain'"
    :size="size"
  >
    {{ resolved.label }}
  </el-tag>
  <span v-else class="fitness-status-plain">—</span>
</template>

<script setup>
import { computed } from 'vue';
import { statusTagProps } from '@/utils/fitnessStatusTags.js';

const props = defineProps({
  prop: { type: String, required: true },
  row: { type: Object, default: null },
  value: { type: [ String, Number, Boolean ], default: undefined },
  size: { type: String, default: 'small' },
});

const resolved = computed(() => statusTagProps(props.prop, props.row, props.value));
</script>

<style scoped>
.fitness-status-plain {
  color: var(--el-text-color-secondary);
}
</style>
