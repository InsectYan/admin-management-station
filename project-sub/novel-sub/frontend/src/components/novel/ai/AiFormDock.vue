<template>
  <aside class="ai-form-dock" :class="{ 'is-collapsed': collapsed }">
    <header class="ai-form-dock__header">
      <button type="button" class="ai-form-dock__mascot" :title="collapsed ? '展开 AI 坞' : '折叠'" @click="toggleCollapsed">
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="17" r="10" fill="rgba(47,138,91,0.16)" />
          <path d="M10 14c0-4 2.4-7 6-7s6 3 6 7" fill="none" stroke="#2f8a5b" stroke-width="1.6" />
          <circle cx="13" cy="16" r="1.2" fill="#1f3d2c" />
          <circle cx="19" cy="16" r="1.2" fill="#1f3d2c" />
          <path d="M13 21c2 1.4 4 1.4 6 0" fill="none" stroke="#2f8a5b" stroke-width="1.4" stroke-linecap="round" />
          <path d="M9 11 7 7M23 11l2-4" stroke="#2f8a5b" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </button>
      <div v-if="!collapsed" class="ai-form-dock__header-text">
        <strong>林间写手</strong>
        <span>{{ selectedNode?.title || '基础信息' }}</span>
      </div>
      <el-button
        v-if="!collapsed"
        link
        class="ai-form-dock__fold"
        @click="toggleCollapsed"
      >收起</el-button>
    </header>

    <div v-if="!collapsed" class="ai-form-dock__sessions">
      <el-select
        :model-value="sessionId"
        size="small"
        placeholder="会话"
        @change="switchSession"
      >
        <el-option
          v-for="item in sessions"
          :key="item.id"
          :label="item.title || `会话 ${item.id}`"
          :value="item.id"
        />
      </el-select>
      <el-button size="small" @click="createSession">新开</el-button>
    </div>

    <AiSceneTree
      :scenes="scenes"
      :selected-id="selectedId"
      :collapsed="collapsed"
      @select="onSelectScene"
    />

    <template v-if="!collapsed">
      <AiChatThread
        :messages="messages"
        :sending="sending"
        :streaming-thinking="streamingThinking"
        :thinking-live="thinkingLive"
      />

      <p v-if="error" class="ai-form-dock__error">{{ error }}</p>

      <div class="ai-form-dock__composer">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          :placeholder="placeholder"
          :disabled="sending"
          @keydown.enter.exact.prevent="send"
        />
        <el-button type="primary" :loading="sending" :disabled="!input.trim()" @click="send">
          发送
        </el-button>
      </div>

      <div class="ai-form-dock__apply">
        <el-button type="primary" plain :disabled="!canApply" @click="onApply">应用到表单</el-button>
        <el-button link :disabled="!pendingMessage" @click="discardPending">丢弃本轮</el-button>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { toRef } from 'vue';
import { ElMessage } from 'element-plus';
import AiSceneTree from './AiSceneTree.vue';
import AiChatThread from './AiChatThread.vue';
import { useAiDock } from '../../../composables/useAiDock.js';

const props = defineProps({
  scenes: { type: Array, default: () => [] },
  featureKey: { type: String, default: 'basic' },
  novelId: { type: [Number, String], default: null },
  formSnapshot: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['apply']);

const {
  collapsed,
  toggleCollapsed,
  sessions,
  sessionId,
  messages,
  sending,
  error,
  input,
  selectedId,
  selectedNode,
  placeholder,
  canApply,
  pendingMessage,
  streamingThinking,
  thinkingLive,
  selectScene,
  createSession,
  switchSession,
  send,
  applyPending,
  discardPending,
} = useAiDock({
  scenes: toRef(props, 'scenes'),
  featureKey: toRef(props, 'featureKey'),
  novelId: toRef(props, 'novelId'),
  formSnapshot: toRef(props, 'formSnapshot'),
});

function onSelectScene(id) {
  selectScene(id, { expand: true });
}

async function onApply() {
  const patch = await applyPending();
  if (patch && Object.keys(patch).length) {
    emit('apply', patch);
    ElMessage.success('已写入表单，保存草稿后才会入库');
  } else {
    ElMessage.info('这一轮没有可应用的字段');
  }
}
</script>

<style scoped>
.ai-form-dock {
  width: 320px;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 10px 12px;
  box-sizing: border-box;
  background: var(--novel-color-glass);
  backdrop-filter: blur(var(--novel-backdrop-blur));
  border-right: var(--novel-border-subtle);
  transition: width 0.2s ease;
}

.ai-form-dock.is-collapsed {
  width: 64px;
  padding: 10px 6px;
  align-items: center;
}

.ai-form-dock__header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ai-form-dock__mascot {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  line-height: 0;
}

.ai-form-dock__header-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.ai-form-dock__header-text strong {
  font-size: 13px;
  color: var(--novel-color-deep);
}

.ai-form-dock__header-text span {
  font-size: 11px;
  color: var(--novel-color-moon);
}

.ai-form-dock__fold {
  color: var(--novel-color-text-secondary);
}

.ai-form-dock__sessions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px;
  flex-shrink: 0;
}

.ai-form-dock__error {
  margin: 0;
  font-size: 12px;
  color: var(--novel-color-danger);
  line-height: 1.4;
}

.ai-form-dock__composer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.ai-form-dock__apply {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}
</style>
