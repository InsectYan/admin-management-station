<template>
  <section v-if="report" class="anomaly-fix">
    <header class="anomaly-fix__head">
      <div>
        <strong>异常执行列表</strong>
        <span>{{ doneCount }}/{{ tasks.length }}</span>
      </div>
      <el-button v-if="running" size="small" @click="paused = true">暂停</el-button>
      <el-button v-else size="small" type="primary" :disabled="!tasks.length" @click="runQueue">
        {{ failedCount ? '继续执行' : '开始执行' }}
      </el-button>
    </header>
    <ol class="anomaly-fix__list">
      <li v-for="task in tasks" :key="task.id" :class="`is-${task.status || 'pending'}`">
        <span>{{ task.label }}</span>
        <em>{{ statusText(task.status) }}</em>
      </li>
    </ol>
    <p v-if="currentLabel" class="anomaly-fix__current">正在执行：{{ currentLabel }}</p>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  fetchAnomalyReport,
  runAnomalyTask,
  setAnomalyTaskStatus,
} from '../../services/novelService.js';

const props = defineProps({
  reportId: { type: [String, Number], required: true },
  home: { type: String, required: true },
  auto: { type: Boolean, default: false },
  execute: { type: Function, default: null },
  reload: { type: Function, default: null },
});

const router = useRouter();
const report = ref(null);
const running = ref(false);
const paused = ref(false);
const currentLabel = ref('');
const started = ref(false);

const tasks = computed(() => report.value?.tasks || []);
const doneCount = computed(() => tasks.value.filter((task) => task.status === 'done').length);
const failedCount = computed(() => tasks.value.filter((task) => task.status === 'failed').length);

function statusText(status) {
  if (status === 'done') return '已完成';
  if (status === 'failed') return '失败';
  if (status === 'running') return '执行中';
  return '待执行';
}

async function load() {
  report.value = await fetchAnomalyReport(props.reportId);
}

function routeFor(task) {
  const novelId = report.value?.novel_id;
  if (task.module === 'content') {
    return {
      name: 'novel-create',
      query: {
        id: String(novelId),
        step: '6',
        anomaly: String(props.reportId),
        fix: '1',
      },
    };
  }
  return {
    name: 'novel-detail',
    params: { id: String(novelId) },
    query: {
      tab: '7',
      chapter: task.chapter_id || '',
      anomaly: String(props.reportId),
      fix: '1',
    },
  };
}

async function runQueue() {
  if (running.value) return;
  paused.value = false;
  running.value = true;
  try {
    await load();
    let guard = 0;
    while (!paused.value && guard < 200) {
      guard += 1;
      const task = (report.value?.tasks || []).find((item) => item.status !== 'done');
      if (!task) break;
      if (task.module !== props.home) {
        await router.push(routeFor(task));
        return;
      }
      currentLabel.value = task.label;
      try {
        if (task.action === 'rewrite_chapter') {
          if (!props.execute) throw new Error('当前页面不能重写正文');
          await props.execute(task);
          report.value = await setAnomalyTaskStatus(props.reportId, task.id, 'done');
        } else {
          const data = await runAnomalyTask(props.reportId, task.id);
          report.value = data.report;
          if (props.reload) await props.reload();
        }
      } catch (err) {
        report.value = await setAnomalyTaskStatus(
          props.reportId,
          task.id,
          'failed',
          err.message || '修正失败',
        );
        ElMessage.error(err.message || `「${task.label}」失败，已停止`);
        return;
      }
    }
    if (!paused.value && tasks.value.length && tasks.value.every((task) => task.status === 'done')) {
      ElMessage.success('异常修正已执行完');
      await router.push({ name: 'novel-anomaly-detail', params: { id: String(props.reportId) } });
    }
  } catch (err) {
    ElMessage.error(err.message || '读取执行列表失败');
  } finally {
    running.value = false;
    currentLabel.value = '';
  }
}

watch(
  () => props.reportId,
  () => {
    started.value = false;
    load().catch((err) => ElMessage.error(err.message || '读取执行列表失败'));
  },
  { immediate: true },
);

watch(
  () => props.auto,
  (auto) => {
    if (!auto || started.value) return;
    started.value = true;
    runQueue();
  },
);
</script>

<style scoped>
.anomaly-fix {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: var(--novel-radius-base, 10px);
  border: var(--novel-border-default);
  background: var(--novel-color-surface-elevated, rgba(255, 255, 255, 0.82));
}

.anomaly-fix__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.anomaly-fix__head strong {
  margin-right: 8px;
  color: var(--novel-color-deep, #1f3d2c);
}

.anomaly-fix__head span,
.anomaly-fix__current {
  font-size: 12px;
  color: var(--novel-color-text-secondary, #5c6b62);
}

.anomaly-fix__list {
  margin: 0;
  padding-left: 18px;
  max-height: 160px;
  overflow: auto;
}

.anomaly-fix__list li {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  line-height: 1.6;
}

.anomaly-fix__list em {
  font-style: normal;
  color: var(--novel-color-moon, #6d8a82);
}

.anomaly-fix__list .is-done em {
  color: var(--novel-color-primary, #2f8a5b);
}

.anomaly-fix__list .is-failed em {
  color: var(--novel-color-danger, #f56c6c);
}

.anomaly-fix__current {
  margin: 8px 0 0;
}
</style>
