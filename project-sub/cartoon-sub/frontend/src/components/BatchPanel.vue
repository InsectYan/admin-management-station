<template>
  <div>
    <p class="cartoon-module__hint">{{ hint }}</p>
    <el-form label-position="top">
      <el-form-item label="标题"><el-input v-model="draft.title" /></el-form-item>
      <el-form-item label="正文"><el-input v-model="draft.body" type="textarea" :rows="3" /></el-form-item>
      <el-button :disabled="!canMake()" @click="addDraft">加入选题</el-button>
    </el-form>
    <ul v-if="drafts.length" class="cartoon-batch-drafts">
      <li v-for="(item, index) in drafts" :key="index">{{ item.title || '未命名选题' }}</li>
    </ul>
    <el-button type="primary" :disabled="!canMake() || !drafts.length" :loading="running" @click="start">开始批量</el-button>

    <div v-if="batch" class="cartoon-batch-status">
      <p>{{ statusLabel(batch.status) }} · 进度 {{ batch.breakpoint_index }}/{{ batch.total }} · 成功 {{ batch.success_count }} · 失败 {{ batch.failed_count }}</p>
      <el-button v-if="batch.status === 'queued' || batch.status === 'running'" :disabled="!canMake()" @click="pause">暂停</el-button>
      <el-button v-if="batch.status === 'paused'" type="primary" :disabled="!canMake()" @click="resume">继续</el-button>
      <el-button v-if="batch.status === 'queued' || batch.status === 'running' || batch.status === 'paused'" :disabled="!canMake()" @click="cancel">取消</el-button>
      <ul>
        <li v-for="item in batch.items" :key="item.id">
          {{ item.title || '未命名选题' }} · {{ statusLabel(item.status) }}
          <span v-if="item.error_message">{{ item.error_message }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
  science: { type: Boolean, default: false },
});
const hint = props.science
  ? '每条选题写成一条本地文案。失败的条目会留下已经写好的文案。这一步不出图。'
  : '每条选题写成一条分镜。失败的条目会留下已经写好的分镜。这一步不出图。';
const draft = reactive({ title: '', body: '' });
const drafts = ref([]);
const batch = ref(null);
const running = ref(false);

function statusLabel(status) {
  return {
    queued: '等待',
    running: '进行中',
    paused: '已暂停',
    cancelled: '已取消',
    completed: '已完成',
    failed: '有失败',
    success: '成功',
  }[status] || status;
}
function addDraft() {
  if (!draft.body.trim()) {
    ElMessage.warning('需要正文');
    return;
  }
  drafts.value.push({ title: draft.title.trim(), body: draft.body.trim() });
  draft.title = '';
  draft.body = '';
}
async function load() {
  const rows = await request(`/projects/${props.projectId}/batches`);
  batch.value = rows?.[0] || null;
}
async function start() {
  running.value = true;
  try {
    const created = await request(`/projects/${props.projectId}/batches`, {
      method: 'post',
      data: { items: drafts.value },
    });
    batch.value = await request(`/batches/${created.id}/run`, { method: 'post' });
    drafts.value = [];
    ElMessage.success('批量已处理');
  } catch (err) {
    ElMessage.error(err.message);
    await load().catch(() => {});
  } finally {
    running.value = false;
  }
}
async function pause() {
  try {
    batch.value = await request(`/batches/${batch.value.id}/pause`, { method: 'post' });
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function resume() {
  try {
    await request(`/batches/${batch.value.id}/resume`, { method: 'post' });
    batch.value = await request(`/batches/${batch.value.id}/run`, { method: 'post' });
  } catch (err) {
    ElMessage.error(err.message);
    await load().catch(() => {});
  }
}
async function cancel() {
  try {
    batch.value = await request(`/batches/${batch.value.id}/cancel`, { method: 'post' });
  } catch (err) {
    ElMessage.error(err.message);
  }
}
onMounted(() => {
  load().catch(err => ElMessage.error(err.message));
});
</script>

<style scoped>
.cartoon-batch-drafts,
.cartoon-batch-status ul {
  margin: 12px 0;
  padding-left: 18px;
}
.cartoon-batch-status {
  margin-top: 16px;
}
</style>
