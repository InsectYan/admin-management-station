<template>
  <div ref="scroller" class="ai-chat-thread">
    <div v-if="!messages.length && !sending && !thinkingLive && !streamingReply" class="ai-chat-thread__empty">
      选一张场景卡，或什么都不选做本步全量生成。
    </div>
    <div
      v-for="row in messages"
      :key="row.id"
      class="ai-chat-bubble"
      :class="`is-${row.role}`"
    >
      <details v-if="row.role === 'thinking'" class="ai-chat-thinking">
        <summary>思考过程</summary>
        <div v-if="labelsFor(row).length" class="ai-chat-thinking__context">
          <span class="ai-chat-thinking__context-label">参考入参</span>
          <div class="ai-chat-tags">
            <span v-for="label in labelsFor(row)" :key="label" class="ai-chat-tag">{{ label }}</span>
          </div>
        </div>
        <NovelMarkdown v-if="thinkingBody(row)" :source="thinkingBody(row)" compact />
      </details>
      <template v-else>
        <div class="ai-chat-bubble__meta">{{ roleLabel(row.role) }}</div>
        <NovelMarkdown class="ai-chat-bubble__text" :source="assistantBody(row)" compact />
      </template>
    </div>
    <div v-if="thinkingLive && (streamingThinking || !streamingReply)" class="ai-chat-bubble is-thinking is-pending">
      <details class="ai-chat-thinking" open>
        <summary>{{ streamingThinking ? '思考中…' : '正在构思…' }}</summary>
        <div v-if="liveContextLabels.length" class="ai-chat-thinking__context">
          <span class="ai-chat-thinking__context-label">参考入参</span>
          <div class="ai-chat-tags">
            <span v-for="label in liveContextLabels" :key="label" class="ai-chat-tag">{{ label }}</span>
          </div>
        </div>
        <pre v-if="liveThinking" class="ai-chat-thinking__live">{{ liveThinking }}</pre>
      </details>
    </div>
    <div v-if="streamingReply" class="ai-chat-bubble is-assistant is-pending">
      <div class="ai-chat-bubble__meta">林间写手</div>
      <NovelMarkdown class="ai-chat-bubble__text" :source="streamingReply" compact />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import NovelMarkdown from '../markdown/NovelMarkdown.vue';
import { displayMessageContent } from '../../../utils/aiReplyText.js';
import {
  displayAssistantBody,
  localizeThinking,
  thinkingContextLabels,
} from '../../../utils/aiChatDisplay.js';

const props = defineProps({
  messages: { type: Array, default: () => [] },
  sending: { type: Boolean, default: false },
  streamingThinking: { type: String, default: '' },
  streamingReply: { type: String, default: '' },
  thinkingLive: { type: Boolean, default: false },
  contextLabels: { type: Array, default: () => [] },
});

const scroller = ref(null);
const liveContextLabels = computed(() => (Array.isArray(props.contextLabels) ? props.contextLabels : []));
const liveThinking = computed(() => localizeThinking(props.streamingThinking));
const lastThinkingId = computed(() => (
  [...props.messages].reverse().find((row) => row.role === 'thinking')?.id || null
));

function labelsFor(row) {
  const stored = thinkingContextLabels(row);
  if (stored.length) return stored;
  if (row.id === lastThinkingId.value) return liveContextLabels.value;
  return [];
}

function thinkingBody(row) {
  return localizeThinking(displayMessageContent(row));
}

function assistantBody(row) {
  return displayAssistantBody(row);
}

function roleLabel(role) {
  if (role === 'user') return '你';
  if (role === 'assistant') return '林间写手';
  return role;
}

watch(
  () => [props.messages.length, props.streamingThinking, props.streamingReply, props.thinkingLive],
  async () => {
    await nextTick();
    const el = scroller.value;
    if (el) el.scrollTop = el.scrollHeight;
  },
);
</script>

<style scoped>
.ai-chat-thread {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  padding: 4px 2px 8px;
}

.ai-chat-thread__empty {
  margin: auto;
  padding: 16px 8px;
  text-align: center;
  color: var(--novel-color-text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.ai-chat-bubble {
  max-width: 100%;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--novel-color-surface);
  border: var(--novel-border-subtle);
}

.ai-chat-bubble.is-user {
  align-self: flex-end;
  background: var(--novel-color-primary-muted);
  border-color: rgba(47, 138, 91, 0.28);
}

.ai-chat-bubble.is-assistant,
.ai-chat-bubble.is-thinking {
  align-self: flex-start;
}

.ai-chat-bubble.is-pending {
  opacity: 0.92;
}

.ai-chat-bubble__meta {
  font-size: 11px;
  color: var(--novel-color-moon);
  margin-bottom: 4px;
}

.ai-chat-bubble__text {
  margin: 0;
}

.ai-chat-thinking {
  font-size: 12px;
  color: var(--novel-color-text-secondary);
}

.ai-chat-thinking summary {
  cursor: pointer;
  color: var(--novel-color-moon);
}

.ai-chat-thinking :deep(.novel-md) {
  margin-top: 6px;
}

.ai-chat-thinking__context {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px 0 4px;
}

.ai-chat-thinking__context-label {
  font-size: 11px;
  color: var(--novel-color-moon);
}

.ai-chat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-chat-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--novel-color-primary);
  background: var(--novel-color-primary-muted);
  border: 1px solid rgba(47, 138, 91, 0.22);
}

.ai-chat-thinking__live {
  margin: 6px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.55;
  color: var(--novel-color-text-secondary);
}
</style>
