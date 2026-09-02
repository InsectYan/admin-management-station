<template>
  <div class="novel-step-factions">
    <p class="novel-step-factions__hint">
      描述门派、家族、国家等组织实体；章节场次仍在「章节目录」里标正反派。
    </p>
    <aside class="novel-step-factions__list">
      <div class="novel-step-factions__list-head">
        <span>组织库</span>
        <el-button size="small" class="novel-wood-button" @click="$emit('add')">+ 添加组织</el-button>
      </div>
      <button
        v-for="item in factions"
        :key="item.id"
        type="button"
        class="novel-step-factions__item"
        :class="{ 'is-active': item.id === localActiveId }"
        @click="select(item.id)"
      >
        <span>{{ item.name || '未命名组织' }}</span>
        <el-tag size="small" effect="plain">{{ kindLabel(item.kind) }}</el-tag>
      </button>
      <el-empty v-if="!factions.length" description="暂无门派组织" :image-size="48" />
    </aside>
    <FactionCard
      v-if="activeFaction"
      :faction="activeFaction"
      :characters="characters"
      @change="$emit('change')"
      @remove="$emit('remove', activeFaction.id)"
    />
    <el-empty v-else description="从左侧选择或添加组织" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import FactionCard from './FactionCard.vue';
import { FACTION_KIND_OPTIONS } from '../../../utils/novelCreateSchema.js';

const props = defineProps({
  factions: { type: Array, required: true },
  characters: { type: Array, default: () => [] },
  activeId: { type: String, default: '' },
});

const emit = defineEmits(['change', 'add', 'remove', 'update:activeId']);

const localActiveId = ref(props.activeId || '');
const activeFaction = computed(() => props.factions.find((item) => item.id === localActiveId.value));

function kindLabel(kind) {
  return FACTION_KIND_OPTIONS.find((item) => item.value === kind)?.label || kind;
}

function select(id) {
  localActiveId.value = id;
  emit('update:activeId', id);
}

watch(
  () => props.activeId,
  (id) => {
    if (id && id !== localActiveId.value) localActiveId.value = id;
  },
);

watch(
  () => props.factions,
  (list) => {
    if (!list.length) {
      localActiveId.value = '';
      emit('update:activeId', '');
      return;
    }
    if (!list.some((item) => item.id === localActiveId.value)) {
      localActiveId.value = list[0].id;
      emit('update:activeId', localActiveId.value);
    }
  },
  { immediate: true, deep: true },
);
</script>

<style scoped>
.novel-step-factions {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.novel-step-factions__hint {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 13px;
  color: var(--novel-color-moon);
}

.novel-step-factions__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--novel-radius-base);
  background: var(--novel-color-glass);
  border: var(--novel-border-subtle);
}

.novel-step-factions__list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  color: var(--novel-color-forest);
}

.novel-step-factions__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--novel-radius-sm);
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  text-align: left;
}

.novel-step-factions__item.is-active,
.novel-step-factions__item:hover {
  border-color: var(--novel-color-primary);
  background: var(--novel-color-primary-muted);
}

@media (max-width: 768px) {
  .novel-step-factions {
    grid-template-columns: 1fr;
  }
}
</style>
