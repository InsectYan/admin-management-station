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
              <el-cascader
                v-model="form.genre_path"
                :options="genreCascaderOptions"
                :props="genreCascaderProps"
                clearable
                filterable
                placeholder="选择一级 / 二级分类"
                style="width: 100%"
                @change="onGenreChange"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="篇幅">
              <el-select
                v-model="form.length_id"
                clearable
                placeholder="选择篇幅"
                style="width: 100%"
                @change="$emit('change')"
              >
                <el-option
                  v-for="item in enums.lengths"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                >
                  <span>{{ item.name }}</span>
                  <span class="novel-enum-hint">{{ item.description }}</span>
                </el-option>
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="题材">
          <el-select
            v-model="form.theme_ids"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="搜索并选择题材标签"
            style="width: 100%"
            @change="$emit('change')"
          >
            <el-option
              v-for="item in enums.themes"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>

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
                v-model="form.audience_id"
                clearable
                filterable
                placeholder="性别-年龄层-偏好"
                style="width: 100%"
                @change="$emit('change')"
              >
                <el-option
                  v-for="item in enums.audiences"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="更新节奏">
              <el-select
                v-model="form.update_pace_id"
                clearable
                placeholder="计划更新频率"
                style="width: 100%"
                @change="$emit('change')"
              >
                <el-option
                  v-for="item in enums.update_paces"
                  :key="item.id"
                  :label="item.name"
                  :value="item.id"
                >
                  <span>{{ item.name }}</span>
                  <span class="novel-enum-hint">{{ item.description }}</span>
                </el-option>
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
        <el-tag v-if="genreLabel" size="small">{{ genreLabel }}</el-tag>
        <el-tag v-if="lengthLabel" size="small" type="warning" effect="plain">{{ lengthLabel }}</el-tag>
        <el-tag v-if="paceLabel" size="small" type="info" effect="plain">{{ paceLabel }}</el-tag>
      </div>
      <NovelMarkdown
        class="novel-preview-intent"
        compact
        :source="form.creative_intent"
        empty-text="填写创作立意后在此预览…"
      />
      <NovelMarkdown
        class="novel-preview-summary"
        compact
        :source="form.summary"
        empty-text="简介将显示在这里…"
      />
      <div v-if="themeLabels.length" class="novel-preview-audience">
        <span class="novel-preview-audience__label">题材</span>
        <el-tag v-for="name in themeLabels" :key="name" size="small" effect="plain">{{ name }}</el-tag>
      </div>
      <div v-if="audienceLabel" class="novel-preview-audience">
        <span class="novel-preview-audience__label">目标读者</span>
        <el-tag size="small" effect="plain">{{ audienceLabel }}</el-tag>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import NovelMarkdown from '../markdown/NovelMarkdown.vue';
import { useNovelEnums, applyGenrePath } from '../../../composables/useNovelEnums.js';

const props = defineProps({
  form: { type: Object, required: true },
});

const emit = defineEmits(['change']);

const { enums, load, genreCascaderOptions } = useNovelEnums();
const genreCascaderProps = { checkStrictly: true, emitPath: true, expandTrigger: 'hover' };
const formRef = ref(null);

onMounted(() => {
  load();
});

function onGenreChange(path) {
  applyGenrePath(props.form, path || []);
  emit('change');
}

const genreLabel = computed(() => {
  const [catId, subId] = props.form.genre_path || [];
  const cat = enums.value.genres.find((item) => item.id === catId);
  const sub = cat?.children?.find((item) => item.id === subId);
  return [cat?.name, sub?.name].filter(Boolean).join(' / ');
});

const lengthLabel = computed(() => (
  enums.value.lengths.find((item) => item.id === props.form.length_id)?.name || ''
));

const paceLabel = computed(() => (
  enums.value.update_paces.find((item) => item.id === props.form.update_pace_id)?.name || ''
));

const audienceLabel = computed(() => (
  enums.value.audiences.find((item) => item.id === props.form.audience_id)?.name || ''
));

const themeLabels = computed(() => {
  const ids = new Set(props.form.theme_ids || []);
  return enums.value.themes.filter((item) => ids.has(item.id)).map((item) => item.name);
});

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

.novel-enum-hint {
  float: right;
  margin-left: 12px;
  font-size: 12px;
  color: var(--novel-color-text-muted, #8a968e);
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
