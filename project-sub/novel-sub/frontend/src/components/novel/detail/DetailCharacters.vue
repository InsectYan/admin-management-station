<template>
  <div class="novel-detail-characters">
    <el-empty v-if="!characters.length" description="暂无人物设定" />

    <template v-else>
      <div class="novel-detail-characters__stats">
        <el-tag type="success" effect="plain">主角 {{ roleStats.main }}</el-tag>
        <el-tag type="info" effect="plain">配角 {{ roleStats.support }}</el-tag>
        <el-tag type="danger" effect="plain">反派 {{ roleStats.villain }}</el-tag>
      </div>

      <div class="novel-detail-characters__layout">
        <aside class="novel-detail-characters__list">
          <button
            v-for="item in characters"
            :key="item.id"
            type="button"
            class="novel-detail-characters__item"
            :class="{ 'is-active': item.id === activeId }"
            @click="activeId = item.id"
          >
            <span class="novel-detail-characters__name">{{ item.name || '未命名' }}</span>
            <el-tag size="small" :type="roleTagType(item.role)" effect="plain">
              {{ roleLabel(item.role) }}
            </el-tag>
          </button>
        </aside>

        <section v-if="activeCharacter" class="novel-detail-card">
          <div class="novel-detail-card__head">
            <h3>{{ activeCharacter.name || '未命名' }}</h3>
            <el-tag :type="roleTagType(activeCharacter.role)" size="small">
              {{ roleLabel(activeCharacter.role) }}
            </el-tag>
          </div>
          <dl class="novel-detail-fields">
            <div>
              <dt>性格</dt>
              <dd>{{ displayText(activeCharacter.personality) }}</dd>
            </div>
            <div>
              <dt>背景</dt>
              <dd>{{ displayText(activeCharacter.background) }}</dd>
            </div>
            <div>
              <dt>目标 / 动机</dt>
              <dd>{{ displayText(activeCharacter.goal) }}</dd>
            </div>
            <div>
              <dt>人物关系</dt>
              <dd>{{ displayText(activeCharacter.relations) }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section class="novel-detail-card">
        <h3 class="novel-detail-card__title">人物关系网</h3>
        <CharacterRelationGraph
          :characters="characters"
          :edges="edges"
          readonly
        />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import CharacterRelationGraph from '../create/CharacterRelationGraph.vue';
import {
  characterRoleStats,
  displayText,
  roleLabel,
  roleTagType,
} from '../../../utils/novelDetail.js';

const props = defineProps({
  characters: { type: Array, required: true },
  edges: { type: Array, required: true },
});

const activeId = ref('');
const roleStats = computed(() => characterRoleStats(props.characters));
const activeCharacter = computed(() => props.characters.find((c) => c.id === activeId.value));

watch(
  () => props.characters,
  (list) => {
    if (!list.length) {
      activeId.value = '';
      return;
    }
    if (!list.some((c) => c.id === activeId.value)) {
      activeId.value = list[0].id;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.novel-detail-characters {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.novel-detail-characters__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.novel-detail-characters__layout {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.novel-detail-characters__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: var(--novel-color-mist, #f0f4f1);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  border-radius: var(--novel-radius-base, 10px);
}

.novel-detail-characters__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: var(--novel-radius-sm, 6px);
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.novel-detail-characters__item.is-active,
.novel-detail-characters__item:hover {
  background: var(--novel-color-surface-elevated, #fff);
  border-color: rgba(61, 107, 79, 0.2);
}

.novel-detail-characters__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--novel-color-text, #2f3d34);
}

.novel-detail-card {
  padding: 18px;
  background: var(--novel-color-surface, #fbfcfa);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  border-radius: var(--novel-radius-base, 10px);
}

.novel-detail-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}

.novel-detail-card__head h3 {
  margin: 0;
  font-size: 18px;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-detail-card__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-detail-card :deep(.novel-relation-graph) {
  margin-top: 0;
  padding-top: 0;
  border-top: none;
}

.novel-detail-fields {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.novel-detail-fields dt {
  font-size: 12px;
  color: var(--novel-color-text-muted, #8a968e);
  margin-bottom: 4px;
}

.novel-detail-fields dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--novel-color-text, #2f3d34);
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .novel-detail-characters__layout {
    grid-template-columns: 1fr;
  }
}
</style>
