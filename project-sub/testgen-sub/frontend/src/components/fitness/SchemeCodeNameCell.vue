<template>
  <span v-if="displayText" :title="code || undefined">{{ displayText }}</span>
  <span v-else>—</span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  code: { type: String, default: '' },
  name: { type: String, default: '' },
});

const displayText = computed(() => props.name || props.code || '');
</script>
