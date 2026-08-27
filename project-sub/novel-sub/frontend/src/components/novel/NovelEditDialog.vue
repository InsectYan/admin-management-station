<template>
  <el-dialog
    :model-value="visible"
    title="编辑小说"
    width="560px"
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
          <el-form-item label="题材" prop="genre">
            <el-select v-model="form.genre" clearable placeholder="选择题材" style="width: 100%">
              <el-option v-for="g in GENRE_OPTIONS" :key="g" :label="g" :value="g" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="小说类型" prop="novel_type">
            <el-select v-model="form.novel_type" clearable placeholder="选择类型" style="width: 100%">
              <el-option v-for="t in NOVEL_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
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
import {
  GENRE_OPTIONS, NOVEL_TYPE_OPTIONS, PROGRESS_OPTIONS,
} from '../../utils/novelMeta.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  novel: { type: Object, default: null },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'submit']);

const formRef = ref(null);

const form = reactive({
  title: '',
  author_name: '',
  cover_url: '',
  genre: '',
  novel_type: '',
  progress_status: 'ongoing',
  progress_percent: 0,
  summary: '',
  status: 'draft',
});

function resetForm(novel) {
  Object.assign(form, {
    title: novel?.title || '',
    author_name: novel?.author_name || '',
    cover_url: novel?.cover_url || '',
    genre: novel?.genre || '',
    novel_type: novel?.novel_type || '',
    progress_status: novel?.progress_status || 'ongoing',
    progress_percent: novel?.progress_percent ?? 0,
    summary: novel?.summary || '',
    status: novel?.status || 'draft',
  });
}

watch(() => [props.visible, props.novel], () => {
  if (props.visible) resetForm(props.novel);
}, { immediate: true });

async function handleSubmit() {
  if (!props.novel?.id) return;
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  emit('submit', { ...form });
}
</script>
