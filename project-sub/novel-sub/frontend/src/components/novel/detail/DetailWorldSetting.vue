<template>
  <div class="novel-detail-world">
    <div class="novel-detail-world__grid">
      <section
        v-for="block in blocks"
        :key="block.key"
        class="novel-detail-card novel-detail-card--accent"
      >
        <h3 class="novel-detail-card__title">{{ block.title }}</h3>
        <NovelMarkdown :source="block.value" empty-text="未填写" />
      </section>
    </div>

    <section class="novel-detail-card">
      <h3 class="novel-detail-card__title">历史时间轴</h3>
      <el-empty v-if="!timeline.length" description="暂无历史节点" :image-size="72" />
      <ol v-else class="novel-detail-timeline">
        <li v-for="(node, index) in timeline" :key="node.id" class="novel-detail-timeline__item">
          <span class="novel-detail-timeline__index">{{ index + 1 }}</span>
          <div>
            <div class="novel-detail-timeline__year">{{ displayText(formatLooseDate(node.year), '未标年代') }}</div>
            <p class="novel-detail-timeline__event">
              <NovelMarkdown compact :source="node.event" empty-text="未填写" />
            </p>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import NovelMarkdown from '../markdown/NovelMarkdown.vue';
import { displayText } from '../../../utils/novelDetail.js';
import { formatLooseDate } from '../../../utils/formatDateTime.js';

const props = defineProps({
  form: { type: Object, required: true },
});

const blocks = computed(() => [
  { key: 'era', title: '时代背景', value: props.form.era },
  { key: 'geography', title: '地理与环境', value: props.form.geography },
  { key: 'social', title: '社会规则', value: props.form.social_rules },
  { key: 'power', title: '力量体系', value: props.form.power_system },
  { key: 'tech', title: '科技水平', value: props.form.technology },
  { key: 'history', title: '历史概览', value: props.form.history_notes },
]);

const timeline = computed(() => props.form.timeline || []);
</script>

<style scoped>
.novel-detail-world {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.novel-detail-world__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.novel-detail-card {
  padding: 16px 18px;
  background: var(--novel-color-surface, #fbfcfa);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  border-radius: var(--novel-radius-base, 10px);
}

.novel-detail-card--accent {
  border-left: 3px solid var(--novel-color-primary, #3d6b4f);
}

.novel-detail-card__title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-detail-card :deep(.novel-md) {
  font-size: 14px;
  line-height: 1.7;
}

.is-muted {
  color: var(--novel-color-text-muted, #8a968e);
}

.novel-detail-timeline {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.novel-detail-timeline__item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.novel-detail-timeline__index {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--novel-color-primary, #3d6b4f);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.novel-detail-timeline__year {
  font-weight: 600;
  color: var(--novel-color-deep, #2a3a30);
  margin-bottom: 4px;
}

.novel-detail-timeline__event {
  margin: 0;
  font-size: 13px;
  color: var(--novel-color-text-secondary, #5c6b62);
}

@media (max-width: 768px) {
  .novel-detail-world__grid {
    grid-template-columns: 1fr;
  }
}
</style>
