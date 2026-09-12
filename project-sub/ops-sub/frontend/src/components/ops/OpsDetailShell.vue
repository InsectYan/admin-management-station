<template>
  <div class="ops-detail-shell">
    <header class="ops-detail-shell__header">
      <div class="ops-detail-shell__header-inner">
        <el-button link class="ops-detail-shell__back" @click="$emit('back')">
          ← 返回列表
        </el-button>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>
            <a href="#" @click.prevent="$emit('back')">运维项目</a>
          </el-breadcrumb-item>
          <el-breadcrumb-item>详情</el-breadcrumb-item>
          <el-breadcrumb-item v-if="tabTitle">{{ tabTitle }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="ops-detail-shell__actions">
          <el-button @click="$emit('export')">导出配置</el-button>
          <el-button type="primary" :loading="saving" @click="$emit('save')">保存</el-button>
        </div>
      </div>
      <div class="ops-detail-hero">
        <div class="ops-detail-hero__cover">
          <div class="ops-detail-hero__cover-fallback">{{ coverLetter }}</div>
        </div>
        <div class="ops-detail-hero__meta">
          <h1 class="ops-detail-hero__title">{{ title || '未命名项目' }}</h1>
          <p class="ops-detail-hero__intent">{{ description || '暂无简介' }}</p>
          <div class="ops-detail-hero__tags">
            <el-tag v-if="typeLabelText" size="small">{{ typeLabelText }}</el-tag>
            <el-tag v-if="statusLabel" size="small" :type="statusType" effect="light">
              {{ statusLabel }}
            </el-tag>
          </div>
        </div>
      </div>
    </header>

    <div class="ops-detail-shell__body">
      <aside class="ops-detail-shell__nav">
        <slot name="tabs" />
      </aside>
      <div class="ops-detail-shell__content ops-fade-in" :class="{ 'is-fill': fillPane }">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { coverFallback, statusMeta, typeLabel } from '../../utils/opsMeta.js';

const props = defineProps({
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  projectType: { type: String, default: '' },
  status: { type: String, default: '' },
  tabTitle: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  fillPane: { type: Boolean, default: false },
});

defineEmits(['back', 'save', 'export']);

const coverLetter = computed(() => coverFallback(props.title));
const typeLabelText = computed(() => typeLabel(props.projectType));
const status = computed(() => statusMeta(props.status));
const statusLabel = computed(() => status.value.label);
const statusType = computed(() => status.value.type);
</script>

<style scoped>
.ops-detail-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.ops-detail-shell__header {
  flex-shrink: 0;
  padding: 12px 20px 0;
  background: var(--ops-gradient-hero);
  border-bottom: var(--ops-border-subtle);
}

.ops-detail-shell__header-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ops-detail-shell__back {
  padding-left: 0;
}

.ops-detail-shell__actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.ops-detail-hero {
  display: flex;
  gap: 16px;
  padding: 16px 0 18px;
}

.ops-detail-hero__cover {
  width: 72px;
  height: 72px;
  border-radius: var(--ops-radius-base);
  background: var(--ops-gradient-cover);
  border: var(--ops-border-subtle);
  overflow: hidden;
  flex-shrink: 0;
}

.ops-detail-hero__cover-fallback {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 700;
  color: var(--ops-color-primary);
}

.ops-detail-hero__title {
  margin: 0 0 6px;
  font-size: 22px;
  color: var(--ops-color-deep);
}

.ops-detail-hero__intent {
  margin: 0 0 8px;
  color: var(--ops-color-text-secondary);
  font-size: 14px;
}

.ops-detail-hero__tags {
  display: flex;
  gap: 6px;
}

.ops-detail-shell__body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.ops-detail-shell__nav {
  width: 168px;
  flex-shrink: 0;
  border-right: var(--ops-border-subtle);
  background: var(--ops-color-glass);
  padding: 12px 8px;
}

.ops-detail-shell__content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 16px 20px 24px;
}

.ops-detail-shell__content.is-fill {
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
}
</style>
