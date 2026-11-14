<template>
  <section class="cartoon-module" :class="{ 'cartoon-workbench__note': variant === 'full' }">
    <div v-if="variant === 'editor'" class="cartoon-refmod-editor">
      <p class="cartoon-module__hint">一个资产一份图集，每张图写一句说明，例如「正面脸」「这套服装」。镜头绑上这个资产后，可以再勾掉这镜不用的图。</p>
      <p v-if="!assetId && !draft.length" class="cartoon-module__hint">可以先选图并写说明，创建资产时一起保存。</p>
      <div v-for="(item, index) in draft" :key="item.key" class="cartoon-refmod-row">
        <el-image
          :src="item.url"
          fit="cover"
          :preview-src-list="draft.map(row => row.url)"
          :initial-index="index"
          preview-teleported
          hide-on-click-modal
        />
        <el-input v-model="item.note" maxlength="80" placeholder="这张图的说明，例如正面脸、侧面、这套服装" />
        <el-button link type="danger" @click="dropItem(item)">移除</el-button>
      </div>
      <el-upload
        v-if="draft.length < 8"
        action="#"
        accept="image/png,image/jpeg,image/webp"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="addDraft"
      >
        <el-button>{{ draft.length ? '追加图片' : '选择图片' }}</el-button>
      </el-upload>
    </div>
    <template v-if="variant !== 'cards' && variant !== 'editor'">
    <h3 v-if="variant === 'full'" class="cartoon-module__title">RefMod</h3>
    <p class="cartoon-module__hint">RefMod 必须绑在已保存的角色、场景或道具上。一个资产一份，放 1 到 8 张清晰图。导出的 JSON 只是这些图的访问清单，生成时不读这个文件。</p>
    <el-form label-position="top" class="cartoon-refmod-form" @submit.prevent>
      <p v-if="assetId" class="cartoon-module__hint">绑定到{{ kindLabel(assetKind) }}「{{ assetName || '未命名' }}」</p>
      <p v-else class="cartoon-module__hint">先在表格里点选已保存的角色、场景或道具，再新增 RefMod。</p>
      <template v-if="assetId">
      <el-form-item label="参考图">
        <el-upload
          v-model:file-list="fileList"
          list-type="picture"
          multiple
          :limit="8"
          accept="image/png,image/jpeg,image/webp"
          :auto-upload="false"
        >
          <el-button>选择图片</el-button>
        </el-upload>
      </el-form-item>
      <el-button type="primary" :loading="saving" @click="create">保存</el-button>
      </template>
    </el-form>
    </template>
    <template v-if="variant !== 'editor'">
    <p v-if="variant !== 'form' && !assetId" class="cartoon-module__hint">点选角色、场景或道具后，这里显示它的 RefMod。</p>
    <p v-else-if="variant !== 'form' && !visualAsset" class="cartoon-module__hint">这个类型不用 RefMod。</p>
    <p v-else-if="variant !== 'form' && !shownPacks.length" class="cartoon-module__hint">「{{ assetName || '这个资产' }}」还没有 RefMod。</p>
    <article v-for="pack in shownPacks" :key="pack.id" class="cartoon-refmod-card">
      <MediaFileList
        v-if="pack.cover"
        :show-name="false"
        :items="[{ id: pack.id, url: fileUrl(pack), kind: 'image', name: pack.name }]"
        @remove="remove(pack)"
      />
      <div>
        <strong>{{ pack.asset_name || pack.name }}</strong>
        <p>{{ pack.asset_id ? `已绑定${kindLabel(pack.asset_kind || pack.kind)}` : '未绑定，生成时不会用到' }} · {{ pack.image_count }} 张参考图</p>
        <el-button link type="primary" @click="exportPack(pack)">导出</el-button>
        <el-button v-if="!pack.cover" link type="danger" @click="remove(pack)">删除</el-button>
      </div>
    </article>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import MediaFileList from './MediaFileList.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { useRegionLoad } from '../lib/useRegionLoad.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
  variant: { type: String, default: 'full' },
  revision: { type: Number, default: 0 },
  assetId: { type: [ String, Number ], default: '' },
  assetName: { type: String, default: '' },
  assetKind: { type: String, default: '' },
});
const emit = defineEmits([ 'changed' ]);
const { run: runRegionLoad } = useRegionLoad();

const fileList = ref([]);
const packs = ref([]);
const saving = ref(false);
const draft = ref([]);
const removed = ref([]);
const visualAsset = computed(() => [ 'character', 'scene', 'prop' ].includes(props.assetKind));
const shownPacks = computed(() => {
  if (props.variant === 'form' || !props.assetId || !visualAsset.value) return [];
  return packs.value.filter(pack => String(pack.asset_id) === String(props.assetId));
});

function kindLabel(kind) {
  return { character: '角色', scene: '场景', prop: '道具' }[kind] || '资产';
}

function fileUrl(pack, name = pack.cover) {
  return `${resolveApiBase()}/projects/${props.projectId}/refmods/${pack.id}/files/${encodeURIComponent(name)}`;
}

