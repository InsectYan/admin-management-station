<template>
  <aside
    class="ai-form-dock"
    :class="[
      $attrs.class,
      {
        'is-collapsed': collapsed,
        'is-embedded': embedded,
        'is-bar': variant === 'bar',
        'is-locked': locked,
      },
    ]"
  >
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
      <div v-if="!collapsed || variant === 'bar'" class="ai-form-dock__header-text">
        <strong>林间写手</strong>
        <span>{{ collapsed && variant === 'bar' ? `点开${sessionTitle || '林间写手'}` : (selectedNode?.title || sessionTitle || '林间写手') }}</span>
      </div>
      <el-button
        v-if="collapsed && variant === 'bar'"
        link
        class="ai-form-dock__fold"
        @click="toggleCollapsed"
      >展开</el-button>
      <el-button
        v-else-if="!collapsed"
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
        :disabled="locked"
        @change="switchSession"
      >
        <el-option
          v-for="item in sessions"
          :key="item.id"
          :label="item.title || `会话 ${item.id}`"
          :value="item.id"
        />
      </el-select>
      <el-button size="small" :disabled="locked" @click="toggleNaming">新开</el-button>
      <el-button size="small" :disabled="locked || sending || !sessionId" @click="removeSession">删除</el-button>
    </div>
    <div v-if="!collapsed && namingOpen" class="ai-form-dock__name">
      <el-input
        ref="nameInputRef"
        v-model="newSessionTitle"
        size="small"
        maxlength="40"
        show-word-limit
        placeholder="给这组话题起个名字"
        :disabled="locked || naming"
        @keydown.enter.prevent="confirmCreateSession"
      />
      <el-button size="small" type="primary" :loading="naming" :disabled="locked" @click="confirmCreateSession">
        确认
      </el-button>
      <el-button size="small" :disabled="naming" @click="cancelNaming">取消</el-button>
    </div>

    <AiSceneTree
      v-if="variant === 'rail' || !collapsed"
      :scenes="displayScenes"
      :selected-id="selectedId"
      :collapsed="collapsed && variant === 'rail'"
      @select="onSelectScene"
    />

    <template v-if="!collapsed">
      <AiChatThread
        :messages="messages"
        :sending="sending"
        :streaming-thinking="streamingThinking"
        :streaming-reply="streamingReply"
        :thinking-live="thinkingLive"
        :context-labels="liveContextLabels"
      />

      <p v-if="contextHint && !collapsed && !locked" class="ai-form-dock__hint">{{ contextHint }}</p>

      <p v-if="locked && !collapsed" class="ai-form-dock__lock">{{ resolvedLockHint }}</p>
      <p v-else-if="writeLocked && !collapsed" class="ai-form-dock__hint">{{ writeLockHint }}</p>

      <p v-if="error" class="ai-form-dock__error">{{ error }}</p>

      <div class="ai-form-dock__composer">
        <el-input
          v-model="input"
          type="textarea"
          :rows="2"
          :placeholder="locked ? resolvedLockHint : placeholder"
          :disabled="sending || locked"
          @keydown.enter.exact.prevent="send"
        />
        <el-button type="primary" :loading="sending" :disabled="locked || !input.trim()" @click="send">
          发送
        </el-button>
      </div>

      <div class="ai-form-dock__apply">
        <el-button type="primary" plain :disabled="locked || writeLocked || !canApply" @click="onApply">{{ applyLabel }}</el-button>
        <el-button
          v-if="autorunLabel"
          type="primary"
          :disabled="locked || !canApply || autorunActive"
          :loading="autorunActive"
          @click="onAutorun"
        >{{ autorunLabel }}</el-button>
        <el-button link :disabled="locked || !pendingMessage" @click="discardPending">丢弃本轮</el-button>
      </div>
    </template>
  </aside>
</template>

<script setup>
import { computed, nextTick, ref, toRef, watch } from 'vue';

