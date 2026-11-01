<template>
  <PageShell title="RefMod 包检测">
    <div class="precheck-module">
      <p class="precheck-module__hint">这里只检测包能不能挂上工作流，不按项目保存。正式的人物包和场景包放到 AI 视频对应项目里。一个包对应一个人物或一个场景，放 4 到 8 张清晰图。生成时按选择顺序变成 &lt;Picture 1&gt; 起，一次最多 9 张。</p>
      <el-form label-position="top" class="precheck-refmod-form" @submit.prevent>
        <el-form-item label="类型">
          <el-radio-group v-model="kind">
            <el-radio-button value="character">人物</el-radio-button>
            <el-radio-button value="scene">场景</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="kind === 'scene' ? '场景名称' : '人物名称'">
          <el-input v-model="name" :placeholder="kind === 'scene' ? '例如：林家客厅' : '例如：林夏'" />
        </el-form-item>
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
        <el-button type="primary" :loading="saving" @click="create">保存检测包</el-button>
      </el-form>
    </div>
    <div class="precheck-module precheck-refmod-list">
      <p v-if="!packs.length" class="precheck-module__hint">还没有检测包。</p>
      <article v-for="pack in packs" :key="pack.id" class="precheck-refmod-card">
        <MediaFileList
          v-if="pack.cover"
          :show-name="false"
          :items="[{ id: pack.id, url: fileUrl(pack), kind: 'image', name: pack.name }]"
          @remove="remove(pack)"
        />
        <div>
          <strong>{{ pack.name }}</strong>
          <p>{{ pack.kind === 'scene' ? '场景' : '人物' }} · {{ pack.image_count }} 张参考图</p>
          <el-button v-if="!pack.cover" link type="danger" @click="remove(pack)">删除</el-button>
        </div>
      </article>
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import MediaFileList from '../components/MediaFileList.vue';
import PageShell from '../components/PageShell.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';

const name = ref('');
const kind = ref('character');
const fileList = ref([]);
const packs = ref([]);
const saving = ref(false);

function fileUrl(pack) {
  return `${resolveApiBase()}/refmods/${pack.id}/files/${encodeURIComponent(pack.cover)}`;
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
  packs.value = await request('/refmods') || [];
}

async function create() {
  if (!name.value.trim()) {
    ElMessage.warning(kind.value === 'scene' ? '请填写场景名称' : '请填写人物名称');
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
    await request('/refmods', { method: 'post', data: { name: name.value.trim(), kind: kind.value, images } });
    name.value = '';
    fileList.value = [];
    ElMessage.success('已保存检测包');
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}

async function remove(pack) {
  await ElMessageBox.confirm(`删除检测包「${pack.name}」？`, '删除检测包', { type: 'warning' });
  await request(`/refmods/${pack.id}`, { method: 'delete' });
  await load();
}

onMounted(load);
</script>

<style scoped>
.precheck-refmod-form { max-width: 520px; }
.precheck-refmod-list { margin-top: 16px; display: grid; gap: 12px; }
.precheck-refmod-card { display: flex; gap: 12px; align-items: center; }
.precheck-refmod-card p { margin: 4px 0 0; color: #5c6b62; }
</style>
