<template>
  <PageShell :title="page.title">
    <p class="cartoon-module__hint">{{ page.hint }}</p>
    <p v-if="route.name === 'assets'" class="cartoon-module__hint">
      <router-link v-for="item in assetLinks" :key="item.kind" :to="`/assets/${item.kind}`">{{ item.label }}</router-link>
    </p>
    <div v-if="route.name === 'assets'" class="cartoon-module">
      <h3 class="cartoon-module__title">共享资产</h3>
      <p class="cartoon-module__hint">改描述后，还没出画面的镜头跟着改。已经出过画面的镜头标成资产已更新，不会自动重跑。</p>
      <el-form label-position="top" class="cartoon-entry-form" @submit.prevent="createShared">
        <div class="cartoon-entry-grid">
          <el-form-item label="名称"><el-input v-model="shared.name" /></el-form-item>
          <el-form-item label="类型">
            <el-select v-model="shared.kind" style="width: 100%">
              <el-option label="角色" value="character" />
              <el-option label="场景" value="scene" />
              <el-option label="道具" value="prop" />
              <el-option label="配音" value="voice" />
              <el-option label="品牌" value="brand" />
            </el-select>
          </el-form-item>
          <el-form-item class="is-wide" label="描述">
            <el-input v-model="shared.description" type="textarea" :rows="2" />
          </el-form-item>
        </div>
        <div class="cartoon-entry-actions">
          <el-button type="primary" @click="createShared">登记</el-button>
        </div>
      </el-form>
    </div>
    <el-empty v-if="!rows.length" description="还没有记录" />
    <el-table v-else :data="rows">
      <el-table-column v-for="column in page.columns" :key="column.prop" :prop="column.prop" :label="column.label" />
      <el-table-column v-if="page.link" label="项目" width="140">
        <template #default="{ row }">
          <router-link :to="`/projects/${row.project_id || row.id}`">打开</router-link>
          <router-link v-if="route.name === 'reviews'" :to="`/reviews/${row.id}`">记录</router-link>
        </template>
      </el-table-column>
    </el-table>
  </PageShell>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';

const route = useRoute();
const rows = ref([]);
const shared = reactive({ name: '', kind: 'character', description: '' });
const assetLinks = [
  { kind: 'characters', label: '角色' },
  { kind: 'scenes', label: '场景' },
  { kind: 'props', label: '道具' },
  { kind: 'voices', label: '配音' },
  { kind: 'materials', label: '素材' },
  { kind: 'brands', label: '品牌' },
];
const titles = {
  characters: '角色',
  scenes: '场景',
  props: '道具',
  voices: '配音',
  materials: '素材',
  brands: '品牌',
};
const page = computed(() => {
  if (route.name === 'assets') {
    return {
      title: titles[route.params.kind] || '资产',
      hint: '按分类查看各项目登记的资产。素材包含背景音乐、音效、字幕样式和转场。品牌字体和视觉规范写在项目面板里。',
      api: `/library/assets/${route.params.kind}`,
      link: true,
      columns: [
        { prop: 'name', label: '名称' },
        { prop: 'project_name', label: '项目' },
        { prop: 'reference_path', label: '参考图' },
        { prop: 'voice_key', label: '音色' },
        { prop: 'prop_category', label: '道具分类' },
        { prop: 'voice_lang', label: '语种' },
        { prop: 'speaker_name', label: '发音人' },
        { prop: 'angle_paths', label: '多角度' },
        { prop: 'shared_label', label: '共享' },
      ],
    };
  }
  if (route.name === 'batches') {
    return {
      title: '批量',
      hint: '各项目的选题批次。推进仍在项目里进行。',
      api: '/library/batches',
      link: true,
      columns: [
        { prop: 'project_name', label: '项目' },
        { prop: 'status', label: '状态' },
        { prop: 'success_count', label: '成功' },
        { prop: 'failed_count', label: '失败' },
      ],
    };
  }
  if (route.name === 'reviews') {
    return {
      title: '审核',
      hint: '通过和驳回记录。处理仍回到对应项目。',
      api: '/library/reviews',
      link: true,
      columns: [
        { prop: 'project_name', label: '项目' },
        { prop: 'decision', label: '结果' },
        { prop: 'node', label: '节点' },
        { prop: 'note', label: '原因' },
      ],
    };
  }
  if (route.name === 'versions') {
    return {
      title: '版本',
      hint: '每个视频项目钉扎的故事包版本。旧项目保持未钉扎。',
      api: '/library/versions',
      link: true,
      columns: [
        { prop: 'name', label: '项目' },
        { prop: 'content_type', label: '类型' },
        { prop: 'pin_mode', label: '钉扎' },
        { prop: 'package_version', label: '版本' },
        { prop: 'stage_summary', label: '成片阶段' },
      ],
    };
  }
  return {
    title: '导出',
    hint: '已有成片工程，以及只登记、不重新编码的导出规格。',
    api: '/library/exports',
    link: true,
    columns: [
      { prop: 'project_name', label: '项目' },
      { prop: 'title', label: '成片' },
      { prop: 'status', label: '状态' },
      { prop: 'width', label: '宽' },
      { prop: 'height', label: '高' },
    ],
  };
});

async function createShared() {
  try {
    const row = await request('/library/shared', { method: 'post', data: { ...shared } });
    shared.name = '';
    shared.description = '';
    ElMessage.success(row?.id ? `已登记，编号 ${row.id}` : '已登记');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function load() {
  try {
    rows.value = await request(page.value.api) || [];
  } catch (err) {
    rows.value = [];
    ElMessage.error(err.message);
  }
}
watch(() => route.fullPath, () => {
  load();
}, { immediate: true });
</script>
