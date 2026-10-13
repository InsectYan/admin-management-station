<template>
  <PageShell v-if="detail" :title="detail.project.name">
    <template #extra>
      <el-button link type="primary" @click="router.push('/projects')">返回列表</el-button>
    </template>
    <el-alert v-if="notice" :title="notice" :type="noticeType" show-icon class="cartoon-module" />
    <FlowSteps :steps="steps" :current="step" @select="step = $event" />

    <section v-show="step === 1" class="cartoon-module">
      <h3 class="cartoon-module__title">项目设定</h3>
      <el-form label-position="top">
        <el-form-item label="项目名称">
          <el-input v-model="projectForm.name" />
        </el-form-item>
        <el-form-item label="来源小说">
          <el-select v-model="projectForm.source_novel_id" filterable clearable placeholder="从小说平台选择" style="width: 100%" @change="onNovelChange">
            <el-option v-for="item in novels" :key="item.id" :label="item.title" :value="String(item.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="画面风格">
          <el-select v-model="projectForm.visual_style" placeholder="选择风格" style="width: 100%">
            <el-option v-for="item in meta.visual_styles" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-button type="primary" @click="saveProject">保存设定</el-button>
      </el-form>
    </section>

    <section v-show="step === 2">
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">从小说拉取</h3>
        <p class="cartoon-module__hint">先在上一步选好小说，再选章节。不用手填 ID。</p>
        <el-form label-position="top">
          <el-form-item label="章节">
            <el-select v-model="chapterId" filterable placeholder="选择章节" style="width: 100%" :disabled="!projectForm.source_novel_id">
              <el-option v-for="item in chapters" :key="item.id" :label="item.title" :value="String(item.id)" />
            </el-select>
          </el-form-item>
          <el-button type="primary" :disabled="!chapterId" @click="pull">拉取正文</el-button>
        </el-form>
      </div>
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">手工快照</h3>
        <el-form label-position="top">
          <el-form-item label="标题"><el-input v-model="chapterTitle" /></el-form-item>
          <el-form-item label="正文"><el-input v-model="body" type="textarea" :rows="6" /></el-form-item>
          <el-button @click="saveImport">保存手工快照</el-button>
        </el-form>
      </div>
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">已有快照</h3>
        <el-empty v-if="!detail.imports.length" description="还没有章节快照" />
        <el-card v-for="item in detail.imports" :key="item.id" shadow="never" class="cartoon-snap">
          <strong>{{ item.chapter_title || '未命名章节' }}</strong>
          <p>{{ item.body }}</p>
        </el-card>
      </div>
    </section>

    <section v-show="step === 3" class="cartoon-module">
      <h3 class="cartoon-module__title">分镜</h3>
      <el-form label-position="top">
        <el-form-item label="景别">
          <el-select v-model="shot.shot_size" style="width: 220px">
            <el-option v-for="item in meta.shot_sizes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="运镜">
          <el-select v-model="shot.camera_move" style="width: 220px">
            <el-option v-for="item in meta.camera_moves" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="shot.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="提示词"><el-input v-model="shot.positive_zh" type="textarea" :rows="2" /></el-form-item>
        <el-button type="primary" @click="addShot">添加分镜</el-button>
      </el-form>
      <el-table :data="detail.shots" style="margin-top: 12px" @row-click="choose">
        <el-table-column prop="sort_order" label="#" width="60" />
        <el-table-column prop="shot_size" label="景别" width="100" />
        <el-table-column prop="camera_move" label="运镜" width="100" />
        <el-table-column prop="description" label="描述" />
      </el-table>
    </section>

    <section v-show="step === 4" class="cartoon-module">
      <h3 class="cartoon-module__title">生成</h3>
      <p v-if="selected">当前分镜：{{ selected.description || '（无描述）' }}</p>
      <p v-else class="cartoon-module__hint">先在分镜步骤点一条分镜。</p>
      <el-form label-position="top">
        <el-form-item label="提示词"><el-input v-model="promptText" type="textarea" :rows="3" /></el-form-item>
        <el-button type="primary" :disabled="!selected" :loading="generating" @click="generate('image')">生成图片</el-button>
        <el-button :disabled="!selected" :loading="generating" @click="generate('video')">生成视频</el-button>
      </el-form>
    </section>

    <section v-show="step === 5" class="cartoon-module">
      <h3 class="cartoon-module__title">产物</h3>
      <el-empty v-if="!detail.tasks.length" description="还没有生成记录" />
      <el-card v-for="task in detail.tasks" :key="task.id" shadow="never" class="cartoon-snap">
        <p>{{ statusLabel(task.status) }} · {{ task.shot_description }}</p>
        <p v-if="task.error_message">{{ task.error_message }}</p>
        <div v-for="output in task.outputs" :key="output.id">
          <video v-if="output.media_kind === 'video'" :src="fileUrl(output.id)" controls class="cartoon-media"></video>
          <img v-else :src="fileUrl(output.id)" :alt="task.shot_description" class="cartoon-media" />
        </div>
      </el-card>
    </section>
  </PageShell>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import FlowSteps from '../components/FlowSteps.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';