defineOptions({ inheritAttrs: false });
import { ElMessage } from 'element-plus';
import AiSceneTree from './AiSceneTree.vue';
import AiChatThread from './AiChatThread.vue';
import { useAiDock } from '../../../composables/useAiDock.js';
import { decoratePlanScenes } from '../../../utils/aiScenes.js';
import { collectContextLabels } from '../../../utils/aiChatDisplay.js';

const props = defineProps({
  scenes: { type: Array, default: () => [] },
  featureKey: { type: String, default: 'basic' },
  novelId: { type: [Number, String], default: null },
  formSnapshot: { type: Object, default: () => ({}) },
  requireNovelId: { type: Boolean, default: false },
  alwaysInteractive: { type: Boolean, default: false },
  sessionLocked: { type: Boolean, default: false },
  lockHint: { type: String, default: '' },
  writeLocked: { type: Boolean, default: false },
  writeLockHint: { type: String, default: '' },
  sessionTitle: { type: String, default: '' },
  contextHint: { type: String, default: '' },
  applyLabel: { type: String, default: '应用到表单' },
  autorunLabel: { type: String, default: '' },
  autorunActive: { type: Boolean, default: false },
  applySuccess: { type: String, default: '已写入表单，保存草稿后才会入库' },
  embedded: { type: Boolean, default: false },
  variant: { type: String, default: 'rail' },
  startExpanded: { type: Boolean, default: false },
  storageKey: { type: String, default: '' },
  defaultCollapsed: { type: Boolean, default: false },
});

const emit = defineEmits(['apply', 'focus', 'autorun']);

const namingOpen = ref(false);
const naming = ref(false);
const newSessionTitle = ref('');
const nameInputRef = ref(null);

function cancelNaming() {
  namingOpen.value = false;
  newSessionTitle.value = '';
}

async function toggleNaming() {
  if (locked.value) return;
  namingOpen.value = !namingOpen.value;
  if (!namingOpen.value) {
    newSessionTitle.value = '';
    return;
  }
  await nextTick();
  nameInputRef.value?.focus?.();
}

async function confirmCreateSession() {
  if (locked.value || naming.value) return;
  const title = newSessionTitle.value.trim();
  if (!title) {
    ElMessage.info('请先给话题起个名字');
    return;
  }
  naming.value = true;
  try {
    await createSession(title);
    cancelNaming();
  } finally {
    naming.value = false;
  }
}

const {
  collapsed,
  toggleCollapsed,
  sessions,
  sessionId,
  messages,
  sending,
  error,
  locked,
  writeLocked,
  input,
  selectedId,
  selectedNode,
  targetFields,
  placeholder,
  canApply,
  pendingMessage,
  streamingThinking,
  streamingReply,
  thinkingLive,
  selectScene,
  createSession,
  removeSession,
  switchSession,
  send,
  sendText,
  applyPending,
  discardPending,
} = useAiDock({
  scenes: toRef(props, 'scenes'),
  featureKey: toRef(props, 'featureKey'),
  novelId: toRef(props, 'novelId'),
  formSnapshot: toRef(props, 'formSnapshot'),
  requireNovelId: toRef(props, 'requireNovelId'),
  alwaysInteractive: toRef(props, 'alwaysInteractive'),
  sessionLocked: toRef(props, 'sessionLocked'),
  lockHint: toRef(props, 'lockHint'),
  writeLocked: toRef(props, 'writeLocked'),
  sessionTitle: toRef(props, 'sessionTitle'),
  startExpanded: toRef(props, 'startExpanded'),
  storageKey: toRef(props, 'storageKey'),
  defaultCollapsed: toRef(props, 'defaultCollapsed'),
});

const resolvedLockHint = computed(() => {
  if (props.lockHint) return props.lockHint;
  if (props.sessionLocked) return '打开「编辑」后才能对话、新开会话或应用到本章';
  if (props.alwaysInteractive) return '';
  if (props.requireNovelId && (props.novelId == null || props.novelId === '')) {
    return '请先保存基础信息';
  }
  return '当前不可用';
});

const writeLockHint = computed(() => (
  props.writeLockHint || '打开「编辑」后才能把结果写入本章'
));

