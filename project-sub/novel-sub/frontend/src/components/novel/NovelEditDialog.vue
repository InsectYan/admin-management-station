<template>
  <el-dialog
    :model-value="visible"
    title="编辑小说"
    width="640px"
    destroy-on-close
    @close="$emit('close')"
  >
    <el-form ref="formRef" :model="form" label-position="top">
      <el-form-item label="标题" prop="title" :rules="[{ required: true, message: '请输入标题' }]">
        <el-input v-model="form.title" maxlength="200" show-word-limit />
      </el-form-item>
      <el-form-item label="作者" prop="author_name">
        <el-input v-model="form.author_name" />
      </el-form-item>
      <el-form-item label="封面 URL" prop="cover_url">
        <el-input v-model="form.cover_url" placeholder="可选" />
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="小说类型" prop="genre_path">
            <el-cascader
              v-model="form.genre_path"
              :options="genreCascaderOptions"
              :props="genreCascaderProps"
              clearable
              filterable
              placeholder="一级 / 二级分类"
              style="width: 100%"
              @change="onGenreChange"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="篇幅" prop="length_id">
            <el-select v-model="form.length_id" clearable placeholder="选择篇幅" style="width: 100%">
              <el-option
                v-for="item in enums.lengths"
                :key="item.id"
                :label="item.name"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="题材" prop="theme_ids">
        <el-select
          v-model="form.theme_ids"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          placeholder="搜索题材"
          style="width: 100%"
        >
          <el-option
            v-for="item in enums.themes"
            :key="item.id"
            :label="item.name"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="进度状态" prop="progress_status">
            <el-select v-model="form.progress_status" style="width: 100%">
              <el-option v-for="p in PROGRESS_OPTIONS" :key="p.value" :label="p.label" :value="p.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="完成度 (%)" prop="progress_percent">
            <el-input-number v-model="form.progress_percent" :min="0" :max="100" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="简介" prop="summary">
        <el-input v-model="form.summary" type="textarea" :rows="4" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { PROGRESS_OPTIONS } from '../../utils/novelMeta.js';
import { useNovelEnums, applyGenrePath, genrePathFromNovel } from '../../composables/useNovelEnums.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  novel: { type: Object, default: null },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'submit']);

const formRef = ref(null);
const { enums, load, genreCascaderOptions } = useNovelEnums();
const genreCascaderProps = { checkStrictly: true, emitPath: true, expandTrigger: 'hover' };

const form = reactive({
  title: '',
  author_name: '',
  cover_url: '',
  genre_path: [],
  genre_category_id: null,
  genre_subcategory_id: null,
  length_id: null,
  theme_ids: [],
  progress_status: 'ongoing',
  progress_percent: 0,
  summary: '',
  status: 'draft',
});

function onGenreChange(path) {
  applyGenrePath(form, path || []);
}

function resetForm(novel) {
  Object.assign(form, {
    title: novel?.title || '',
    author_name: novel?.author_name || '',
    cover_url: novel?.cover_url || '',
    genre_path: genrePathFromNovel(novel),
    genre_category_id: novel?.genre_category_id || null,
    genre_subcategory_id: novel?.genre_subcategory_id || null,
    length_id: novel?.length_id || null,
    theme_ids: Array.isArray(novel?.theme_ids) ? [...novel.theme_ids] : [],
    progress_status: novel?.progress_status || 'ongoing',
    progress_percent: novel?.progress_percent ?? 0,
    summary: novel?.summary || '',
    status: novel?.status || 'draft',
  });
}

watch(() => [props.visible, props.novel], () => {
  if (props.visible) {
    load();
    resetForm(props.novel);
  }
}, { immediate: true });

async function handleSubmit() {
  if (!props.novel?.id) return;
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  const [categoryId, subcategoryId] = form.genre_path || [];
  emit('submit', {
    title: form.title,
    author_name: form.author_name,
    cover_url: form.cover_url,
    progress_status: form.progress_status,
    progress_percent: form.progress_percent,
    summary: form.summary,
    status: form.status,
    genre_category_id: categoryId || null,
    genre_subcategory_id: subcategoryId || null,
    length_id: form.length_id || null,
    theme_ids: form.theme_ids,
  });
}
</script>
