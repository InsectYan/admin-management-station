<template>
  <section class="cartoon-module" :class="{ 'cartoon-workbench__note': variant === 'full' }">
    <template v-if="variant !== 'cards'">
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
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import MediaFileList from './MediaFileList.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
  variant: { type: String, default: 'full' },
  revision: { type: Number, default: 0 },
  assetId: { type: [ String, Number ], default: '' },
  assetName: { type: String, default: '' },
  assetKind: { type: String, default: '' },
});
const emit = defineEmits([ 'changed' ]);

const fileList = ref([]);
const packs = ref([]);
const saving = ref(false);
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

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, data_base64: String(reader.result || '') });
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

async function load() {
  packs.value = await request(`/projects/${props.projectId}/refmods`) || [];
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

watch(() => props.projectId, () => { load().catch(err => ElMessage.error(err.message)); });
watch(() => props.revision, () => { load().catch(err => ElMessage.error(err.message)); });
watch(() => props.assetId, () => { fileList.value = []; });
onMounted(() => { load().catch(err => ElMessage.error(err.message)); });
</script>

<style scoped>
.cartoon-refmod-form { max-width: 520px; }
.cartoon-refmod-card { display: flex; gap: 12px; align-items: center; margin-top: 12px; }
.cartoon-refmod-card p { margin: 4px 0 0; color: #5c6b62; }
</style>
