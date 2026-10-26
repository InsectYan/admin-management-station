<template>
  <PageShell title="小说异常登记表" table-layout>
    <template #extra>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>小说中心</el-breadcrumb-item>
        <el-breadcrumb-item>异常登记表</el-breadcrumb-item>
      </el-breadcrumb>
    </template>

    <div class="anomaly-list__filter">
      <el-input
        v-model="title"
        placeholder="小说名称"
        clearable
        style="width: 220px"
        @keyup.enter="reload"
        @clear="reload"
      />
      <el-button type="primary" @click="reload">筛选</el-button>
    </div>

    <el-table v-loading="loading" :data="rows" empty-text="还没有检测记录。到小说详情的预览章节里点「小说检测」。">
      <el-table-column prop="novel_title" label="小说" min-width="160" />
      <el-table-column label="检测" width="110">
        <template #default="{ row }">{{ modeLabel(row.mode) }}</template>
      </el-table-column>
      <el-table-column prop="issue_count" label="问题数" width="90" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="statusType(row.status)" effect="light">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="summary" label="摘要" min-width="240" show-overflow-tooltip />
      <el-table-column prop="created_at" label="检测时间" width="180" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="anomaly-list__pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        layout="total, prev, pager, next"
        :total="total"
        @current-change="reload"
      />
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { fetchAnomalyReports } from '../services/novelService.js';

const router = useRouter();
const loading = ref(false);
const title = ref('');
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

function modeLabel(mode) {
  if (mode === 'full') return '全面检测';
  if (mode === 'chapter_length') return '章节字数';
  return '粗略检测';
}

function statusLabel(status) {
  if (status === 'done') return '已处理';
  if (status === 'fixing') return '修正中';
  return '待处理';
}

function statusType(status) {
  if (status === 'done') return 'success';
  if (status === 'fixing') return 'warning';
  return 'danger';
}

async function reload() {
  loading.value = true;
  try {
    const data = await fetchAnomalyReports({
      page: page.value,
      pageSize: pageSize.value,
      title: title.value.trim(),
    });
    rows.value = data?.list || [];
    total.value = data?.total || 0;
  } catch (err) {
    ElMessage.error(err.message || '加载登记表失败');
  } finally {
    loading.value = false;
  }
}

function openDetail(row) {
  router.push({ name: 'novel-anomaly-detail', params: { id: row.id } });
}

onMounted(reload);
</script>

<style scoped>
.anomaly-list__filter {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.anomaly-list__pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