const route = useRoute();
const router = useRouter();
const steps = [
  { step: 1, title: '项目' },
  { step: 2, title: '章节' },
  { step: 3, title: '分镜' },
  { step: 4, title: '生成' },
  { step: 5, title: '产物' },
];
const step = ref(1);
const detail = ref(null);
const novels = ref([]);
const chapters = ref([]);
const meta = reactive({ visual_styles: [], shot_sizes: [ '中景' ], camera_moves: [ '固定' ] });
const projectForm = reactive({ name: '', source_novel_id: '', visual_style: '' });
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
function fileUrl(id) { return `${resolveApiBase()}/outputs/${id}/file`; }
function choose(row) {
  selected.value = row;
  promptText.value = row.prompt?.positive_zh || '';
  step.value = 4;
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
function startPoll() {
  stopPoll();
  pollTimer = setInterval(async () => {
    await load();
    const active = (detail.value?.tasks || []).some(item => [ 'queued', 'running', 'saving' ].includes(item.status));
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
function fillProject() {
  const project = detail.value?.project;
  if (!project) return;
  projectForm.name = project.name || '';
  projectForm.source_novel_id = project.source_novel_id ? String(project.source_novel_id) : '';
  projectForm.visual_style = project.visual_style || '';
}
async function loadChapters(novelId) {
  chapters.value = [];
  if (!novelId) return;
  chapters.value = await request(`/novel-catalog/${novelId}/chapters`).catch(() => []);
}
async function onNovelChange() {
  chapterId.value = '';
  await loadChapters(projectForm.source_novel_id);
}
async function load() {
  detail.value = await request(`/projects/${route.params.id}`);
  fillProject();
}
async function saveProject() {
  try {
    await request(`/projects/${route.params.id}`, {
      method: 'put',
      data: {
        name: projectForm.name,
        source_novel_id: projectForm.source_novel_id || null,
        visual_style: projectForm.visual_style || '',
      },
    });
    await load();
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function pull() {
  try {
    await request(`/projects/${route.params.id}/imports/from-novel`, {
      method: 'post',
      data: { novel_id: projectForm.source_novel_id, chapter_id: chapterId.value },
    });
    await load();
    ElMessage.success('已拉取章节');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function saveImport() {
  if (!body.value.trim()) {
    ElMessage.warning('请填写正文');
    return;
  }
  await request(`/projects/${route.params.id}/imports`, {
    method: 'post',
    data: {
      chapter_title: chapterTitle.value,
      body: body.value,
      source_novel_id: projectForm.source_novel_id || null,
    },
  });
  body.value = '';
  await load();
}
async function addShot() {
  await request(`/projects/${route.params.id}/shots`, { method: 'post', data: { ...shot } });
  shot.description = '';
  shot.positive_zh = '';
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
    if ([ 'queued', 'running' ].includes(task.status)) startPoll();
    step.value = 5;
  } catch (err) {
    notice.value = err.message;
    noticeType.value = 'error';
  } finally {
    generating.value = false;
  }
}
onMounted(async () => {
  const [catalog, metaRes] = await Promise.all([
    request('/novel-catalog').catch(() => []),
    request('/meta').catch(() => null),
  ]);
  novels.value = catalog || [];
  if (metaRes) {
    meta.visual_styles = metaRes.visual_styles || [];
    meta.shot_sizes = metaRes.shot_sizes || meta.shot_sizes;
    meta.camera_moves = metaRes.camera_moves || meta.camera_moves;
  }
  await load();
  await loadChapters(projectForm.source_novel_id);
});
onUnmounted(stopPoll);
</script>

<style scoped>
.cartoon-snap { margin-bottom: 12px; }
.cartoon-media { max-width: 420px; display: block; margin-top: 8px; }
</style>
