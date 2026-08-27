<template>
  <div class="novel-detail-content">
    <section v-if="chapters.length" class="novel-detail-factions">
      <div class="novel-detail-faction novel-detail-faction--hero">
        <h4>正派阵营</h4>
        <p>{{ stats.hero }} 章 · {{ stats.heroPercent }}%</p>
      </div>
      <div class="novel-detail-faction novel-detail-faction--villain">
        <h4>反派阵营</h4>
        <p>{{ stats.villain }} 章 · {{ stats.villainPercent }}%</p>
      </div>
      <div class="novel-detail-faction novel-detail-faction--neutral">
        <h4>中立</h4>
        <p>{{ stats.neutral }} 章</p>
      </div>
    </section>

    <el-empty v-if="!chapters.length" description="暂无章节组织" />

    <ol v-else class="novel-detail-chapters">
      <li
        v-for="ch in chapters"
        :key="ch.id"
        class="novel-detail-chapter"
        :class="`novel-detail-chapter--${ch.faction}`"
      >
        <span class="novel-detail-chapter__order">{{ ch.order }}</span>
        <div class="novel-detail-chapter__body">
          <strong>{{ ch.title || '未命名章节' }}</strong>
          <div class="novel-detail-chapter__meta">
            <el-tag size="small" effect="plain">{{ factionLabel(ch.faction) }}</el-tag>
            <span v-if="ch.outline_ref" class="is-muted">关联：{{ ch.outline_ref }}</span>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { factionLabel, factionStats } from '../../../utils/novelDetail.js';

const props = defineProps({
  form: { type: Object, required: true },
});

const chapters = computed(() => [...(props.form.chapters || [])].sort((a, b) => (a.order || 0) - (b.order || 0)));
const stats = computed(() => factionStats(chapters.value));
</script>

<style scoped>
.novel-detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.novel-detail-factions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.novel-detail-faction {
  padding: 14px 16px;
  border-radius: var(--novel-radius-base, 10px);
  background: var(--novel-color-surface, #fbfcfa);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
}

.novel-detail-faction h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--novel-color-text-secondary, #5c6b62);
}

.novel-detail-faction p {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-detail-faction--hero {
  border-left: 3px solid var(--novel-color-primary, #3d6b4f);
}

.novel-detail-faction--villain {
  border-left: 3px solid var(--novel-color-danger, #b85c5c);
}

.novel-detail-faction--neutral {
  border-left: 3px solid var(--novel-color-moon, #6d8a82);
}

.novel-detail-chapters {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.novel-detail-chapter {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--novel-radius-base, 10px);
  background: var(--novel-color-surface, #fbfcfa);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
}

.novel-detail-chapter--hero {
  border-left: 3px solid var(--novel-color-primary, #3d6b4f);
}

.novel-detail-chapter--villain {
  border-left: 3px solid var(--novel-color-danger, #b85c5c);
}

.novel-detail-chapter--neutral {
  border-left: 3px solid var(--novel-color-moon, #6d8a82);
}

.novel-detail-chapter__order {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--novel-color-primary-muted, rgba(61, 107, 79, 0.1));
  color: var(--novel-color-primary, #3d6b4f);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.novel-detail-chapter__body {
  min-width: 0;
  flex: 1;
}

.novel-detail-chapter__body strong {
  display: block;
  margin-bottom: 6px;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-detail-chapter__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.is-muted {
  font-size: 12px;
  color: var(--novel-color-text-muted, #8a968e);
}

@media (max-width: 768px) {
  .novel-detail-factions {
    grid-template-columns: 1fr;
  }
}
</style>
