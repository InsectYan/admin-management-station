<template>
  <span v-if="displayText" :title="titleText">{{ displayText }}</span>
  <span v-else>—</span>
</template>

<script setup>
import { computed } from 'vue';
import { formatSchemeLabel, formatValidationLabel } from '@/utils/testCategoryDisplay.js';

const props = defineProps({
  code: { type: String, default: '' },
  name: { type: String, default: '' },
  /** scheme | validation；默认按编码前缀推断 */
  kind: { type: String, default: '' },
});

const resolvedKind = computed(() => {
  if (props.kind === 'scheme' || props.kind === 'validation') return props.kind;
  const code = String(props.code || '');
  if (code.startsWith('VS-')) return 'validation';
  if (code.startsWith('TS-')) return 'scheme';
  return 'scheme';
});

const displayText = computed(() => {
  if (resolvedKind.value === 'validation') {
    return formatValidationLabel(props.code, props.name);
  }
  return formatSchemeLabel(props.code, props.name);
});

const titleText = computed(() => {
  const code = String(props.code || '');
  const name = String(props.name || '');
  if (code && name && name !== code) return `${code} · ${name}`;
  return code || name || undefined;
});
</script>
