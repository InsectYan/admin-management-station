<template>
  <div class="cartoon-panel">
    <h3 class="cartoon-module__title">导出规格</h3>
    <p class="cartoon-module__hint">有成片时按规格重新编码，不改原来的成片。分镜里有台词时，横屏、竖屏、平板、短版和长版会烧进画面。无字幕不烧录，多语种写外挂字幕。长版会混入未停用的背景音乐，没有音乐文件时保留原声。运维打开 AI 标识时，成片右上角会写上「AI生成」，文件信息里也会写上「AI生成」。</p>
    <el-form inline>
      <el-select v-model="preset" style="width: 160px">
        <el-option v-for="item in presets" :key="item.id" :label="item.label" :value="item.id" />
      </el-select>
      <el-input v-if="preset === 'multi_lang'" v-model="lang" placeholder="语言，例如 中文、英语" style="width: 220px" />
      <el-button type="primary" :disabled="!canMake()" @click="save">导出此规格</el-button>
    </el-form>
    <el-empty v-if="loaded && !rows.length" description="还没有登记规格" />
    <el-table v-else-if="rows.length" :data="rows" size="small">
      <el-table-column label="规格" width="120">
        <template #default="{ row }">{{ presetLabel(row.preset) }}</template>
      </el-table-column>
      <el-table-column label="尺寸" width="140">
        <template #default="{ row }">{{ row.width }}×{{ row.height }}</template>
      </el-table-column>
      <el-table-column prop="subtitle_mode" label="字幕" width="100" />
      <el-table-column prop="status" label="状态" width="120" />
      <el-table-column label="文件">
        <template #default="{ row }">
          <a v-if="row.file_path" :href="fileUrl(row.id)">下载</a>
          <span v-else>{{ row.error_message || '—' }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
});
const presets = ref([]);
const rows = ref([]);
const preset = ref('landscape');
const lang = ref('');
const loaded = ref(false);

function presetLabel(id) {
  return presets.value.find(item => item.id === id)?.label || id;
}
function fileUrl(id) {
  return `${resolveApiBase()}/export-specs/${id}/file`;
}

async function load() {
  const data = await request(`/projects/${props.projectId}/export-specs`);
  presets.value = data.presets || [];
  rows.value = data.rows || [];
  loaded.value = true;
}

async function save() {
  try {
    await request(`/projects/${props.projectId}/export-specs`, {
      method: 'post',
      data: { preset: preset.value, lang: lang.value },
    });
    lang.value = '';
    await load();
    ElMessage.success('已按规格处理');
  } catch (err) {
    ElMessage.error(err.message);
  }
}

onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>
