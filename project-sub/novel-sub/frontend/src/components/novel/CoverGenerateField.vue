<template>
  <div class="novel-cover-field">
    <div class="novel-cover-field__row">
      <el-input
        :model-value="form.cover_url"
        placeholder="封面 URL，或点右侧生成"
        @update:model-value="onUrlInput"
      />
      <el-button type="primary" plain :loading="loading" @click="onGenerate">
        AI 生成封面
      </el-button>
    </div>
    <p class="novel-cover-field__hint">使用侧栏「多模态」选中的图片模型，不会走文本 AI 模型。</p>
    <el-image
      v-if="form.cover_url"
      class="novel-cover-field__preview"
      :src="form.cover_url"
      fit="cover"
      :preview-src-list="[form.cover_url]"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { generateCover } from '../../services/novelService.js';

const props = defineProps({
  form: { type: Object, required: true },
});

const emit = defineEmits(['change']);

const loading = ref(false);

function onUrlInput(val) {
  props.form.cover_url = val;
  emit('change');
}

async function onGenerate() {
  if (!String(props.form.title || '').trim() && !String(props.form.cover_prompt || '').trim()) {
    ElMessage.warning('请先填写书名');
    return;
  }
  loading.value = true;
  try {
    const data = await generateCover({
      title: props.form.title,
      creative_intent: props.form.creative_intent,
      summary: props.form.summary,
      prompt: props.form.cover_prompt,
    });
    props.form.cover_url = data.cover_url;
    emit('change');
    ElMessage.success(data.media_label ? `已用 ${data.media_label} 生成封面` : '封面已生成');
  } catch (err) {
    ElMessage.error(err.message || '封面生成失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.novel-cover-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.novel-cover-field__row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.novel-cover-field__row :deep(.el-input) {
  flex: 1;
  min-width: 0;
}

.novel-cover-field__hint {
  margin: 0;
  font-size: 12px;
  color: var(--novel-color-moon, #6b7c72);
  line-height: 1.4;
}

.novel-cover-field__preview {
  width: 120px;
  height: 168px;
  border-radius: 6px;
  overflow: hidden;
  border: var(--novel-border-gold, 1px solid #d4b483);
  background: var(--novel-color-primary-muted, #eef6f1);
}
</style>
