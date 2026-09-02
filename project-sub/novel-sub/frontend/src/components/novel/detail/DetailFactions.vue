<template>
  <div class="novel-detail-factions-org">
    <el-empty v-if="!factions.length" description="暂无门派组织" />
    <div v-else class="novel-detail-factions-org__grid">
      <section
        v-for="item in factions"
        :key="item.id"
        class="novel-detail-card novel-detail-card--accent"
      >
        <div class="novel-detail-card__head">
          <h3>{{ item.name || '未命名组织' }}</h3>
          <el-tag size="small">{{ kindLabel(item.kind) }}</el-tag>
          <el-tag size="small" effect="plain">{{ alignmentLabel(item.alignment) }}</el-tag>
        </div>
        <dl class="novel-detail-fields">
          <div>
            <dt>驻地</dt>
            <dd>{{ item.headquarters || '未填写' }}</dd>
          </div>
          <div>
            <dt>简介</dt>
            <dd><NovelMarkdown :source="item.description" empty-text="未填写" /></dd>
          </div>
          <div>
            <dt>规矩 / 戒律</dt>
            <dd><NovelMarkdown :source="item.rules" empty-text="未填写" /></dd>
          </div>
          <div v-if="memberNames(item).length">
            <dt>成员</dt>
            <dd>{{ memberNames(item).join('、') }}</dd>
          </div>
        </dl>
      </section>
    </div>
  </div>
</template>

<script setup>
import NovelMarkdown from '../markdown/NovelMarkdown.vue';
import { factionAlignmentLabel, factionKindLabel } from '../../../utils/novelDetail.js';

const props = defineProps({
  factions: { type: Array, default: () => [] },
  characters: { type: Array, default: () => [] },
});

function kindLabel(kind) {
  return factionKindLabel(kind);
}

function alignmentLabel(alignment) {
  return factionAlignmentLabel(alignment);
}

function memberNames(item) {
  const ids = new Set(item.member_ids || []);
  return (props.characters || [])
    .filter((row) => ids.has(row.id) || row.faction_id === item.id)
    .map((row) => row.name || '未命名');
}
</script>

<style scoped>
.novel-detail-factions-org__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.novel-detail-card {
  padding: 16px;
  border-radius: var(--novel-radius-base, 10px);
  background: var(--novel-color-surface, #fbfcfa);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
}

.novel-detail-card--accent {
  border-left: 3px solid var(--novel-color-primary, #3d6b4f);
}

.novel-detail-card__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.novel-detail-card__head h3 {
  margin: 0;
  flex: 1;
  font-size: 16px;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-detail-fields {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.novel-detail-fields dt {
  font-size: 12px;
  color: var(--novel-color-text-secondary, #5c6b62);
}

.novel-detail-fields dd {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--novel-color-text, #2f3d34);
}
</style>