const displayScenes = computed(() => {
  if (props.featureKey !== 'orchestrate') return props.scenes;
  return decoratePlanScenes(props.scenes, pendingMessage.value?.patch_json?.tasks);
});

const liveContextLabels = computed(() => collectContextLabels(props.formSnapshot));

watch(selectedNode, (node) => {
  emit('focus', node?.path || null);
}, { immediate: true });

function onSelectScene(id) {
  if (locked.value) return;
  selectScene(id, { expand: true });
}

async function onApply() {
  if (locked.value) {
    ElMessage.info(resolvedLockHint.value);
    return;
  }
  if (writeLocked.value) {
    ElMessage.info(writeLockHint.value);
    return;
  }
  if (props.featureKey === 'orchestrate') {
    const patch = pendingMessage.value?.patch_json;
    if (patch && Object.keys(patch).length) {
      emit('apply', patch, [...(targetFields.value || [])], {
        sessionId: sessionId.value,
        taskPath: selectedNode.value?.taskPath || '',
        scene: selectedNode.value?.scene || '',
      });
      return;
    }
    ElMessage.info('请先发送一句话生成开书计划');
    return;
  }
  const patch = await applyPending();
  if (patch && Object.keys(patch).length) {
    emit('apply', patch, [...(targetFields.value || [])], {
      sessionId: sessionId.value,
      taskPath: selectedNode.value?.taskPath || '',
      scene: selectedNode.value?.scene || '',
    });
    if (props.applySuccess) ElMessage.success(props.applySuccess);
  } else {
    ElMessage.info('这一轮没有可应用的字段');
  }
}

function onAutorun() {
  if (locked.value) {
    ElMessage.info(resolvedLockHint.value);
    return;
  }
  if (props.autorunActive) return;
  const patch = pendingMessage.value?.patch_json;
  if (!patch || !Array.isArray(patch.tasks) || !patch.tasks.length) {
    ElMessage.info('请先发送一句话生成开书计划');
    return;
  }
  if (!sessionId.value) {
    ElMessage.error('没有计划会话');
    return;
  }
  emit('autorun', {
    sessionId: sessionId.value,
    taskPath: selectedNode.value?.taskPath || '',
    scene: selectedNode.value?.scene || '',
  });
}

defineExpose({
  sendText,
  applyPending,
  canApply,
  sending,
  pendingMessage,
  sessionId,
});
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

.ai-form-dock.is-embedded {
  width: 100%;
  border-right: none;
  background: transparent;
  backdrop-filter: none;
  padding: 0;
}

.ai-form-dock.is-collapsed {
  width: 64px;
  padding: 10px 6px;
  align-items: center;
}

.ai-form-dock.is-bar {
  width: 100%;
  height: 380px;
  border-right: none;
  border-top: var(--novel-border-subtle);
  background: var(--novel-color-glass);
}

.ai-form-dock.is-bar.is-collapsed {
  width: 100%;
  height: 48px;
  min-height: 48px;
  padding: 6px 12px;
  flex-direction: row;
  align-items: center;
}

.ai-form-dock.is-bar.is-embedded {
  padding: 8px 10px 10px;
}

.ai-form-dock.is-bar.is-embedded.is-collapsed {
  padding: 6px 12px;
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
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  flex-shrink: 0;
}

.ai-form-dock__name {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  flex-shrink: 0;
}

.ai-form-dock__error {
  margin: 0;
  font-size: 12px;
  color: var(--novel-color-danger);
  line-height: 1.4;
}

.ai-form-dock__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--novel-color-moon);
}

.ai-form-dock__lock {
  margin: 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--novel-color-moon);
  background: var(--novel-color-primary-muted);
  border-radius: 8px;
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
  flex-wrap: wrap;
  gap: 8px;
  flex-shrink: 0;
}

.ai-form-dock.is-locked .ai-form-dock__sessions,
.ai-form-dock.is-locked .ai-form-dock__composer,
.ai-form-dock.is-locked .ai-form-dock__apply {
  opacity: 0.65;
}
</style>
