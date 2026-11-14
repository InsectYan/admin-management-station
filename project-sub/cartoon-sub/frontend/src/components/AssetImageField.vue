<template>
  <div class="cartoon-asset-image">
    <div v-if="fileList.length" class="cartoon-asset-image__grid">
      <figure v-for="(item, index) in fileList" :key="item.uid" class="cartoon-asset-image__item">
        <el-image
          :src="item.url"
          fit="cover"
          :preview-src-list="previewUrls"
          :initial-index="index"
          preview-teleported
          hide-on-click-modal
        />
        <el-button link type="danger" @click="removeAt(index)">移除</el-button>
      </figure>
    </div>
    <el-upload
      :show-file-list="false"
      :multiple="multiple"
      :limit="multiple ? 8 : 1"
      accept="image/png,image/jpeg,image/webp"
      :auto-upload="false"
      :on-change="onChange"
      :on-exceed="onExceed"
    >
      <el-button>{{ fileList.length && !multiple ? '更换图片' : '上传图片' }}</el-button>
    </el-upload>
    <p v-if="legacy" class="cartoon-module__hint">已有地址：{{ legacy }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { getAccessToken } from '../lib/amsAuth.js';
import { request, resolveApiBase } from '../services/apiConfig.js';

const props = defineProps({
  modelValue: { type: String, default: '' },
  projectId: { type: [ String, Number ], required: true },
  multiple: { type: Boolean, default: false },
});
const emit = defineEmits([ 'update:modelValue' ]);

const fileList = ref([]);
const ownedUrls = new Set();

const legacy = computed(() => {
  const text = String(props.modelValue || '').trim();
  if (!text) return '';
  const paths = text.split('\n').map(item => item.trim()).filter(Boolean);
  const old = paths.filter(item => !item.startsWith('/projects/'));
  return old.join('，');
});

const previewUrls = computed(() => fileList.value.map(item => item.url).filter(Boolean));

function storedPaths(value) {
  return String(value || '').split('\n').map(item => item.trim()).filter(item => item.startsWith('/projects/'));
}

function rememberUrl(url) {
  if (String(url || '').startsWith('blob:')) ownedUrls.add(url);
  return url;
}

function releaseUrl(url) {
  if (!ownedUrls.has(url)) return;
  URL.revokeObjectURL(url);
  ownedUrls.delete(url);
}

async function previewUrl(path) {
  try {
    const token = getAccessToken();
    const res = await axios.get(`${resolveApiBase()}${path}`, {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = res.data;
    if (!(blob instanceof Blob) || String(blob.type || '').includes('json')) {
      return `${resolveApiBase()}${path}`;
    }
    return rememberUrl(URL.createObjectURL(blob));
  } catch {
    return `${resolveApiBase()}${path}`;
  }
}

async function syncFromModel(value) {
  const paths = storedPaths(value);
  const next = [];
  for (let index = 0; index < paths.length; index += 1) {
    const item = paths[index];
    const kept = fileList.value.find(row => row.path === item && row.url);
    next.push({
      name: item.split('/').pop(),
      url: kept?.url || await previewUrl(item),
      path: item,
      uid: `${item}-${index}`,
    });
  }
  fileList.value.forEach(item => {
    if (!next.some(row => row.url === item.url)) releaseUrl(item.url);
  });
  fileList.value = next;
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
  if (!uploadFile?.raw) return;
  try {
    const body = await readFile(uploadFile.raw);
    const saved = await request(`/projects/${props.projectId}/asset-files`, { method: 'post', data: body });
    const row = {
      name: saved.path.split('/').pop(),
      url: rememberUrl(URL.createObjectURL(uploadFile.raw)),
      path: saved.path,
      uid: `${saved.path}-${Date.now()}`,
    };
    const next = props.multiple ? fileList.value.concat(row).slice(0, 8) : [ row ];
    fileList.value.forEach(item => {
      if (!next.some(kept => kept.url === item.url)) releaseUrl(item.url);
    });
    fileList.value = next;
    emitPaths(fileList.value);
  } catch (err) {
    ElMessage.error(err.message || '上传失败');
  }
}

function removeAt(index) {
  const removed = fileList.value[index];
  fileList.value = fileList.value.filter((_, itemIndex) => itemIndex !== index);
  if (removed) releaseUrl(removed.url);
  emitPaths(fileList.value);
}

function onExceed(files) {
  if (props.multiple || !files?.[0]) return;
  onChange({ raw: files[0], name: files[0].name });
}

watch(() => props.modelValue, (value) => {
  const current = fileList.value.map(item => item.path).filter(Boolean).join('\n');
  if (current !== storedPaths(value).join('\n')) syncFromModel(value);
}, { immediate: true });

onBeforeUnmount(() => {
  ownedUrls.forEach(url => URL.revokeObjectURL(url));
  ownedUrls.clear();
});
</script>

<style scoped>
.cartoon-asset-image { width: 100%; max-width: 420px; }
.cartoon-asset-image__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.cartoon-asset-image__item { width: 96px; margin: 0; }
.cartoon-asset-image__item :deep(.el-image) {
  width: 96px;
  height: 96px;
  border-radius: 8px;
  border: 1px solid rgba(47, 138, 91, 0.16);
  background: #eef3ef;
  cursor: zoom-in;
}
</style>
