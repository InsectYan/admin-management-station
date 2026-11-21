<template>
  <PageShell title="音轨" :loading="loading">
    <template #extra>
      <el-button type="primary" @click="openExtract">视频抽离</el-button>
    </template>
    <p class="cartoon-module__hint">音色来自音色库注入，或从导入视频里抽出的音轨。</p>
    <div class="cartoon-toolbar">
      <el-select v-model="source" clearable placeholder="来源类型" style="width: 160px" @change="page = 1">
        <el-option label="注入" value="inject" />
        <el-option label="视频抽离" value="extract" />
      </el-select>
      <el-input v-model="keyword" clearable placeholder="搜索音色" style="width: 220px" @input="page = 1" />
    </div>
    <el-empty v-if="!filtered.length" description="还没有音色" />
    <template v-else>
      <el-table :data="pageRows">
        <el-table-column prop="name" label="音色" min-width="180" fixed="left" />
        <el-table-column label="来源" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="row.source === 'extract' ? 'success' : 'info'">{{ sourceLabel(row.source) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="folder" label="分组" min-width="140" show-overflow-tooltip />
        <el-table-column prop="ext" label="格式" width="90" />
        <el-table-column label="试听" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="play(row)">播放</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        class="cartoon-pager"
        :page-sizes="PAGE_SIZES"
        :total="filtered.length"
        :layout="PAGER_LAYOUT"
        background
        @size-change="page = 1"
      />
      <audio ref="audio" class="cartoon-track-player" controls></audio>
    </template>

    <el-drawer v-model="drawerOpen" title="视频抽离" size="480px" append-to-body>
      <p class="cartoon-module__hint">导入一条视频，抽出音轨后保存成音色。视频不超过 64MB。</p>
      <el-form label-position="top">
        <el-form-item label="音色名称">
          <el-input v-model="form.name" placeholder="留空则使用视频文件名" />
        </el-form-item>
        <el-form-item label="视频">
          <el-upload
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            accept="video/mp4,video/webm,video/quicktime,.mov"
            :on-change="onPick"
          >
            <el-button type="primary" plain>{{ form.filename || '选择视频' }}</el-button>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="drawerOpen = false">取消</el-button>
        <el-button type="primary" :disabled="!form.file" :loading="saving" @click="extract">抽离并保存</el-button>
      </template>
    </el-drawer>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { useRegionLoad } from '../lib/useRegionLoad.js';
import { PAGE_SIZES, PAGER_LAYOUT } from '../lib/pager.js';
import { request, resolveApiBase } from '../services/apiConfig.js';

const rows = ref([]);
const source = ref('');
const keyword = ref('');
const page = ref(1);
const pageSize = ref(10);
const audio = ref(null);
const drawerOpen = ref(false);
const saving = ref(false);
const form = reactive({ name: '', filename: '', file: null });
const { loading, run } = useRegionLoad({ immediate: true });

const filtered = computed(() => rows.value.filter(item => {
  if (source.value && item.source !== source.value) return false;
  const text = keyword.value.trim();
  if (text && !String(item.name || '').includes(text)) return false;
  return true;
}));
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filtered.value.slice(start, start + pageSize.value);
});

function sourceLabel(value) {
  return value === 'extract' ? '视频抽离' : '注入';
}
function openExtract() {
  form.name = '';
  form.filename = '';
  form.file = null;
  drawerOpen.value = true;
}
function onPick(uploadFile) {
  const file = uploadFile?.raw;
  if (!file) return;
  form.file = file;
  form.filename = file.name;
  if (!form.name) form.name = file.name.replace(/\.[^.]+$/, '');
}
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取视频失败'));
    reader.readAsDataURL(file);
  });
}
function play(row) {
  const node = audio.value;
  if (!node) return;
  node.src = `${resolveApiBase()}/voice-library/file?id=${encodeURIComponent(row.id)}`;
  node.play().catch(() => {});
}
async function load() {
  await run(async () => {
    try {
      const data = await request('/voice-library');
      rows.value = data?.rows || [];
    } catch (err) {
      rows.value = [];
      ElMessage.error(err.message || '音色库没有打开');
    }
  });
}
async function extract() {
  if (!form.file) return;
  saving.value = true;
  try {
    const data = await readFile(form.file);
    const saved = await request('/voice-library/extract', {
      method: 'post',
      data: { filename: form.filename, name: form.name, data },
      timeout: 120000,
    });
    drawerOpen.value = false;
    ElMessage.success(saved?.name ? `已保存音色「${saved.name}」` : '已保存音色');
    source.value = 'extract';
    page.value = 1;
    await load();
  } catch (err) {
    ElMessage.error(err.message || '没有抽出音轨');
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>

<style scoped>
.cartoon-track-player {
  display: block;
  width: min(480px, 100%);
  margin-top: 12px;
}
</style>
