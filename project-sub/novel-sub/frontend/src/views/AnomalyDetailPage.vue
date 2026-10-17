<template>
  <div v-loading="loading" class="anomaly-detail">
    <header class="anomaly-detail__head">
      <div>
        <el-button link @click="goList">← 返回登记表</el-button>
        <h1>{{ report?.novel_title || '异常详情' }}</h1>
        <p>{{ report?.summary || '加载中' }}</p>
      </div>
      <div class="anomaly-detail__actions">
        <el-tag :type="report?.mode === 'full' ? 'warning' : 'info'" effect="light">
          {{ report?.mode === 'full' ? '全面检测' : '粗略检测' }}
        </el-tag>
        <el-button v-if="report?.novel_id" @click="goNovel">打开小说</el-button>
        <el-button type="primary" :disabled="!tasks.length" @click="startFix">修正</el-button>
      </div>
    </header>

    <section class="anomaly-detail__card">
      <h2>异常执行列表</h2>
      <el-empty v-if="!tasks.length" description="这次检测没有需要执行的修正" :image-size="64" />
      <ol v-else class="anomaly-detail__tasks">
        <li v-for="(task, index) in tasks" :key="task.id">
          <span class="anomaly-detail__index">{{ index + 1 }}</span>
          <div>
            <strong>{{ task.label }}</strong>
            <p>{{ task.detail }}</p>
          </div>
          <el-tag size="small" :type="task.status === 'done' ? 'success' : 'info'" effect="plain">
            {{ task.module === 'studio' ? '单章开发' : '章节目录' }}
          </el-tag>
        </li>
      </ol>
    </section>

    <section class="anomaly-detail__card">
      <h2>问题明细</h2>
      <p v-if="report?.word_floor" class="is-muted">字数下限 {{ report.word_floor }} 字（大纲规划均摊后的一半，至少 800 字）。</p>
      <el-table :data="findings" empty-text="没有问题">
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.severity === 'error' ? 'danger' : 'warning'" effect="light">
              {{ row.severity === 'error' ? '错误' : '警告' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="chapter_title" label="章节" min-width="160" />
        <el-table-column prop="message" label="问题" min-width="220" />
        <el-table-column prop="detail" label="说明" min-width="260" />
        <el-table-column prop="evidence" label="依据" min-width="180" show-overflow-tooltip />
      </el-table>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { fetchAnomalyReport } from '../services/novelService.js';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const report = ref(null);

const findings = computed(() => report.value?.findings || []);
const tasks = computed(() => report.value?.tasks || []);

async function load() {
  loading.value = true;
  try {
    report.value = await fetchAnomalyReport(route.params.id);
  } catch (err) {
    ElMessage.error(err.message || '加载详情失败');
  } finally {
    loading.value = false;
  }
}

function goList() {
  router.push({ name: 'novel-anomalies' });
}

function goNovel() {
  router.push({ name: 'novel-detail', params: { id: report.value.novel_id }, query: { tab: '8' } });
}

async function startFix() {
  const pending = tasks.value.filter((task) => task.status !== 'done');
  const first = pending[0] || tasks.value[0];
  if (!first) return;
  const rewriteCount = tasks.value.filter((task) => task.action === 'rewrite_chapter' && task.status !== 'done').length;
  const text = rewriteCount
    ? `将按列表逐项执行。章节目录类问题会在编辑页直接改正；${rewriteCount} 章正文会打开单章开发，调用写正文并覆盖该章现有内容。`
    : '将按列表逐项打开章节目录并改正顺序或大纲关联。';
  try {
    await ElMessageBox.confirm(text, '按异常执行修正', {
      confirmButtonText: '开始修正',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  if (first.module === 'content') {
    await router.push({
      name: 'novel-create',
      query: {
        id: String(report.value.novel_id),
        step: '6',
        anomaly: String(report.value.id),
        fix: '1',
      },
    });
    return;
  }
  await router.push({
    name: 'novel-detail',
    params: { id: String(report.value.novel_id) },
    query: {
      tab: '7',
      chapter: first.chapter_id || '',
      anomaly: String(report.value.id),
      fix: '1',
    },
  });
}

onMounted(load);
</script>

<style scoped>
.anomaly-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.anomaly-detail__head,
.anomaly-detail__card {
  padding: 16px;
  border-radius: var(--novel-radius-base, 10px);
  border: var(--novel-border-subtle);
  background: var(--novel-color-surface, rgba(255, 255, 255, 0.62));
}

.anomaly-detail__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.anomaly-detail__head h1 {
  margin: 8px 0 4px;
  font-size: 22px;
  color: var(--novel-color-deep, #1f3d2c);
}

.anomaly-detail__head p,
.is-muted {
  margin: 0;
  color: var(--novel-color-text-secondary, #5c6b62);
  font-size: 13px;
}

.anomaly-detail__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.anomaly-detail__card h2 {
  margin: 0 0 10px;
  font-size: 16px;
  color: var(--novel-color-deep, #1f3d2c);
}

.anomaly-detail__tasks {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.anomaly-detail__tasks li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: var(--novel-border-subtle);
}

.anomaly-detail__tasks strong {
  color: var(--novel-color-deep, #1f3d2c);
}

.anomaly-detail__tasks p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--novel-color-text-secondary, #5c6b62);
}

.anomaly-detail__index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--novel-color-primary, #2f8a5b);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.anomaly-detail__tasks div {
  flex: 1;
}
</style>
