<template>
  <div v-if="detail">
    <h2 class="page-title">{{ detail.project.name }}</h2>
    <el-alert v-if="notice" :title="notice" :type="noticeType" show-icon class="card-gap" />

    <h3>章节快照</h3>
    <el-form label-width="96px" class="card-gap">
      <el-form-item label="小说 ID"><el-input v-model="novelId" /></el-form-item>
      <el-form-item label="章节 ID"><el-input v-model="chapterId" /></el-form-item>
      <el-button @click="pull">从小说拉取</el-button>
      <el-form-item label="标题" style="margin-top: 12px"><el-input v-model="chapterTitle" /></el-form-item>
      <el-form-item label="正文"><el-input v-model="body" type="textarea" :rows="6" /></el-form-item>
      <el-button type="primary" @click="saveImport">保存手工快照</el-button>
    </el-form>
    <el-card v-for="item in detail.imports" :key="item.id" class="card-gap">
      <strong>{{ item.chapter_title || '未命名章节' }}</strong>
      <p>{{ item.body }}</p>
    </el-card>

    <h3>分镜</h3>
    <el-form label-width="96px">
      <el-form-item label="景别"><el-input v-model="shot.shot_size" /></el-form-item>
      <el-form-item label="运镜"><el-input v-model="shot.camera_move" /></el-form-item>
      <el-form-item label="描述"><el-input v-model="shot.description" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="提示词"><el-input v-model="shot.positive_zh" type="textarea" :rows="2" /></el-form-item>
      <el-button type="primary" @click="addShot">添加分镜</el-button>
    </el-form>
    <el-table :data="detail.shots" style="margin-top: 12px" @row-click="choose">
      <el-table-column prop="sort_order" label="#" width="60" />
      <el-table-column prop="shot_size" label="景别" width="100" />
      <el-table-column prop="camera_move" label="运镜" width="100" />
      <el-table-column prop="description" label="描述" />
      <el-table-column label="提示词">
        <template #default="{ row }">{{ row.prompt?.positive_zh }}</template>
      </el-table-column>
    </el-table>

    <h3>生成</h3>
    <p v-if="selected">当前分镜：{{ selected.description || '（无描述）' }}</p>
    <p v-else>先点一条分镜。</p>
    <el-form label-width="96px">
      <el-form-item label="提示词"><el-input v-model="promptText" type="textarea" :rows="2" /></el-form-item>
      <el-button type="primary" :disabled="!selected" :loading="generating" @click="generate('image')">生成图片</el-button>
      <el-button :disabled="!selected" :loading="generating" @click="generate('video')">生成视频</el-button>
    </el-form>

    <h3>产物</h3>
    <el-card v-for="task in detail.tasks" :key="task.id" class="card-gap">
      <p>{{ statusLabel(task.status) }} · {{ task.shot_description }}</p>
      <p v-if="task.error_message">{{ task.error_message }}</p>
      <div v-for="output in task.outputs" :key="output.id">
        <video v-if="output.media_kind === 'video'" :src="fileUrl(output.id)" controls style="max-width: 420px"></video>
        <img v-else :src="fileUrl(output.id)" :alt="task.shot_description" style="max-width: 420px" />
        <p>{{ task.shot_description }}</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { request, resolveApiBase } from '../services/apiConfig.js';

const route = useRoute();
const detail = ref(null);
const novelId = ref('');
const chapterId = ref('');
const chapterTitle = ref('');
const body = ref('');
const shot = reactive({ shot_size: '中景', camera_move: '固定', description: '', positive_zh: '' });
const selected = ref(null);
const promptText = ref('');
const generating = ref(false);
const notice = ref('');
const noticeType = ref('info');
let pollTimer = null;

function statusLabel(status) {
  return { queued: '排队', running: '生成中', saving: '生成中', success: '成功', failed: '失败' }[status] || status;
}
function fileUrl(id) {
  return `${resolveApiBase()}/outputs/${id}/file`;
}
function choose(row) {
  selected.value = row;
  promptText.value = row.prompt?.positive_zh || '';
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
function startPoll() {
  stopPoll();
  pollTimer = setInterval(async () => {
    await load();
    const active = (detail.value?.tasks || []).some(item => item.status === 'queued' || item.status === 'running' || item.status === 'saving');
    if (!active) {
      const latest = detail.value?.tasks?.[0];
      if (latest) {
        notice.value = latest.error_message ? `${statusLabel(latest.status)}：${latest.error_message}` : statusLabel(latest.status);
        noticeType.value = latest.status === 'success' ? 'success' : 'error';
      }
      stopPoll();
    }
  }, 2000);
}

async function load() {
  detail.value = await request(`/projects/${route.params.id}`);
}
async function pull() {
  try {
    await request(`/projects/${route.params.id}/imports/from-novel`, {
      method: 'post',
      data: { novel_id: novelId.value, chapter_id: chapterId.value || undefined },
    });
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function saveImport() {
  await request(`/projects/${route.params.id}/imports`, {
    method: 'post',
    data: { chapter_title: chapterTitle.value, body: body.value, source_novel_id: novelId.value || null },
  });
  body.value = '';
  await load();
}
async function generate(kind) {
  if (!selected.value) return;
  generating.value = true;
  notice.value = '排队';
  noticeType.value = 'info';
  try {
    const task = await request(`/projects/${route.params.id}/shots/${selected.value.id}/generate?kind=${kind}`, {
      method: 'post',
      data: { positive_zh: promptText.value },
    });
    notice.value = task.error_message ? `${statusLabel(task.status)}：${task.error_message}` : statusLabel(task.status);
    noticeType.value = task.status === 'failed' ? 'error' : 'info';
    await load();
    if (task.status === 'queued' || task.status === 'running') startPoll();
  } catch (err) {
    notice.value = err.message;
    noticeType.value = 'error';
  } finally {
    generating.value = false;
  }
}
async function addShot() {
  await request(`/projects/${route.params.id}/shots`, { method: 'post', data: { ...shot } });
  shot.description = '';
  shot.positive_zh = '';
  await load();
}
onMounted(load);
onUnmounted(stopPoll);
</script>
