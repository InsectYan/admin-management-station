<template>
  <div class="ai-scene-tree" :class="{ 'is-collapsed': collapsed }">
    <button
      v-for="node in leafScenes"
      :key="node.id"
      type="button"
      class="ai-scene-card"
      :class="{
        'is-active': selectedId === node.id,
        'is-disabled': node.selectable === false,
      }"
      :disabled="node.selectable === false"
      :title="node.selectable === false ? (node.disabledHint || '请在表单中手动选择') : node.title"
      @click="node.selectable !== false && $emit('select', node.id)"
    >
      <el-icon :size="collapsed ? 20 : 18">
        <component :is="iconOf(node.icon)" />
      </el-icon>
      <span v-if="!collapsed" class="ai-scene-card__title">{{ node.title }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import {
  AlarmClock,
  Avatar,
  ChatLineSquare,
  Clock,
  Coin,
  CollectionTag,
  Cpu,
  Document,
  EditPen,
  Flag,
  FolderOpened,
  Guide,
  Histogram,
  Location,
  MagicStick,
  MapLocation,
  Notebook,
  OfficeBuilding,
  PriceTag,
  Reading,
  Share,
  Timer,
  User,
  UserFilled,
} from '@element-plus/icons-vue';

const props = defineProps({
  scenes: { type: Array, default: () => [] },
  selectedId: { type: String, default: '' },
  collapsed: { type: Boolean, default: false },
});

const leafScenes = computed(() => {
  const leaves = [];
  for (const node of props.scenes || []) {
    if (node.children?.length) {
      leaves.push(...node.children);
    } else {
      leaves.push(node);
    }
  }
  return leaves;
});

defineEmits(['select']);

const ICONS = {
  AlarmClock,
  Avatar,
  ChatLineSquare,
  Clock,
  Coin,
  CollectionTag,
  Cpu,
  Document,
  EditPen,
  Flag,
  FolderOpened,
  Guide,
  Histogram,
  Location,
  MagicStick,
  MapLocation,
  Notebook,
  OfficeBuilding,
  PriceTag,
  Reading,
  Share,
  Timer,
  User,
  UserFilled,
};

function iconOf(name) {
  return ICONS[name] || Notebook;
}
</script>

<style scoped>
.ai-scene-tree {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: stretch;
  gap: 6px;
  flex-shrink: 0;
  min-height: 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px 0 8px;
  scrollbar-width: thin;
}

.ai-scene-tree.is-collapsed {
  flex-direction: column;
  align-items: center;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 4px 2px;
}

.ai-scene-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 0 0 auto;
  border: var(--novel-border-subtle);
  background: var(--novel-color-glass);
  color: var(--novel-color-text);
  border-radius: 12px;
  padding: 8px 6px;
  cursor: pointer;
  min-height: 52px;
  min-width: 72px;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.ai-scene-tree.is-collapsed .ai-scene-card {
  min-width: 0;
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
