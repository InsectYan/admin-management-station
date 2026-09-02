<template>
  <el-dialog
    :model-value="modelValue"
    title="AI 开书"
    width="760px"
    class="ai-open-book-dialog"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <p class="ai-open-book-dialog__lead">
      用一句话说类型、读者和核心冲突。林间策只拆计划；「执行下一步」进向导确认，「连续执行设定」自动补到章节目录并逐步展示，正文仍到单章开发再写。
    </p>
    <div class="ai-open-book-dialog__dock">
      <AiFormDock
        :scenes="ORCHESTRATE_AI_SCENES"
        feature-key="orchestrate"
        session-title="开书计划"
        embedded
        apply-label="执行下一步"
        autorun-label="连续执行设定"
        apply-success=""
        :form-snapshot="snapshot"
        @apply="onApply"
        @autorun="onAutorun"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import AiFormDock from './AiFormDock.vue';
import { ORCHESTRATE_AI_SCENES } from '../../../utils/aiScenes.js';
import { dispatchAiPlan } from '../../../services/aiService.js';
import { routeAfterDispatch } from '../../../utils/aiDispatchNav.js';

defineProps({
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue']);
const router = useRouter();
const snapshot = {
  coverage: {
    basic: false,
    world: false,
    factions: false,
    characters: false,
    outline: false,
    content: false,
    bodies: false,
  },
};

async function onApply(patch, _paths, meta = {}) {
  const tasks = Array.isArray(patch?.tasks) ? patch.tasks : [];
  if (!tasks.length) {
    ElMessage.info('请先发送一句话，生成开书计划');
    return;
  }
  const sessionId = meta.sessionId;
  if (!sessionId) {
    ElMessage.error('没有计划会话');
    return;
  }
  try {
    const result = await dispatchAiPlan({
      plan_session_id: sessionId,
      task_path: meta.taskPath || undefined,
    });
    const dest = routeAfterDispatch(result);
    if (!dest) {
      ElMessage.error('执行成功但缺少小说 ID');
      return;
    }
    ElMessage.success(result.tab === 7 ? '已执行，正在打开单章开发' : '已执行，正在打开向导');
    emit('update:modelValue', false);
    router.push(dest);
  } catch (err) {
    ElMessage.error(err.message || '执行失败');
  }
}

function onAutorun(meta = {}) {
  if (!meta.sessionId) {
    ElMessage.error('没有计划会话');
    return;
  }
  emit('update:modelValue', false);
  router.push({
    name: 'novel-create',
    query: {
      ai: 'plan',
      plan_session: String(meta.sessionId),
      autorun: 'settings',
    },
  });
}
</script>

<style scoped>
.ai-open-book-dialog__lead {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--novel-color-moon);
}

.ai-open-book-dialog__dock {
  height: 520px;
  min-height: 0;
  display: flex;
  border: var(--novel-border-subtle);
  border-radius: var(--novel-radius-base);
  background: var(--novel-color-glass);
  overflow: hidden;
}
</style>
