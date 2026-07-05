<template>
  <PageShell title="任务列表" table-layout>
    <template #extra>
      <el-button @click="router.push({ name: 'test-scope' })">
        返回配置
      </el-button>
    </template>

    <el-alert
      v-for="(notice, idx) in finishedNotices"
      :key="`${notice.job_id}-${notice.finished_at}-${idx}`"
      type="success"
      :title="formatFinishedNotice(notice)"
      show-icon
      closable
      style="margin-bottom: 12px"
      @close="dismissNotice(idx)"
    />

    <el-empty v-if="!list.length && !finishedNotices.length" description="暂无进行中的生成任务" />

    <el-table v-else :data="list" border stripe style="width: 100%">
      <el-table-column prop="task_name" label="任务名称" min-width="160" />
      <el-table-column label="项目" min-width="120">
        <template #default="{ row }">
          {{ row.project_name || row.project_code || '—' }}
        </template>
      </el-table-column>
      <el-table-column prop="job_id" label="任务 ID" width="88" />
      <el-table-column label="队列状态" width="120">
        <template #default="{ row }">
          <el-tag :type="queueStatusType(row.queue_status)" size="small">
            {{ queueStatusLabel(row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="进度" min-width="180">
        <template #default="{ row }">
          <el-progress
            :percentage="row.progress_percent ?? 0"
            :status="row.queue_status === 'paused' ? 'warning' : undefined"
            :stroke-width="14"
          />
        </template>
      </el-table-column>
      <el-table-column label="当前阶段" width="100">
        <template #default="{ row }">
          {{ phaseLabel(row.current_phase) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="goDetail(row.job_id)">
            查看详情
          </el-button>
          <el-button
            v-if="row.queue_status === 'paused'"
            link
            type="success"
            :loading="actionJobId === row.job_id && actionType === 'resume'"
            @click="handleResume(row.job_id)"
          >
            恢复
          </el-button>
          <el-button
            v-if="row.queue_status === 'waiting' || row.queue_status === 'running'"
            link
            type="warning"
            :loading="actionJobId === row.job_id && actionType === 'pause'"
            @click="handlePause(row.job_id)"
          >
            暂停
          </el-button>
          <el-button
            v-if="row.queue_status === 'waiting' || row.queue_status === 'running' || row.queue_status === 'paused'"
            link
            type="danger"
            :loading="actionJobId === row.job_id && actionType === 'cancel'"
            @click="handleCancel(row.job_id)"
          >
            取消
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </PageShell>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import {
  fetchGenerationQueue,
  pauseQueueJob,
  resumeQueueJob,
  cancelQueueJob,
} from '../services/generationService.js';

const router = useRouter();
const list = ref([]);
const finishedNotices = ref([]);
const pollTimer = ref(null);
const actionJobId = ref(null);
const actionType = ref('');

const phaseLabelMap = {
  analyze: '需求分析',
  generate: '生成用例',
  review: '合规审查',
};

function phaseLabel(phase) {
  return phaseLabelMap[phase] || phase || '—';
}

function queueStatusLabel(row) {
  const map = {
    waiting: '等待中',
    running: '进行中',
    paused: '已暂停',
  };
  if (row.queue_status === 'waiting' && row.wait_position > 1) {
    return `等待中（第 ${row.wait_position} 位）`;
  }
  if (row.queue_status === 'waiting' && row.wait_position === 1) {
    return '等待中（即将执行）';
  }
  return map[row.queue_status] || row.queue_status;
}

function queueStatusType(status) {
  const map = {
    waiting: 'info',
    running: 'primary',
    paused: 'warning',
  };
  return map[status] || 'info';
}

function formatFinishedNotice(notice) {
  const statusText = notice.status === 'partial' ? '部分完成' : '已执行完';
  return `「${notice.task_name}」测试用例生成任务${statusText}`;
}

function dismissNotice(idx) {
  finishedNotices.value.splice(idx, 1);
}

function goDetail(jobId) {
  router.push({ name: 'generation-progress', params: { id: jobId } });
}

function mergeQueueData(data) {
  const incoming = data?.list || [];
  const notices = data?.finished_notices || [];
  if (notices.length) {
    finishedNotices.value = [ ...finishedNotices.value, ...notices ];
  }
  list.value = incoming;
}

async function refreshQueue() {
  try {
    const data = await fetchGenerationQueue();
    mergeQueueData(data);
  } catch (err) {
    // 静默轮询，不打断用户
    console.warn('[generation-queue] poll failed:', err.message);
  }
}

async function handlePause(jobId) {
  actionJobId.value = jobId;
  actionType.value = 'pause';
  try {
    await pauseQueueJob(jobId);
    ElMessage.success('任务已暂停，队列将执行下一条');
    await refreshQueue();
  } catch (err) {
    ElMessage.error(err.message || '暂停失败');
  } finally {
    actionJobId.value = null;
    actionType.value = '';
  }
}

async function handleResume(jobId) {
  actionJobId.value = jobId;
  actionType.value = 'resume';
  try {
    await resumeQueueJob(jobId);
    ElMessage.success('任务已恢复并重新排队');
    await refreshQueue();
  } catch (err) {
    ElMessage.error(err.message || '恢复失败');
  } finally {
    actionJobId.value = null;
    actionType.value = '';
  }
}

async function handleCancel(jobId) {
  try {
    await ElMessageBox.confirm('取消后该任务将从队列移除，是否继续？', '取消任务', {
      type: 'warning',
      confirmButtonText: '确认取消',
      cancelButtonText: '返回',
    });
  } catch {
    return;
  }
  actionJobId.value = jobId;
  actionType.value = 'cancel';
  try {
    await cancelQueueJob(jobId);
    ElMessage.success('任务已取消');
    await refreshQueue();
  } catch (err) {
    ElMessage.error(err.message || '取消失败');
  } finally {
    actionJobId.value = null;
    actionType.value = '';
  }
}

onMounted(() => {
  refreshQueue();
  pollTimer.value = setInterval(refreshQueue, 5000);
});

onUnmounted(() => {
  if (pollTimer.value) {
    clearInterval(pollTimer.value);
    pollTimer.value = null;
  }
});
</script>
