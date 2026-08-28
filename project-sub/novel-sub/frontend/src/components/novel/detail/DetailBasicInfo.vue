<template>
  <div class="novel-detail-panel">
    <section class="novel-detail-card">
      <h3 class="novel-detail-card__title">基础信息</h3>
      <dl class="novel-detail-fields">
        <div class="novel-detail-fields__row">
          <dt>小说名称</dt>
          <dd class="is-strong">{{ displayText(form.title) }}</dd>
        </div>
        <div class="novel-detail-fields__row">
          <dt>创作立意</dt>
          <dd class="novel-detail-intent">{{ displayText(form.creative_intent) }}</dd>
        </div>
        <div class="novel-detail-fields__row novel-detail-fields__row--split">
          <div>
            <dt>小说类型</dt>
            <dd>
              <el-tag v-if="genreLabel" size="small">{{ genreLabel }}</el-tag>
              <span v-else class="is-muted">未填写</span>
            </dd>
          </div>
          <div>
            <dt>篇幅</dt>
            <dd>
              <el-tag v-if="form.novel_type" size="small" effect="plain">{{ form.novel_type }}</el-tag>
              <span v-else class="is-muted">未填写</span>
            </dd>
          </div>
        </div>
        <div class="novel-detail-fields__row">
          <dt>题材</dt>
          <dd>
            <div v-if="themeNames.length" class="novel-detail-tags">
              <el-tag v-for="name in themeNames" :key="name" size="small" effect="plain">{{ name }}</el-tag>
            </div>
            <span v-else class="is-muted">未填写</span>
          </dd>
        </div>
        <div class="novel-detail-fields__row">
          <dt>小说简介</dt>
          <dd>
            <p class="novel-detail-summary">{{ summaryText }}</p>
            <el-button
              v-if="needToggle"
              link
              type="primary"
              @click="expanded = !expanded"
            >
              {{ expanded ? '收起' : '展开全文' }}
            </el-button>
          </dd>
        </div>
        <div class="novel-detail-fields__row">
          <dt>目标读者</dt>
          <dd>
            <el-tag v-if="audienceText" size="small" effect="plain">{{ audienceText }}</el-tag>
            <span v-else class="is-muted">未填写</span>
          </dd>
        </div>
        <div class="novel-detail-fields__row novel-detail-fields__row--split">
          <div>
            <dt>更新节奏</dt>
            <dd>{{ displayText(form.update_cadence) }}</dd>
          </div>
          <div>
            <dt>作者</dt>
            <dd>{{ displayText(form.author_name) }}</dd>
          </div>
        </div>
      </dl>
    </section>

    <aside class="novel-detail-card novel-detail-aside">
      <h3 class="novel-detail-card__title">创作状态</h3>
      <dl class="novel-detail-fields">
        <div class="novel-detail-fields__row">
          <dt>进度</dt>
          <dd>{{ progressLabel(form.progress_status) }} · {{ form.progress_percent || 0 }}%</dd>
        </div>
        <div class="novel-detail-fields__row">
          <dt>创建时间</dt>
          <dd>{{ displayText(meta.created_at) }}</dd>
        </div>
        <div class="novel-detail-fields__row">
          <dt>更新时间</dt>
          <dd>{{ displayText(meta.updated_at) }}</dd>
        </div>
      </dl>
    </aside>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { displayText, SUMMARY_PREVIEW_LEN } from '../../../utils/novelDetail.js';
import { formatGenreLabel, progressLabel } from '../../../utils/novelMeta.js';

const props = defineProps({
  form: { type: Object, required: true },
  meta: { type: Object, default: () => ({}) },
});

const expanded = ref(false);

const genreLabel = computed(() => formatGenreLabel(props.form));
const themeNames = computed(() => (props.form.themes || []).map((t) => t.name).filter(Boolean));
const audienceText = computed(() => {
  const value = props.form.target_audience;
  if (Array.isArray(value)) return value.filter(Boolean).join('、');
  return value || '';
});

const needToggle = computed(() => (props.form.summary || '').length > SUMMARY_PREVIEW_LEN);

const summaryText = computed(() => {
  const text = props.form.summary?.trim();
  if (!text) return '未填写';
  if (!expanded.value && text.length > SUMMARY_PREVIEW_LEN) {
    return `${text.slice(0, SUMMARY_PREVIEW_LEN)}…`;
  }
  return text;
});
</script>

<style scoped>
.novel-detail-panel {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(240px, 1fr);
  gap: 16px;
  align-items: start;
}

.novel-detail-card {
  padding: 20px;
  background: var(--novel-color-surface, #fbfcfa);
  border: var(--novel-border-subtle, 1px solid rgba(61, 107, 79, 0.12));
  border-radius: var(--novel-radius-base, 10px);
  box-shadow: var(--novel-shadow-soft, 0 1px 2px rgba(42, 58, 48, 0.05));
}

.novel-detail-card__title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 700;
  color: var(--novel-color-deep, #2a3a30);
}

.novel-detail-fields {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.novel-detail-fields__row dt {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--novel-color-text-muted, #8a968e);
}

.novel-detail-fields__row dd {
  margin: 0;
  font-size: 14px;
  color: var(--novel-color-text, #2f3d34);
  line-height: 1.6;
  white-space: pre-wrap;
}

.novel-detail-fields__row--split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.is-strong {
  font-size: 18px !important;
  font-weight: 700;
  color: var(--novel-color-deep, #2a3a30) !important;
}

.novel-detail-intent {
  padding: 10px 12px;
  border-left: 3px solid var(--novel-color-primary, #3d6b4f);
  background: var(--novel-color-primary-muted, rgba(61, 107, 79, 0.1));
}

.novel-detail-summary {
  margin: 0;
}

.novel-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.is-muted {
  color: var(--novel-color-text-muted, #8a968e);
}

@media (max-width: 960px) {
  .novel-detail-panel {
    grid-template-columns: 1fr;
  }

  .novel-detail-fields__row--split {
    grid-template-columns: 1fr;
  }
}
</style>
