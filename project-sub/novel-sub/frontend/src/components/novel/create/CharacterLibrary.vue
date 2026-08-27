<template>
  <aside class="novel-character-library">
    <div class="novel-character-library__header">
      <span>角色库</span>
      <el-select
        v-model="filterRole"
        size="small"
        clearable
        placeholder="筛选"
        style="width: 90px"
      >
        <el-option
          v-for="r in CHARACTER_ROLE_OPTIONS"
          :key="r.value"
          :label="r.label"
          :value="r.value"
        />
      </el-select>
    </div>
    <el-button size="small" class="novel-wood-button novel-character-library__add" @click="$emit('add')">
      + 添加角色
    </el-button>
    <div class="novel-character-library__list">
      <button
        v-for="item in filtered"
        :key="item.id"
        type="button"
        class="novel-character-library__item"
        :class="{ 'is-active': item.id === activeId }"
        @click="$emit('select', item.id)"
      >
        <span class="novel-character-library__name">{{ item.name || '未命名' }}</span>
        <el-tag size="small" effect="plain">{{ roleLabel(item.role) }}</el-tag>
      </button>
      <el-empty v-if="!filtered.length" description="暂无角色" :image-size="48" />
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';
import { CHARACTER_ROLE_OPTIONS } from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  characters: { type: Array, required: true },
  activeId: { type: String, default: '' },
});

defineEmits(['add', 'select']);

const filterRole = ref('');

const filtered = computed(() => {
  if (!filterRole.value) return props.characters;
  return props.characters.filter((c) => c.role === filterRole.value);
});

function roleLabel(role) {
  return CHARACTER_ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
}
</script>

<style scoped>
.novel-character-library {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--novel-color-glass);
  border: var(--novel-border-subtle);
  backdrop-filter: blur(var(--novel-backdrop-blur, 12px));
  border-radius: var(--novel-radius-base);
  min-width: 180px;
}

.novel-character-library__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: var(--novel-color-forest);
}

.novel-character-library__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 420px;
  overflow-y: auto;
}

.novel-character-library__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 8px 10px;
  border: 1px dashed transparent;
  border-radius: var(--novel-radius-sm);
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.novel-character-library__item.is-active,
.novel-character-library__item:hover {
  border-color: var(--novel-color-primary);
  background: var(--novel-color-primary-muted);
}

.novel-character-library__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--novel-color-text);
}
</style>
