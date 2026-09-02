<template>
  <footer class="novel-create-footer">
    <div class="novel-create-footer__left">
      <el-button class="novel-wood-button" :loading="saving && !autorunActive" :disabled="autorunActive" @click="$emit('save-draft')">
        保存草稿
      </el-button>
      <el-button v-if="autorunActive" class="novel-wood-button" @click="$emit('cancel-autorun')">
        取消连续执行
      </el-button>
    </div>
    <div class="novel-create-footer__right">
      <el-button class="novel-wood-button" :disabled="isFirstStep || autorunActive" @click="$emit('prev')">
        上一步
      </el-button>
      <el-button
        v-if="!isLastStep"
        class="novel-wood-button"
        type="primary"
        :loading="saving"
        :disabled="autorunActive"
        @click="$emit('next')"
      >
        下一步
      </el-button>
      <template v-else>
        <el-button
          class="novel-wood-button"
          type="primary"
          :loading="saving"
          :disabled="!canStartWriting || autorunActive"
          @click="$emit('start-writing')"
        >
          开始写正文
        </el-button>
        <el-button
          class="novel-wood-button"
          :loading="saving"
          :disabled="autorunActive"
          @click="$emit('finish')"
        >
          {{ finishLabel }}
        </el-button>
      </template>
    </div>
  </footer>
</template>

<script setup>
defineProps({
  saving: { type: Boolean, default: false },
  isFirstStep: { type: Boolean, default: true },
  isLastStep: { type: Boolean, default: false },
  canStartWriting: { type: Boolean, default: false },
  finishLabel: { type: String, default: '完成并返回列表' },
  autorunActive: { type: Boolean, default: false },
});

defineEmits(['save-draft', 'prev', 'next', 'finish', 'start-writing', 'cancel-autorun']);
</script>

<style scoped>
.novel-create-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 -20px 0;
  padding: 12px 20px 16px;
  border-top: var(--novel-border-subtle);
  background: var(--novel-color-surface-elevated, rgba(255, 255, 255, 0.82));
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
}

.novel-create-footer__left,
.novel-create-footer__right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
