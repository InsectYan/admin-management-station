<template>
  <PageShell title="项目管理">
    <template #extra>
      <el-button type="primary" @click="router.push('/projects/new')">新建项目</el-button>
    </template>

    <div class="project-filter-bar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索项目编码 / 名称"
        clearable
        style="width: 220px"
        @change="load"
      />
      <el-select v-model="filters.team" placeholder="团队" clearable style="width: 140px" @change="load">
        <el-option v-for="t in teamOptions" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" clearable style="width: 120px" @change="load">
        <el-option label="活跃" value="active" />
        <el-option label="草稿" value="draft" />
        <el-option label="归档" value="archived" />
      </el-select>
      <el-select v-model="filters.activeWithinDays" placeholder="最近活跃" clearable style="width: 140px" @change="load">
        <el-option label="7 天内" :value="7" />
        <el-option label="30 天内" :value="30" />
        <el-option label="90 天内" :value="90" />
      </el-select>
    </div>

    <div v-loading="loading" class="project-card-grid">
      <el-empty v-if="!loading && !projects.length" description="暂无项目，点击右上角新建" />
      <el-card
        v-for="p in projects"
        :key="p.project_code"
        shadow="hover"
        class="project-card"
        @click="openProject(p)"
      >
        <div class="project-card-header">
          <h3>{{ p.project_name }}</h3>
          <el-tag :type="statusType(p.status)" size="small">{{ statusLabel(p.status) }}</el-tag>
        </div>
        <p class="project-code">{{ p.project_code }}</p>
        <p class="project-desc">{{ p.description || '暂无描述' }}</p>
        <div class="project-meta">
          <span><el-icon><User /></el-icon> {{ p.team || '未分配团队' }}</span>
          <span><el-icon><Clock /></el-icon> {{ formatTime(p.last_active_at || p.updated_at) }}</span>
        </div>
        <div class="project-card-actions" @click.stop>
          <el-button link type="primary" @click="openProject(p)">进入</el-button>
          <el-button link @click="router.push(`/projects/${encodeURIComponent(p.project_code)}/edit`)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(p)">删除</el-button>
        </div>
      </el-card>
    </div>

    <div v-if="total > pageSize" class="project-pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { User, Clock } from '@element-plus/icons-vue';
import PageShell from '@/components/PageShell.vue';
import { deleteProject, fetchProjects } from '@/services/projectService.js';

const router = useRouter();
const loading = ref(false);
const projects = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(12);
const filters = reactive({ keyword: '', team: '', status: '', activeWithinDays: null });

const teamOptions = computed(() => {
  const set = new Set(projects.value.map(p => p.team).filter(Boolean));
  return [ ...set ];
});

function statusType(s) {
  return { active: 'success', draft: 'info', archived: 'warning' }[s] || 'info';
}

function statusLabel(s) {
  return { active: '活跃', draft: '草稿', archived: '归档' }[s] || s;
}

function formatTime(v) {
  if (!v) return '-';
  return new Date(v).toLocaleString('zh-CN');
}

function openProject(p) {
  router.push(`/projects/${encodeURIComponent(p.project_code)}`);
}

async function load() {
  loading.value = true;
  try {
    const data = await fetchProjects({
      page: page.value,
      pageSize: pageSize.value,
      ...filters,
    });
    projects.value = data.list || [];
    total.value = data.total || 0;
  } finally {
    loading.value = false;
  }
}

async function handleDelete(p) {
  try {
    await ElMessageBox.confirm(`确定删除项目「${p.project_name}」？`, '删除确认', { type: 'warning' });
  } catch {
    return;
  }
  await deleteProject(p.project_code);
  ElMessage.success('已删除');
  await load();
}

onMounted(load);
</script>

<style scoped>
.project-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.project-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  min-height: 200px;
}
.project-card {
  cursor: pointer;
  transition: transform 0.15s;
}
.project-card:hover {
  transform: translateY(-2px);
}
.project-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}
.project-card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.project-code {
  color: #909399;
  font-size: 13px;
  margin: 8px 0;
}
.project-desc {
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
  min-height: 40px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.project-meta {
  display: flex;
  justify-content: space-between;
  color: #909399;
  font-size: 12px;
  margin: 12px 0;
}
.project-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.project-card-actions {
  border-top: 1px solid #ebeef5;
  padding-top: 8px;
  display: flex;
  gap: 8px;
}
.project-pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
