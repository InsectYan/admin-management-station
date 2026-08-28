<template>
  <div class="ai-scene-tree" :class="{ 'is-collapsed': collapsed }">
    <div
      v-for="node in scenes"
      :key="node.id"
      class="ai-scene-tree__group"
    >
      <button
        type="button"
        class="ai-scene-card ai-scene-card--parent"
        :class="{ 'is-active': selectedId === node.id }"
        :title="node.title"
        @click="$emit('select', node.id)"
      >
        <el-icon :size="collapsed ? 20 : 18">
          <component :is="iconOf(node.icon)" />
        </el-icon>
        <span v-if="!collapsed" class="ai-scene-card__title">{{ node.title }}</span>
      </button>
      <div v-if="node.children?.length" class="ai-scene-tree__children">
        <button
          v-for="child in node.children"
          :key="child.id"
          type="button"
          class="ai-scene-card ai-scene-card--child"
          :class="{
            'is-active': selectedId === child.id,
            'is-disabled': child.selectable === false,
          }"
          :disabled="child.selectable === false"
          :title="child.selectable === false ? (child.disabledHint || '请在表单中手动选择') : child.title"
          @click="child.selectable !== false && $emit('select', child.id)"
        >
          <el-icon :size="18">
            <component :is="iconOf(child.icon)" />
          </el-icon>
          <span v-if="!collapsed" class="ai-scene-card__title">{{ child.title }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  AlarmClock,
  ChatLineSquare,
  CollectionTag,
  Document,
  EditPen,
  Notebook,
  PriceTag,
  Timer,
  User,
} from '@element-plus/icons-vue';

defineProps({
  scenes: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  collapsed: { type: Boolean, default: false },
});

defineEmits(['select']);

const ICONS = {
  AlarmClock,
  ChatLineSquare,
  CollectionTag,
  Document,
  EditPen,
  Notebook,
  PriceTag,
  Timer,
  User,
};

function iconOf(name) {
  return ICONS[name] || Notebook;
}
</script>

<style scoped>
.ai-scene-tree {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 2px;
}

.ai-scene-tree.is-collapsed {
  align-items: center;
}

.ai-scene-tree__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-scene-tree__children {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.ai-scene-tree.is-collapsed .ai-scene-tree__children {
  grid-template-columns: 1fr;
}

.ai-scene-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: var(--novel-border-subtle);
  background: var(--novel-color-glass);
  color: var(--novel-color-text);
  border-radius: 12px;
  padding: 8px 6px;
  cursor: pointer;
  min-height: 52px;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.ai-scene-card--parent {
  flex-direction: row;
  justify-content: flex-start;
  gap: 8px;
  padding: 8px 10px;
}

.ai-scene-tree.is-collapsed .ai-scene-card--parent {
  justify-content: center;
  padding: 8px;
}

.ai-scene-card__title {
  font-size: 12px;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.ai-scene-card--parent .ai-scene-card__title {
  text-align: left;
  font-weight: 600;
}

.ai-scene-card:hover {
  background: var(--novel-color-glass-hover);
  border-color: rgba(47, 138, 91, 0.32);
  color: var(--novel-color-deep);
}

.ai-scene-card.is-active {
  background: var(--novel-color-primary-muted);
  border-color: var(--novel-color-primary);
  color: var(--novel-color-primary);
  box-shadow: var(--novel-shadow-focus);
}

.ai-scene-card.is-disabled,
.ai-scene-card:disabled {
  cursor: not-allowed;
  opacity: 0.42;
  color: var(--novel-color-text-muted);
  background: rgba(255, 255, 255, 0.28);
  box-shadow: none;
}

.ai-scene-card.is-disabled:hover,
.ai-scene-card:disabled:hover {
  background: rgba(255, 255, 255, 0.28);
  border-color: rgba(47, 138, 91, 0.12);
  color: var(--novel-color-text-muted);
}
</style>
