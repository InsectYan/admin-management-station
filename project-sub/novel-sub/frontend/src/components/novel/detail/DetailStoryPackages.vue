<template>
  <div class="novel-story-desk">
    <section class="novel-detail-card">
      <h3>术语</h3>
      <el-form label-position="top" class="novel-entry-form" @submit.prevent="addTerm">
        <div class="novel-entry-grid">
          <el-form-item label="名称"><el-input v-model="term.name" /></el-form-item>
          <el-form-item label="别名"><el-input v-model="term.aliases" placeholder="用逗号分隔" /></el-form-item>
          <el-form-item label="类别">
            <el-select v-model="term.category" style="width: 100%">
              <el-option label="术语" value="term" />
              <el-option label="专名" value="proper" />
              <el-option label="禁用词" value="banned" />
            </el-select>
          </el-form-item>
        </div>
        <div class="novel-entry-actions">
          <el-button type="primary" @click="addTerm">添加</el-button>
        </div>
      </el-form>
      <el-table :data="desk.terms" empty-text="还没有术语" size="small">
        <el-table-column prop="name" label="名称" width="140" />
        <el-table-column label="类别" width="100">
          <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
        </el-table-column>
        <el-table-column prop="definition" label="释义" />
        <el-table-column label="" width="80">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeTerm(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section class="novel-detail-card">
      <div class="novel-story-desk__head">
        <h3>故事包</h3>
        <div>
          <el-button @click="check">检查一致性</el-button>
          <el-button type="primary" :disabled="!selected.length" @click="publish">发布所选章节</el-button>
        </div>
      </div>
      <p class="novel-story-desk__hint">只发布已写正文。发布后的版本不会再变。视频项目钉扎的是这个版本，不是当前草稿。</p>
      <el-table :data="desk.chapters" empty-text="还没有章节目录" size="small" @selection-change="onSelect">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="title" label="章节" />
        <el-table-column prop="word_count" label="字数" width="90" />
        <el-table-column prop="release_label" label="状态" width="140" />
      </el-table>
      <div v-if="scripts.length" class="novel-story-desk__scripts">
        <p class="novel-story-desk__hint">可选一份或多份剧本放进这个版本。不选则故事包只有正文。</p>
        <el-checkbox-group v-model="scriptIds">
          <el-checkbox v-for="script in scripts" :key="script.id" :label="script.id">{{ script.title }}</el-checkbox>
        </el-checkbox-group>
      </div>
      <div v-if="intents.length" class="novel-story-desk__scripts">
        <p class="novel-story-desk__hint">可选叙事分镜。它必须和所选剧本一起发布。</p>
        <el-checkbox-group v-model="intentIds">
          <el-checkbox v-for="shot in intents" :key="shot.id" :label="shot.id">{{ shot.intent || shot.dialogue || `分镜 ${shot.id}` }}</el-checkbox>
        </el-checkbox-group>
      </div>
      <el-alert v-for="item in desk.issues" :key="item.id" :title="item.message" :type="item.level === 'block' ? 'error' : 'warning'" show-icon :closable="false" />
      <h4>已发布版本</h4>
      <el-empty v-if="!desk.versions.length" description="还没有故事包" />
      <p v-else-if="desk.versions.length < 2" class="novel-story-desk__hint">至少发布两个版本后才能对比。</p>
      <div v-else>
        <el-select v-model="fromVersion" style="width: 120px">
          <el-option v-for="item in desk.versions" :key="`from-${item.version}`" :label="`v${item.version}`" :value="item.version" />
        </el-select>
        <el-select v-model="toVersion" style="width: 120px; margin-left: 8px">
          <el-option v-for="item in desk.versions" :key="`to-${item.version}`" :label="`v${item.version}`" :value="item.version" />
        </el-select>
        <el-button :loading="comparing" style="margin-left: 8px" @click="compare">对比</el-button>
        <p v-if="diffResult && !diffResult.chapters.length && !diffResult.scripts.length && !diffResult.intent_shots.length">这两个版本的章节、剧本和分镜一致。</p>
        <p v-for="item in diffResult?.chapters || []" :key="item.chapter_id">章节 {{ item.title }} · {{ changeLabel(item.change) }}<span v-if="item.before"> · {{ item.before }} → {{ item.after }}</span></p>
        <p v-for="item in diffResult?.scripts || []" :key="`script-${item.id}`">剧本 {{ item.title }} · {{ changeLabel(item.change) }}</p>
        <p v-for="item in diffResult?.intent_shots || []" :key="`intent-${item.id}`">分镜 {{ item.title }} · {{ changeLabel(item.change) }}</p>
      </div>
      <div v-for="item in desk.versions" :key="item.version" class="novel-story-desk__version">
        <span>v{{ item.version }} · {{ item.published_at }} · {{ item.chapters.length }} 章<span v-if="item.scripts"> · {{ item.scripts }} 份剧本</span><span v-if="item.intent_shots"> · {{ item.intent_shots }} 条分镜</span></span>
        <el-button link type="primary" @click="download(item.version, 'md')">Markdown</el-button>
        <el-button link type="primary" @click="download(item.version, 'txt')">TXT</el-button>
        <el-button link type="primary" @click="download(item.version, 'doc')">Word</el-button>
      </div>
      <h4>下游视频项目</h4>
      <el-empty v-if="!desk.downstreams.length" description="还没有视频项目钉扎这个故事" />
      <p v-for="item in desk.downstreams" :key="item.video_project_id">
        {{ item.name || `视频项目 ${item.video_project_id}` }} · 钉扎 v{{ item.version }}
        <span v-if="item.stage"> · {{ item.stage }}</span>
      </p>
    </section>

    <section class="novel-detail-card">
      <h3>来自视频的台词修改</h3>
      <el-empty v-if="!desk.promotions.length" description="还没有提升申请" />
      <article v-for="item in desk.promotions" :key="item.id" class="novel-story-desk__promo">
        <p>镜头 {{ item.shot_id }} · {{ statusLabel(item.status) }}</p>
        <p>原句：{{ item.before }}</p>
        <p>改后：{{ item.after }}</p>
        <p v-if="item.reason">理由：{{ item.reason }}</p>
        <div v-if="item.status === 'pending'">
          <el-button type="primary" size="small" @click="apply(item)">应用到正文</el-button>
          <el-button size="small" @click="reject(item)">驳回</el-button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  applyPromotion,
  createTerm,
  deleteTerm,
  fetchPackageDiff,
  fetchStoryDesk,
  fetchStoryPackage,
  fetchScripts,
  fetchIntentShots,
  publishStoryPackage,
  recordStoryExport,
  rejectPromotion,
  runConsistency,
} from '../../../services/novelService.js';
import { exportPlain } from '../../../utils/novelExport.js';

