<template>
  <PageShell title="小说列表">
    <template #extra>
      <el-button type="primary" :icon="Plus" @click="router.push({ name: 'novel-create' })">
        新建小说
      </el-button>
    </template>

    <div class="novel-filter-bar">
      <el-input
        v-model="filters.title"
        placeholder="输入小说名称"
        clearable
        style="width: 220px"
      />
      <el-select
        v-model="filters.status"
        placeholder="选择状态"
        clearable
        style="width: 140px"
      >
        <el-option
          v-for="opt in statusOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-button type="primary" @click="loadNovels">筛选</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="novels"
      row-key="id"
      empty-text="暂无小说，点击右上角新建"
    >
      <el-table-column prop="id" label="ID" width="72" />
      <el-table-column prop="title" label="小说名称" show-overflow-tooltip />
      <el-table-column prop="author_name" label="作者" width="120" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :class="statusMeta[row.status]?.className">
            {{ statusMeta[row.status]?.label || row.status || '-' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" width="160">
        <template #default="{ row }">
          <el-progress :percentage="row.progress || 0" :stroke-width="8" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push({ name: 'novel-detail', params: { id: row.id } })">
            查看
          </el-button>
          <el-button link type="danger" @click="handleDelete(row.id)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Plus } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { deleteNovel, fetchNovels } from '../services/novelService.js';

const router = useRouter();
const loading = ref(false);
const novels = ref([]);
const filters = ref({ title: '', status: '' });

const statusOptions = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '归档' },
];

const statusMeta = {
  draft: { label: '草稿', className: 'novel-status-tag-draft' },
  published: { label: '已发布', className: 'novel-status-tag-published' },
  archived: { label: '归档', className: 'novel-status-tag-archived' },
};

async function loadNovels() {
  loading.value = true;
  try {
    const data = await fetchNovels(filters.value);
    novels.value = data.list || [];
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function handleDelete(id) {
  try {
    await deleteNovel(id);
    ElMessage.success('已删除');
    loadNovels();
  } catch (e) {
    ElMessage.error(e.message || '删除失败');
  }
}

onMounted(loadNovels);
</script>
