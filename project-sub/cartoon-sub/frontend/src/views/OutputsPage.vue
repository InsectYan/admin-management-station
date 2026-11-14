<template>
  <PageShell title="产物" :loading="loading" :data-filter="`${filterTick}|${filtered.length}`">
    <div class="cartoon-module">
      <el-tabs v-model="section">
        <el-tab-pane label="媒体" name="media">
      <div class="cartoon-output-bar">
        <el-select v-model="mediaKind" clearable placeholder="图片或视频" style="width: 140px" @change="refreshFilter">
          <el-option label="图片" value="image" />
          <el-option label="视频" value="video" />
        </el-select>
        <el-select v-model="taskType" clearable placeholder="任务类型" style="width: 180px" @change="refreshFilter">
          <el-option v-for="item in taskTypes" :key="item" :label="item" :value="item" />
        </el-select>
        <el-input v-model="shotQuery" clearable placeholder="镜头ID，如 S000012" style="width: 200px" @input="refreshFilter" />
        <el-button class="cartoon-output-bar__delete" type="danger" plain :disabled="!canMake() || !selected.length" @click="removeSelected">
          批量删除<template v-if="selected.length">（{{ selected.length }}）</template>
        </el-button>
      </div>
      <el-table ref="tableRef" :data="pageRows" row-key="id" @selection-change="onSelect">
        <el-table-column type="selection" width="48" fixed="left" reserve-selection :selectable="rowSelectable" />
        <el-table-column label="资产/记录" width="148" fixed="left">
          <template #default="{ row }">
            <div class="cartoon-output-ids">
              <span>产物 #{{ row.id }}</span>
              <span>{{ row.task ? `记录 #${row.task.id}` : '记录 —' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="项目" min-width="160">
          <template #default="{ row }">{{ row.project_name || '项目已不在' }}</template>
        </el-table-column>
        <el-table-column label="快照" min-width="180">
          <template #default="{ row }">
            <template v-if="row.snapshot_title">
              {{ row.snapshot_title }}
              <el-tag v-if="row.snapshot_deleted" size="small" type="danger">已删除</el-tag>
            </template>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="镜头" width="110">
          <template #default="{ row }">{{ row.shot_code || '—' }}</template>
        </el-table-column>
        <el-table-column label="类型" min-width="140">
          <template #default="{ row }">{{ mediaLabel(row.media_kind) }} · {{ stageLabel(row.version_stage) }}</template>
        </el-table-column>
        <el-table-column label="任务" min-width="210">
          <template #default="{ row }">
            <template v-if="row.task">{{ taskKindLabel(row.task) }} · {{ statusLabel(row.task.status) }}</template>
            <template v-else>成片</template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="168" fixed="right">
          <template #default="{ row }">
            <span class="cartoon-output-ops">
              <el-button link type="primary" @click="openDetail(row)">查看详情</el-button>
              <el-button link type="danger" :disabled="!canMake()" @click="removeRow(row)">删除</el-button>
              <el-tooltip v-if="row.project_deleted" content="对应项目已删除" placement="top">
                <span class="cartoon-output-ops__warn">
                  <el-icon color="#c45656"><WarningFilled /></el-icon>
                </span>
              </el-tooltip>
            </span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !filtered.length" :description="emptyText" />
      <div v-if="filtered.length > pageSize" class="cartoon-output-pager">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="filtered.length"
          layout="total, prev, pager, next"
          background
        />
      </div>
        </el-tab-pane>
        <el-tab-pane label="提示词" name="prompt">
          <el-table :data="promptRows">
            <el-table-column label="项目" min-width="160">
              <template #default="{ row }">
                {{ row.project_name || '项目已不在' }}
                <el-tag v-if="row.project_deleted" size="small" type="danger">已删除</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="素材" min-width="180">
              <template #default="{ row }">{{ row.original_name || (row.media_kind === 'video' ? '视频' : '图片') }}</template>
            </el-table-column>
            <el-table-column label="类型" width="90">
              <template #default="{ row }">{{ row.media_kind === 'video' ? '视频' : '图片' }}</template>
            </el-table-column>
            <el-table-column label="提示词" min-width="280">
              <template #default="{ row }">{{ row.result_prompt || '还没有提示词' }}</template>
            </el-table-column>
            <el-table-column label="工作流" min-width="180">
              <template #default="{ row }">{{ row.workflow_name || '—' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" :disabled="row.project_deleted" @click="openPrompt(row)">打开项目</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!promptRows.length" description="还没有保存的提示词" />
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-drawer v-model="drawerOpen" :title="drawerTitle" size="640px" append-to-body destroy-on-close>
      <div v-if="detail" style="display: grid; gap: 12px;">
        <p style="margin: 0; color: #5c6b62;">
          {{ detail.project_name || '项目已不在' }}
          <template v-if="detail.snapshot_title"> · {{ detail.snapshot_title }}</template>
          <template v-if="detail.shot_code"> · {{ detail.shot_code }}</template>
          · {{ mediaLabel(detail.media_kind) }} · {{ stageLabel(detail.version_stage) }}
        </p>
        <MediaFileList :items="[fileItem(detail)]" :show-name="false" />
        <article v-if="detail.task" style="display: grid; gap: 10px;">
          <header style="display: flex; gap: 12px; align-items: baseline;">
            <strong>{{ taskKindLabel(detail.task) }} · {{ statusLabel(detail.task.status) }}</strong>
            <span style="color: #5c6b62;">记录 #{{ detail.task.id }}</span>
          </header>
          <dl style="display: grid; gap: 10px; margin: 0;">
            <div style="display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px;">
              <dt style="margin: 0; color: #5c6b62;">工作流</dt>
              <dd style="margin: 0;">
                {{ generation.workflow_name || '没有记下名称' }}
                <template v-if="generation.workflow_id"> · #{{ generation.workflow_id }}</template>
              </dd>
            </div>
            <div style="display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px;">
              <dt style="margin: 0; color: #5c6b62;">涉及资产</dt>
              <dd style="margin: 0;">
                <template v-if="generation.assets && generation.assets.length">
                  <span v-for="asset in generation.assets" :key="asset.id || asset.name" style="margin-right: 8px;">{{ assetKindLabel(asset.kind) }}「{{ asset.name }}」</span>
                </template>
                <template v-else-if="generation.assets_recorded">这次生成没有关联资产</template>
                <template v-else>这次生成没有记下涉及资产</template>
              </dd>
            </div>
            <div style="display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px;">
              <dt style="margin: 0; color: #5c6b62;">提交的提示词</dt>
              <dd style="margin: 0;"><pre :style="promptStyle">{{ generation.positive || '没有留下提交时的提示词' }}</pre></dd>
            </div>
            <div style="display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px;">
              <dt style="margin: 0; color: #5c6b62;">负向提示词</dt>
              <dd style="margin: 0;"><pre :style="promptStyle">{{ generation.negative || '无' }}</pre></dd>
            </div>
            <div style="display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: 8px;">
              <dt style="margin: 0; color: #5c6b62;">生成参数</dt>
              <dd style="margin: 0;">
                种子 {{ generation.seed ?? '未记' }}
                · 时长 {{ durationText }}
                · 操作人 {{ detail.task.operator_name || '未记' }}
                <template v-if="detail.task.model_profile"> · 模型 {{ detail.task.model_profile }}</template>
              </dd>
            </div>
          </dl>
          <p v-if="detail.task.error_message" style="margin: 0; color: #c45656;">{{ detail.task.error_message }}</p>
        </article>
        <p v-else style="margin: 0; color: #5c6b62;">这条产物来自合成成片，没有单镜头生成记录。</p>
      </div>
    </el-drawer>
  </PageShell>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { WarningFilled } from '@element-plus/icons-vue';
import MediaFileList from '../components/MediaFileList.vue';
import PageShell from '../components/PageShell.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';
import { taskKindLabel } from '../lib/taskKind.js';

const rows = ref([]);
const promptRows = ref([]);
const tableRef = ref(null);
const selected = ref([]);
const loading = ref(true);
const loadError = ref('');
const page = ref(1);
const pageSize = 20;
const section = ref('media');
const mediaKind = ref('');
const taskType = ref('');
const shotQuery = ref('');
const filterTick = ref(0);
const drawerOpen = ref(false);
const detail = ref(null);
const promptStyle = {
  maxHeight: '220px',
  margin: 0,
  padding: '8px 10px',
  overflow: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  background: '#f6f7f4',
  borderRadius: '6px',
  fontFamily: 'inherit',
  fontSize: '13px',
  lineHeight: 1.5,
};

const router = useRouter();
const filtered = computed(() => {
  const shot = shotQuery.value.trim().toLowerCase();
  return rows.value.filter(row => {
    if (mediaKind.value && row.media_kind !== mediaKind.value) return false;
    if (taskType.value && taskKindLabel(row.task) !== taskType.value) return false;
    if (!shot) return true;
    const code = String(row.shot_code || '').toLowerCase();
    const id = row.shot_id == null ? '' : String(row.shot_id);
    return code.includes(shot) || id === shot;
  });
});
const taskTypes = computed(() => {
  const found = new Set(rows.value.map(row => taskKindLabel(row.task)));
  return [ '文生视频[RefMod]', '首尾帧[RefMod]', '参考生视频[RefMod]', '文生视频', '首尾帧', '图生视频', '文生图', '改图', '成片', '[RefMod]' ]
    .filter(item => found.has(item));
});
const pageRows = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const emptyText = computed(() => {
  if (loadError.value) return loadError.value;
  if (rows.value.length) return '没有符合筛选的产物';
  return '还没有产物';
});
const drawerTitle = computed(() => (detail.value ? `产物 #${detail.value.id}` : '产物详情'));
const generation = computed(() => detail.value?.task?.generation || { assets: [] });
const durationText = computed(() => {
  const sec = Number(generation.value.duration_sec);
  if (sec > 0) return `${sec} 秒`;
  const ms = Number(detail.value?.duration_ms);
  if (ms > 0) return `成片 ${Math.round(ms / 1000)} 秒`;
  return '未记';
});

function mediaLabel(kind) {
  return { image: '图片', video: '视频', audio: '音频' }[kind] || kind || '文件';
}
function stageLabel(stage) {
  return { draft: '草稿', generated: '生成版', revised: '修改版', final: '最终交付版', frame_first: '视频首帧', frame_last: '视频尾帧' }[stage] || '生成版';
}
function statusLabel(status) {
  return { queued: '排队', running: '生成中', saving: '生成中', success: '成功', failed: '失败', cancelled: '已取消' }[status] || status;
}
function assetKindLabel(kind) {
  return { character: '人物', scene: '场景', prop: '道具' }[kind] || '资产';
}
function fileItem(output) {
  return {
    id: output.id,
    url: `${resolveApiBase()}/outputs/${output.id}/file`,
    kind: output.media_kind === 'video' ? 'video' : 'image',
    name: `${stageLabel(output.version_stage)} #${output.id}`,
    deletable: false,
  };
}
function rowSelectable(row) {
  if (!canMake()) return false;
  return ![ 'queued', 'running', 'saving' ].includes(row.task?.status);
}
function onSelect(list) {
  selected.value = list;
}
async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    rows.value = await request('/library/outputs') || [];
    promptRows.value = await request('/library/captions') || [];
    const maxPage = Math.max(1, Math.ceil(filtered.value.length / pageSize));
    if (page.value > maxPage) page.value = maxPage;
  } catch (err) {
    rows.value = [];
    loadError.value = err.message || '产物列表加载失败';
    ElMessage.error(loadError.value);
  } finally {
    loading.value = false;
  }
}
async function openDetail(row) {
  detail.value = row;
  drawerOpen.value = true;
  try {
    detail.value = await request(`/library/outputs/${row.id}`);
  } catch (err) {
    ElMessage.error(err.message || '产物详情加载失败');
  }
}
async function removeSelected() {
  const picked = selected.value.slice();
  if (!picked.length) return;
  try {
    await ElMessageBox.confirm(`删除选中的 ${picked.length} 条产物？文件会一并去掉。`, '批量删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    const result = await request('/outputs/batch-delete', {
      method: 'post',
      data: { ids: picked.map(row => row.id) },
    });
    const deleted = result?.deleted || [];
    const skipped = result?.skipped || [];
    if (detail.value && deleted.includes(detail.value.id)) drawerOpen.value = false;
    if (skipped.length) {
      ElMessage.warning(`已删除 ${deleted.length} 条，${skipped.length} 条没有删除：${skipped.map(item => `#${item.id} ${item.reason}`).join('；')}`);
    } else {
      ElMessage.success(`已删除 ${deleted.length} 条`);
    }
    await load();
    await nextTick();
    tableRef.value?.clearSelection();
    selected.value = [];
  } catch (err) {
    ElMessage.error(err.message || '删除失败');
  }
}
async function removeRow(row) {
  try {
    await ElMessageBox.confirm(`删除产物 #${row.id}？文件会一并去掉。`, '删除产物', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await request(`/outputs/${row.id}`, { method: 'delete' });
    if (detail.value?.id === row.id) drawerOpen.value = false;
    ElMessage.success('产物已删除');
    await load();
  } catch (err) {
    ElMessage.error(err.message || '删除失败');
  }
}
function openPrompt(row) {
  router.push({ path: `/projects/${row.project_id}`, query: { tab: '5' } });
}
function refreshFilter() {
  filterTick.value += 1;
  page.value = 1;
  tableRef.value?.clearSelection();
}
onMounted(load);
</script>

<style scoped>
.cartoon-output-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.cartoon-output-bar__delete { margin-left: auto; }
.cartoon-output-ids {
  display: grid;
  gap: 2px;
  color: #5c6b62;
  font-size: 12px;
  line-height: 1.4;
}
.cartoon-output-ops {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.cartoon-output-ops__warn {
  margin-left: 2px;
  font-size: 16px;
  vertical-align: middle;
}
.cartoon-output-pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
