<template>
  <el-image
    v-if="url"
    class="cartoon-asset-thumb"
    :src="url"
    fit="cover"
    :preview-src-list="[url]"
    preview-teleported
    hide-on-click-modal
  />
  <span v-else class="cartoon-asset-thumb__empty">—</span>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import axios from 'axios';
import { getAccessToken } from '../lib/amsAuth.js';
import { resolveApiBase } from '../services/apiConfig.js';

const props = defineProps({
  path: { type: String, default: '' },
});

const url = ref('');
let owned = '';

function release() {
  if (!owned) return;
  URL.revokeObjectURL(owned);
  owned = '';
}

function firstPath(value) {
  return String(value || '')
    .split('\n')
    .map(item => item.trim())
    .find(item => item.startsWith('/projects/')) || '';
}

async function load(path) {
  release();
  url.value = '';
  if (!path) return;
  try {
    const token = getAccessToken();
    const res = await axios.get(`${resolveApiBase()}${path}`, {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = res.data;
    if (!(blob instanceof Blob) || String(blob.type || '').includes('json')) return;
    owned = URL.createObjectURL(blob);
    url.value = owned;
  } catch {
    url.value = '';
  }
}

watch(() => firstPath(props.path), load, { immediate: true });
onBeforeUnmount(release);
</script>

<style scoped>
.cartoon-asset-thumb {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  border: 1px solid rgba(47, 138, 91, 0.16);
  background: #eef3ef;
  cursor: zoom-in;
}
.cartoon-asset-thumb__empty { color: #8aa094; }
</style>
