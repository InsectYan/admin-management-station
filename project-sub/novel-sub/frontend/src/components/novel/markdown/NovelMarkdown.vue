<template>
  <div
    v-if="html"
    class="novel-md"
    :class="{ 'is-compact': compact }"
    v-html="html"
  />
  <span v-else-if="emptyText" class="novel-md__empty">{{ emptyText }}</span>
</template>

<script setup>
import { computed } from 'vue';
import { renderMarkdown } from '../../../lib/markdown.js';

const props = defineProps({
  source: { type: [String, Number], default: '' },
  emptyText: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});

const html = computed(() => renderMarkdown(props.source));
</script>

<style scoped>
.novel-md {
  color: var(--novel-color-text);
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.novel-md.is-compact {
  font-size: 13px;
  line-height: 1.55;
}

.novel-md__empty {
  color: var(--novel-color-text-muted);
}

.novel-md :deep(p) {
  margin: 0 0 0.6em;
}

.novel-md :deep(p:last-child),
.novel-md :deep(ul:last-child),
.novel-md :deep(ol:last-child),
.novel-md :deep(blockquote:last-child),
.novel-md :deep(pre:last-child) {
  margin-bottom: 0;
}

.novel-md :deep(h1),
.novel-md :deep(h2),
.novel-md :deep(h3),
.novel-md :deep(h4) {
  margin: 0.8em 0 0.4em;
  color: var(--novel-color-deep);
  font-weight: 700;
  line-height: 1.35;
}

.novel-md :deep(h1) { font-size: 1.25em; }
.novel-md :deep(h2) { font-size: 1.12em; }
.novel-md :deep(h3),
.novel-md :deep(h4) { font-size: 1em; }

.novel-md.is-compact :deep(h1),
.novel-md.is-compact :deep(h2),
.novel-md.is-compact :deep(h3) {
  font-size: 13px;
  margin: 0.45em 0 0.25em;
}

.novel-md :deep(ul),
.novel-md :deep(ol) {
  margin: 0.35em 0 0.6em;
  padding-left: 1.35em;
}

.novel-md :deep(li) {
  margin: 0.15em 0;
}

.novel-md :deep(blockquote) {
  margin: 0.5em 0;
  padding: 6px 10px;
  border-left: 3px solid var(--novel-color-primary);
  background: var(--novel-color-primary-muted);
  color: var(--novel-color-text);
}

.novel-md :deep(code) {
  padding: 0 4px;
  border-radius: 4px;
  background: var(--novel-color-primary-muted);
  font-size: 0.92em;
}

.novel-md :deep(pre) {
  margin: 0.5em 0;
  padding: 8px 10px;
  overflow-x: auto;
  border-radius: var(--novel-radius-sm);
  background: rgba(31, 61, 44, 0.06);
  border: var(--novel-border-subtle);
}

.novel-md :deep(pre code) {
  padding: 0;
  background: transparent;
}

.novel-md :deep(a) {
  color: var(--novel-color-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.novel-md :deep(hr) {
  margin: 0.8em 0;
  border: none;
  border-top: var(--novel-border-subtle);
}

.novel-md :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5em 0;
  font-size: 0.95em;
}

.novel-md :deep(th),
.novel-md :deep(td) {
  border: var(--novel-border-subtle);
  padding: 4px 8px;
  text-align: left;
}

.novel-md :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--novel-radius-sm);
}
</style>
