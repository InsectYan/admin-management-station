<template>
  <div v-if="html" class="cartoon-md" :class="{ 'is-prose': prose }" v-html="html" />
  <span v-else-if="emptyText" class="cartoon-md__empty">{{ emptyText }}</span>
</template>

<script setup>
import { computed } from 'vue';
import { renderMarkdown } from '../lib/markdown.js';

const props = defineProps({
  source: { type: [String, Number], default: '' },
  emptyText: { type: String, default: '' },
  prose: { type: Boolean, default: false },
});

const html = computed(() => renderMarkdown(props.source));
</script>

<style scoped>
.cartoon-md {
  color: var(--cartoon-color-deep, #1f3d2c);
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.cartoon-md__empty {
  color: var(--cartoon-color-muted, #5c6b62);
}
.cartoon-md :deep(p) {
  margin: 0 0 0.6em;
}
.cartoon-md.is-prose :deep(p) {
  text-indent: 2em;
}
.cartoon-md.is-prose :deep(li p),
.cartoon-md.is-prose :deep(blockquote p) {
  text-indent: 0;
}
.cartoon-md :deep(p:last-child),
.cartoon-md :deep(ul:last-child),
.cartoon-md :deep(ol:last-child),
.cartoon-md :deep(blockquote:last-child) {
  margin-bottom: 0;
}
.cartoon-md :deep(h1),
.cartoon-md :deep(h2),
.cartoon-md :deep(h3),
.cartoon-md :deep(h4) {
  margin: 0.8em 0 0.4em;
  color: var(--cartoon-color-deep, #1f3d2c);
  font-weight: 700;
  line-height: 1.35;
}
.cartoon-md :deep(h1) { font-size: 1.25em; }
.cartoon-md :deep(h2) { font-size: 1.12em; }
.cartoon-md :deep(h3),
.cartoon-md :deep(h4) { font-size: 1em; }
.cartoon-md :deep(ul),
.cartoon-md :deep(ol) {
  margin: 0.35em 0 0.6em;
  padding-left: 1.35em;
}
.cartoon-md :deep(blockquote) {
  margin: 0.5em 0;
  padding: 6px 10px;
  border-left: 3px solid var(--cartoon-color-primary, #2f8a5b);
  background: rgba(47, 138, 91, 0.08);
}
.cartoon-md :deep(code) {
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(47, 138, 91, 0.08);
  font-size: 0.92em;
}
.cartoon-md :deep(pre) {
  margin: 0.5em 0;
  padding: 8px 10px;
  overflow-x: auto;
  border-radius: 6px;
  background: rgba(31, 61, 44, 0.06);
}
.cartoon-md :deep(pre code) {
  padding: 0;
  background: transparent;
}
.cartoon-md :deep(a) {
  color: var(--cartoon-color-primary, #2f8a5b);
}
</style>