const props = defineProps({
  novelId: { type: [Number, String], required: true },
  title: { type: String, default: '' },
});

const desk = reactive({
  package_id: '',
  chapters: [],
  versions: [],
  downstreams: [],
  issues: [],
  promotions: [],
  terms: [],
});
const term = reactive({ name: '', aliases: '', category: 'term' });
const selected = ref([]);
const scripts = ref([]);
const scriptIds = ref([]);
const intents = ref([]);
const intentIds = ref([]);
const fromVersion = ref(null);
const toVersion = ref(null);
const diffResult = ref(null);
const comparing = ref(false);

function changeLabel(change) {
  if (change === 'added') return '新增';
  if (change === 'removed') return '移除';
  if (change === 'title') return '标题有改动';
  return '有改动';
}

function categoryLabel(value) {
  if (value === 'banned') return '禁用词';
  if (value === 'proper') return '专名';
  return '术语';
}
function statusLabel(value) {
  if (value === 'applied') return '已应用';
  if (value === 'rejected') return '已驳回';
  return '待处理';
}
function onSelect(rows) {
  selected.value = rows;
}
async function load() {
  const [data, scriptList, intentList] = await Promise.all([
    fetchStoryDesk(props.novelId),
    fetchScripts(props.novelId).catch(() => []),
    fetchIntentShots(props.novelId).catch(() => []),
  ]);
  Object.assign(desk, {
    package_id: data?.package_id || '',
    chapters: data?.chapters || [],
    versions: data?.versions || [],
    downstreams: data?.downstreams || [],
    issues: data?.issues || [],
    promotions: data?.promotions || [],
    terms: data?.terms || [],
  });
  scripts.value = scriptList || [];
  intents.value = intentList || [];
  const versions = desk.versions || [];
  if (versions.length >= 2 && fromVersion.value == null) {
    fromVersion.value = versions[versions.length - 1].version;
    toVersion.value = versions[0].version;
  }
}

async function compare() {
  comparing.value = true;
  try {
    diffResult.value = await fetchPackageDiff(props.novelId, fromVersion.value, toVersion.value);
  } catch (err) {
    ElMessage.error(err.message || '对比失败');
  } finally {
    comparing.value = false;
  }
}
async function addTerm() {
  try {
    await createTerm(props.novelId, { ...term });
    term.name = '';
    term.aliases = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function removeTerm(row) {
  try {
    await deleteTerm(props.novelId, row.id);
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function check() {
  try {
    await runConsistency(props.novelId, selected.value.map(item => item.chapter_id));
    await load();
    const blocks = desk.issues.filter(item => item.level === 'block').length;
    if (blocks) ElMessage.warning('有禁用词，发布会被拦住');
    else if (desk.issues.length) ElMessage.success('有警告，仍可以发布');
    else ElMessage.success('没有发现问题');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function publish() {
  try {
    const row = await publishStoryPackage(
      props.novelId,
      selected.value.map(item => item.chapter_id),
      scriptIds.value,
      intentIds.value,
    );
    await load();
    ElMessage.success(`已发布故事包 v${row.version}`);
  } catch (err) {
    ElMessage.error(err.message);
    await load();
  }
}
async function download(version, format) {
  try {
    const pack = await fetchStoryPackage(desk.package_id, version);
    const lines = [`# ${pack.title || props.title || '故事包'}`, ''];
    for (const chapter of pack.chapters || []) {
      lines.push(`## ${chapter.title}`, '', chapter.body || '', '');
    }
    exportPlain(`${pack.title || '故事包'}-v${version}`, `${lines.join('\n').trim()}\n`, format);
    recordStoryExport(props.novelId, { format, version }).catch(() => {});
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function apply(item) {
  try {
    await applyPromotion(props.novelId, item.id);
    await load();
    ElMessage.success('已写入正文。若要给视频用，请再发布一个新版本');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function reject(item) {
  try {
    const { value } = await ElMessageBox.prompt('驳回理由', '驳回提升', { inputPattern: /\S+/, inputErrorMessage: '请填写理由' });
    await rejectPromotion(props.novelId, item.id, value);
    await load();
  } catch (err) {
    if (err === 'cancel' || err?.action === 'cancel') return;
    ElMessage.error(err.message || '已取消');
  }
}
onMounted(load);
</script>

<style scoped>
.novel-story-desk {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.novel-story-desk__head,
.novel-story-desk__version,
.novel-story-desk__promo {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}
.novel-story-desk__hint {
  color: var(--novel-color-ink-soft, #6b6256);
}
.novel-detail-card {
  padding: 16px;
  border-radius: 12px;
  background: var(--novel-color-parchment, #fffaf3);
}
</style>
