<template>
  <div class="novel-step-basic">
    <div class="novel-step-basic__form novel-magic-form">
      <el-form
        ref="formRef"
        :model="form"
        label-position="top"
        class="novel-magic-form__inner"
        @input="$emit('change')"
      >
        <el-form-item label="小说名称" prop="title" :rules="[{ required: true, message: '请输入小说名称' }]">
          <el-input
            v-model="form.title"
            maxlength="200"
            show-word-limit
            placeholder="为你的故事命名"
            @input="$emit('change')"
          />
        </el-form-item>

        <el-form-item label="创作立意">
          <el-input
            v-model="form.creative_intent"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="一句话概括你想表达的核心"
            @input="$emit('change')"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="小说类型">
              <el-select
                v-model="form.novel_type"
                clearable
                placeholder="选择类型"
                style="width: 100%"
                @change="$emit('change')"
              >
                <el-option v-for="t in NOVEL_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="题材">
              <el-select
                v-model="form.genre"
                clearable
                placeholder="选择题材"
                style="width: 100%"
                @change="$emit('change')"
              >
                <el-option v-for="g in GENRE_OPTIONS" :key="g" :label="g" :value="g" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="小说简介">
          <el-input
            v-model="form.summary"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="简要介绍故事背景与主线"
            @input="$emit('change')"
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="目标读者">
              <el-select
                v-model="form.target_audience"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择读者群"
                style="width: 100%"
                @change="$emit('change')"
              >
                <el-option
                  v-for="a in TARGET_AUDIENCE_OPTIONS"
                  :key="a"
                  :label="a"
                  :value="a"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="更新节奏">
              <el-select
                v-model="form.update_cadence"
                clearable
                placeholder="计划更新频率"
                style="width: 100%"
                @change="$emit('change')"
              >
                <el-option
                  v-for="c in UPDATE_CADENCE_OPTIONS"
                  :key="c"
                  :label="c"
                  :value="c"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :xs="24" :sm="12">
            <el-form-item label="作者">
              <el-input v-model="form.author_name" placeholder="可选" @input="$emit('change')" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="封面 URL">
              <el-input v-model="form.cover_url" placeholder="可选" @input="$emit('change')" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </div>

    <aside class="novel-step-basic__preview novel-parchment-card">
      <h3 class="novel-parchment-card__title">核心立意预览</h3>
      <p class="novel-preview-title">{{ form.title || '尚未命名' }}</p>
      <div class="novel-preview-tags">
        <el-tag v-if="form.genre" size="small">{{ form.genre }}</el-tag>
        <el-tag v-if="form.novel_type" size="small" type="warning" effect="plain">{{ form.novel_type }}</el-tag>
        <el-tag v-if="form.update_cadence" size="small" type="info" effect="plain">{{ form.update_cadence }}</el-tag>
      </div>
      <p class="novel-preview-intent">{{ form.creative_intent || '填写创作立意后在此预览…' }}</p>
      <p class="novel-preview-summary">{{ form.summary || '简介将显示在这里…' }}</p>
      <div v-if="form.target_audience?.length" class="novel-preview-audience">
        <span class="novel-preview-audience__label">目标读者</span>
        <el-tag
          v-for="a in form.target_audience"
          :key="a"
          size="small"
          effect="plain"
        >
          {{ a }}
        </el-tag>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  GENRE_OPTIONS,
  NOVEL_TYPE_OPTIONS,
  TARGET_AUDIENCE_OPTIONS,
  UPDATE_CADENCE_OPTIONS,
} from '../../../utils/novelMeta.js';

defineProps({
  form: { type: Object, required: true },
});

defineEmits(['change']);

const formRef = ref(null);

async function validate() {
  return formRef.value?.validate().catch(() => false);
}

defineExpose({ validate });
</script>

<style scoped>
.novel-step-basic {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 20px;
  align-items: start;
}

.novel-magic-form {
  padding: 20px;
  background: var(--novel-color-parchment);
  border: var(--novel-border-gold);
  border-radius: var(--novel-radius-base);
}

.novel-parchment-card {
  padding: 20px;
  background: var(--novel-color-parchment);
  border: var(--novel-border-gold);
  border-radius: var(--novel-radius-base);
  box-shadow: var(--novel-shadow-glow);
  position: sticky;
  top: 8px;
}

.novel-parchment-card__title {
  margin: 0 0 16px;
  font-size: 16px;
  color: var(--novel-color-accent);
}

.novel-preview-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 700;
  color: var(--novel-color-deep);
}

.novel-preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.novel-preview-intent {
  margin: 0 0 12px;
  padding: 12px;
  border-left: 3px solid var(--novel-color-primary);
  background: var(--novel-color-primary-muted);
  color: var(--novel-color-text);
  line-height: 1.6;
  font-style: italic;
}

.novel-preview-summary {
  margin: 0 0 16px;
  color: var(--novel-color-text-secondary);
  line-height: 1.6;
  font-size: 14px;
}

.novel-preview-audience {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.novel-preview-audience__label {
  font-size: 13px;
  color: var(--novel-color-moon);
  margin-right: 4px;
}

@media (max-width: 960px) {
  .novel-step-basic {
    grid-template-columns: 1fr;
  }

  .novel-parchment-card {
    position: static;
  }
}
</style>