function exportPack(pack) {
  const names = pack.images?.length ? pack.images : [ pack.cover ].filter(Boolean);
  const payload = {
    asset_id: pack.asset_id || null,
    name: pack.asset_name || pack.name,
    kind: kindLabel(pack.asset_kind || pack.kind),
    images: names.map(item => fileUrl(pack, item)),
  };
  const blob = new Blob([ JSON.stringify(payload, null, 2) ], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${pack.name || 'refmod'}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function currentPack() {
  if (!props.assetId) return null;
  return packs.value.find(pack => String(pack.asset_id) === String(props.assetId)) || null;
}
function fillDraft() {
  const pack = currentPack();
  removed.value = [];
  if (!pack) {
    draft.value = draft.value.filter(item => !item.saved);
    return;
  }
  const pending = draft.value.filter(item => !item.saved);
  draft.value = (pack.images || []).map(name => ({
    key: name,
    name,
    note: pack.notes?.[name] || '',
    url: fileUrl(pack, name),
    saved: true,
  })).concat(pending);
}
function addDraft(uploadFile) {
  const raw = uploadFile?.raw;
  if (!raw) return;
  if (draft.value.length >= 8) {
    ElMessage.warning('一个包最多 8 张图');
    return;
  }
  draft.value.push({
    key: `${Date.now()}-${draft.value.length}`,
    name: '',
    note: '',
    url: URL.createObjectURL(raw),
    raw,
    saved: false,
  });
}
function dropItem(item) {
  draft.value = draft.value.filter(row => row.key !== item.key);
  if (item.saved && item.name) removed.value.push(item.name);
}
async function flush(assetId) {
  const id = Number(assetId || props.assetId);
  if (!id) return null;
  if (!draft.value.length && !currentPack()) return null;
  if (!draft.value.length) {
    throw new Error('至少留一张参考图');
  }
  const news = [];
  for (const item of draft.value.filter(row => !row.saved && row.raw)) {
    news.push({ ...(await readFile(item.raw)), note: item.note || '' });
  }
  const pack = currentPack();
  if (!pack) {
    if (!news.length) return null;
    const created = await request(`/projects/${props.projectId}/refmods`, {
      method: 'post',
      data: { asset_id: id, images: news },
    });
    draft.value = [];
    removed.value = [];
    await load();
    emit('changed');
    return created;
  }
  const notes = {};
  draft.value.filter(item => item.saved && item.name).forEach(item => {
    notes[item.name] = item.note || '';
  });
  const saved = await request(`/projects/${props.projectId}/refmods/${pack.id}`, {
    method: 'put',
    data: { notes, remove: removed.value, images: news },
  });
  draft.value = draft.value.filter(item => item.saved && !removed.value.includes(item.name));
  removed.value = [];
  await load();
  emit('changed');
  return saved;
}
function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, data_base64: String(reader.result || '') });
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

async function load(mask = false) {
  const pull = async () => {
    packs.value = await request(`/projects/${props.projectId}/refmods`) || [];
    if (props.variant === 'editor') fillDraft();
  };
  if (mask) await runRegionLoad(pull);
  else await pull();
}

async function create() {
  if (!props.assetId) {
    ElMessage.warning('先在表格里点选已保存的角色、场景或道具');
    return;
  }
  const files = fileList.value.map(item => item.raw).filter(Boolean);
  if (!files.length) {
    ElMessage.warning('请至少上传一张图片');
    return;
  }
  saving.value = true;
  try {
    const images = [];
    for (const file of files) images.push(await readFile(file));
    await request(`/projects/${props.projectId}/refmods`, {
      method: 'post',
      data: { asset_id: Number(props.assetId), images },
    });
    fileList.value = [];
    ElMessage.success('已绑到这个资产，可以导出访问清单');
    await load();
    emit('changed');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}

async function remove(pack) {
  await ElMessageBox.confirm(`删除「${pack.name}」？`, '删除 RefMod 包', { type: 'warning' });
  await request(`/projects/${props.projectId}/refmods/${pack.id}`, { method: 'delete' });
  await load();
  emit('changed');
}

watch(() => props.projectId, () => { load(true).catch(err => ElMessage.error(err.message)); });
watch(() => props.revision, () => { load(true).catch(err => ElMessage.error(err.message)); });
watch(() => props.assetId, () => {
  fileList.value = [];
  draft.value = [];
  removed.value = [];
  if (props.variant === 'editor') fillDraft();
});
onMounted(() => { load(true).catch(err => ElMessage.error(err.message)); });
defineExpose({ flush });
</script>

<style scoped>
.cartoon-refmod-form { max-width: 520px; }
.cartoon-refmod-card { display: flex; gap: 12px; align-items: center; margin-top: 12px; }
.cartoon-refmod-card p { margin: 4px 0 0; color: #5c6b62; }
.cartoon-refmod-row { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
.cartoon-refmod-row .el-image,
.cartoon-refmod-row img { width: 72px; height: 72px; border-radius: 6px; background: #eef3ef; cursor: zoom-in; }
.cartoon-refmod-row .el-input { flex: 1; }
</style>
