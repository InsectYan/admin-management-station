<template>
  <div class="cartoon-asset-image">
    <el-upload
      v-model:file-list="fileList"
      list-type="picture"
      :multiple="multiple"
      :limit="multiple ? 8 : 1"
      accept="image/png,image/jpeg,image/webp"
      :auto-upload="false"
      :on-change="onChange"
      :on-remove="onRemove"
      :on-exceed="onExceed"
    >
      <el-button>上传图片</el-button>
    </el-upload>
    <p v-if="legacy" class="cartoon-module__hint">已有地址：{{ legacy }}</p>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { request, resolveApiBase } from '../services/apiConfig.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  projectId: { type: [ String, Number ], required: true },
  multiple: { type: Boolean, default: false },
});
const emit = defineEmits([ 'update:modelValue' ]);

const fileList = ref([]);

const legacy = computed(() => {
  const text = String(props.modelValue || '').trim();
  if (!text) return '';
  const paths = text.split('\n').map(item => item.trim()).filter(Boolean);
  const old = paths.filter(item => !item.startsWith('/projects/'));
  return old.join('，');
});

function storedPaths(value) {
  return String(value || '').split('\n').map(item => item.trim()).filter(item => item.startsWith('/projects/'));
}

function syncFromModel(value) {
  fileList.value = storedPaths(value).map((item, index) => ({
    name: item.split('/').pop(),
    url: `${resolveApiBase()}${item}`,
    path: item,
    status: 'success',
    uid: `${item}-${index}`,
  }));
}

function emitPaths(list) {
  const paths = (list || fileList.value).map(item => item.path).filter(Boolean);
  const next = props.multiple ? paths.join('\n') : (paths[0] || '');
  const kept = String(props.modelValue || '').split('\n').map(item => item.trim()).filter(item => item && !item.startsWith('/projects/'));
  const merged = [ ...paths, ...kept ];
  emit('update:modelValue', props.multiple ? merged.join('\n') : (merged[0] || next));
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, data_base64: String(reader.result || '') });
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

async function onChange(uploadFile) {
  if (!uploadFile?.raw || uploadFile.path) return;
  try {
    const body = await readFile(uploadFile.raw);
    const saved = await request(`/projects/${props.projectId}/asset-files`, { method: 'post', data: body });
    uploadFile.url = `${resolveApiBase()}${saved.path}`;
    uploadFile.path = saved.path;
    emitPaths(fileList.value);
  } catch (err) {
    ElMessage.error(err.message || '上传失败');
    fileList.value = fileList.value.filter(item => item.uid !== uploadFile.uid);
  }
}

function onRemove() {
  emitPaths(fileList.value);
}

function onExceed(files) {
  if (props.multiple || !files?.[0]) return;
  fileList.value = [];
  const file = files[0];
  fileList.value = [{
    name: file.name,
    url: URL.createObjectURL(file),
    status: 'ready',
    uid: Date.now(),
    raw: file,
  }];
  onChange(fileList.value[0]);
}

watch(() => props.modelValue, (value) => {
  const current = fileList.value.map(item => item.path).filter(Boolean).join('\n');
  if (current !== storedPaths(value).join('\n')) syncFromModel(value);
}, { immediate: true });
</script>

<style scoped>
.cartoon-asset-image { width: 100%; max-width: 360px; }
.cartoon-asset-image :deep(.el-upload-list--picture .el-upload-list__item) {
  border-radius: 10px;
  border-color: rgba(47, 138, 91, 0.16);
}
</style>
