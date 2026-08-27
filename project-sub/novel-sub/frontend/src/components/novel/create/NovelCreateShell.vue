<template>
  <div class="novel-create-shell">
    <header class="novel-create-shell__header">
      <div class="novel-create-shell__header-inner">
        <el-button link class="novel-create-shell__back" @click="$emit('back')">
          ← 返回列表
        </el-button>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>
            <a href="#" @click.prevent="$emit('back')">小说中心</a>
          </el-breadcrumb-item>
          <el-breadcrumb-item>新建小说</el-breadcrumb-item>
          <el-breadcrumb-item v-if="stepTitle">{{ stepTitle }}</el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      <div class="novel-scroll-title">
        <h1 class="novel-scroll-title__text">奇幻小说创作向导</h1>
        <p class="novel-scroll-title__sub">在清新林间，写下故事的起源</p>
      </div>
    </header>

    <div class="novel-create-shell__body">
      <slot name="steps" />
      <div class="novel-create-shell__content novel-fade-in">
        <slot />
      </div>
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  stepTitle: { type: String, default: '' },
});

defineEmits(['back']);
</script>

<style scoped>
.novel-create-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  height: 100%;
  box-sizing: border-box;
  padding: 16px 20px 0;
  gap: 12px;
}

.novel-create-shell__header {
  flex-shrink: 0;
}

.novel-create-shell__header-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.novel-create-shell__back {
  color: var(--novel-color-primary);
  font-weight: 600;
}

.novel-scroll-title {
  padding: 24px 20px;
  text-align: center;
  border: var(--novel-border-subtle);
  border-radius: var(--novel-radius-base);
  background: var(--novel-gradient-hero);
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
  box-shadow: var(--novel-shadow-soft);
}

.novel-scroll-title__text {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
  color: var(--novel-color-deep);
}

.novel-scroll-title__sub {
  margin: 0;
  color: var(--novel-color-text-secondary);
  font-size: 14px;
}

.novel-create-shell__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 16px;
}

.novel-create-shell__content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
</style>
