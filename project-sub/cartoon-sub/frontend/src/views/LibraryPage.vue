<template>
  <PageShell :title="page.title" :loading="loading">
    <template v-if="route.name === 'assets'" #extra>
      <el-button type="primary" @click="openRegister">公共资产登记</el-button>
    </template>
    <p class="cartoon-module__hint">{{ page.hint }}</p>
    <p v-if="route.name === 'assets'" class="cartoon-module__hint">
      <router-link v-for="item in assetLinks" :key="item.kind" :to="`/assets/${item.kind}`">{{ item.label }}</router-link>
    </p>
    <div v-if="route.name === 'assets'" class="cartoon-toolbar">
      <el-select
        v-model="projectFilter"
        clearable
        filterable
        placeholder="按项目筛选"
        style="width: 240px"
      >
        <el-option v-for="item in projects" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>
    <el-empty v-if="!rows.length" :description="emptyText" />
    <el-table v-else :data="rows">
      <template v-for="(column, index) in page.columns" :key="column.prop">
        <el-table-column v-if="column.prop === 'reference_path'" label="参考图" width="88">
          <template #default="{ row }"><span @click.stop><AssetThumb :path="row.reference_path" /></span></template>
        </el-table-column>
        <el-table-column v-else-if="column.prop === 'voice_key'" label="音色" min-width="180">
          <template #default="{ row }">
            <span>{{ voiceName(row.voice_key) }}</span>
            <el-button
              v-if="row.kind === 'character' && row.project_id && row.source !== 'library'"
              link
              type="primary"
              @click="openVoiceEdit(row)"
            >选择</el-button>
          </template>
        </el-table-column>
        <el-table-column v-else-if="column.switch" :label="column.label" width="120">
          <template #default="{ row }">
            <el-switch :model-value="!!row.is_public" :before-change="() => onPublicSwitch(row)" />
          </template>
        </el-table-column>
        <el-table-column
          v-else
          :prop="column.prop"
          :label="column.label"
          :fixed="index === 0 ? 'left' : undefined"
        />
      </template>
      <el-table-column v-if="page.link" label="项目" width="140" :fixed="page.columns.length ? undefined : 'left'">
        <template #default="{ row }">
          <router-link v-if="row.project_id || route.name === 'versions'" :to="`/projects/${row.project_id || row.id}`">打开</router-link>
          <span v-else-if="route.name === 'assets'">公共</span>
          <router-link v-if="route.name === 'reviews'" :to="`/reviews/${row.id}`">记录</router-link>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="voiceEditOpen" title="选择音色" size="520px" append-to-body>
      <p class="cartoon-module__hint">{{ voiceEditRow?.name || '人物' }} 的音色。保存后，生成视频时如果工作流有音色入口，会把这条音色写进去。</p>
      <CharacterVoiceField v-model="voiceEditKey" />
      <div class="cartoon-entry-actions">
        <el-button type="primary" :loading="voiceSaving" @click="saveVoice">保存</el-button>
      </div>
    </el-drawer>

    <el-drawer v-model="drawerOpen" title="公共资产登记" size="640px" append-to-body>
      <p class="cartoon-module__hint">角色和场景默认作为公共资产。关闭公共标识后，需要绑定到一个已有项目。</p>
      <el-form label-position="top" class="cartoon-entry-form" @submit.prevent="createShared">
        <div class="cartoon-entry-grid">
          <el-form-item label="名称"><el-input v-model="shared.name" /></el-form-item>
          <el-form-item label="类型">
            <el-select v-model="shared.kind" style="width: 100%" @change="onKindChange">
              <el-option label="角色" value="character" />
              <el-option label="场景" value="scene" />
              <el-option label="道具" value="prop" />
              <el-option label="配音" value="voice" />
              <el-option label="品牌" value="brand" />
            </el-select>
          </el-form-item>
          <el-form-item class="is-wide" label="描述">
            <el-input v-model="shared.description" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item class="is-wide" label="公共资产">
            <div class="cartoon-public-switch">
              <el-switch :model-value="shared.isPublic" :before-change="beforeDrawerPublic" />
              <span v-if="shared.isPublic">当前为公共资产</span>
              <template v-else>
                <span>已绑定：{{ boundProjectName }}</span>
                <el-button link type="primary" @click="rebindDraft">更换项目</el-button>
              </template>
            </div>
          </el-form-item>
        </div>
        <div class="cartoon-entry-actions">
          <el-button type="primary" :loading="saving" @click="createShared">登记</el-button>
        </div>
      </el-form>
    </el-drawer>

    <el-dialog
      v-model="bindOpen"
      title="绑定项目"
      width="480px"
      append-to-body
      :close-on-click-modal="false"
      @closed="onBindClosed"
    >
      <p class="cartoon-module__hint">关闭公共资产后，选择一个已有项目进行绑定。</p>
      <el-select v-model="bindProjectId" filterable placeholder="选择项目" style="width: 100%">
        <el-option v-for="item in projects" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
      <template #footer>
        <el-button @click="cancelBind">取消</el-button>
        <el-button type="primary" :disabled="!bindProjectId" @click="confirmBind">绑定</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import AssetThumb from '../components/AssetThumb.vue';
import CharacterVoiceField from '../components/CharacterVoiceField.vue';
import { useRegionLoad } from '../lib/useRegionLoad.js';
import { request } from '../services/apiConfig.js';

const route = useRoute();
const rows = ref([]);
const projects = ref([]);
const projectFilter = ref(null);
const drawerOpen = ref(false);
const saving = ref(false);
const bindOpen = ref(false);
const voiceCatalog = ref([]);
const voiceEditOpen = ref(false);
const voiceEditRow = ref(null);
const voiceEditKey = ref('');
const voiceSaving = ref(false);
const bindProjectId = ref(null);
let bindResolver = null;
const shared = reactive({
  name: '',
  kind: 'character',
  description: '',
  isPublic: true,
  project_id: null,
});
const assetLinks = [
  { kind: 'characters', label: '角色' },
  { kind: 'scenes', label: '场景' },
  { kind: 'props', label: '道具' },
  { kind: 'voices', label: '配音' },
  { kind: 'materials', label: '素材' },
  { kind: 'brands', label: '品牌' },
];
const titles = {
  characters: '角色',
  scenes: '场景',
  props: '道具',
  voices: '配音',
  materials: '素材',
  brands: '品牌',
};
const kindByRoute = {
  characters: 'character',
  scenes: 'scene',
  props: 'prop',
  voices: 'voice',
  brands: 'brand',
};
const page = computed(() => {
  if (route.name === 'assets') {
    return {
      title: titles[route.params.kind] || '资产',
      hint: '按分类查看各项目登记的资产。素材包含背景音乐、音效、字幕样式和转场。品牌字体和视觉规范写在项目面板里。',
      api: `/library/assets/${route.params.kind}`,
      link: true,
      columns: [
        { prop: 'name', label: '名称' },
        { prop: 'project_name', label: '项目' },
        { prop: 'reference_path', label: '参考图' },
        { prop: 'voice_key', label: '音色' },
        { prop: 'prop_category', label: '道具分类' },
        { prop: 'voice_lang', label: '语种' },
        { prop: 'speaker_name', label: '发音人' },
        { prop: 'angle_paths', label: '多角度' },
        { prop: 'is_public', label: '公共资产', switch: true },
      ],
    };
  }
  if (route.name === 'batches') {
    return {
      title: '批量',
      hint: '各项目的选题批次。推进仍在项目里进行。',
      api: '/library/batches',
      link: true,
      columns: [
        { prop: 'project_name', label: '项目' },
        { prop: 'status', label: '状态' },
        { prop: 'success_count', label: '成功' },
        { prop: 'failed_count', label: '失败' },
      ],
    };
  }
  if (route.name === 'reviews') {
    return {
      title: '审核',
      hint: '通过和驳回记录。处理仍回到对应项目。',
      api: '/library/reviews',
      link: true,
      columns: [
        { prop: 'project_name', label: '项目' },
        { prop: 'decision', label: '结果' },
        { prop: 'node', label: '节点' },
        { prop: 'note', label: '原因' },
      ],
    };
  }
  if (route.name === 'versions') {
    return {
      title: '版本',
      hint: '每个视频项目钉扎的故事包版本。旧项目保持未钉扎。',
      api: '/library/versions',
      link: true,
      columns: [
        { prop: 'name', label: '项目' },
        { prop: 'content_type', label: '类型' },
        { prop: 'pin_mode', label: '钉扎' },
        { prop: 'package_version', label: '版本' },
        { prop: 'stage_summary', label: '成片阶段' },
      ],
    };
  }
  return {
    title: '导出',
    hint: '已有成片工程，以及只登记、不重新编码的导出规格。',
    api: '/library/exports',
    link: true,
    columns: [
      { prop: 'project_name', label: '项目' },
      { prop: 'title', label: '成片' },
      { prop: 'status', label: '状态' },
      { prop: 'width', label: '宽' },
      { prop: 'height', label: '高' },
    ],
  };
});
const emptyText = computed(() => (
  route.name === 'assets' && projectFilter.value ? '这个项目下还没有资产' : '还没有记录'
));
const boundProjectName = computed(() => (
  projects.value.find(item => item.id === shared.project_id)?.name || '未选择'
));

function settleBind(projectId) {
  const resolve = bindResolver;
  bindResolver = null;
  resolve?.(projectId || null);
  bindOpen.value = false;
}
function onBindClosed() {
  if (bindResolver) settleBind(null);
}
function confirmBind() {
  if (!bindProjectId.value) return;
  settleBind(bindProjectId.value);
}
function cancelBind() {
  settleBind(null);
}
async function ensureProjects() {
  if (projects.value.length) return projects.value;
  projects.value = await request('/projects') || [];
  return projects.value;
}
async function askProject(currentId) {
  try {
    await ensureProjects();
  } catch (err) {
    ElMessage.error(err.message);
    return null;
  }
  if (!projects.value.length) {
    ElMessage.warning('还没有可绑定的项目');
    return null;
  }
  if (bindResolver) settleBind(null);
  const current = Number(currentId) || null;
  bindProjectId.value = projects.value.some(item => item.id === current) ? current : null;
  bindOpen.value = true;
  return new Promise(resolve => {
    bindResolver = resolve;
  });
}
function voiceName(key) {
  if (!key) return '—';
  const item = voiceCatalog.value.find(row => row.voice_key === key);
  if (!item) return '已选音色';
  return item.folder ? `${item.folder} / ${item.name}` : item.name;
}
function openVoiceEdit(row) {
  voiceEditRow.value = row;
  voiceEditKey.value = row.voice_key || '';
  voiceEditOpen.value = true;
}
async function saveVoice() {
  const row = voiceEditRow.value;
  if (!row?.project_id || !row.id) return;
  voiceSaving.value = true;
  try {
    await request(`/projects/${row.project_id}/assets/${row.id}`, {
      method: 'put',
      data: {
        name: row.name,
        kind: row.kind || 'character',
        description: row.description || '',
        reference_path: row.reference_path || '',
        character_id: row.character_id || '',
        voice_key: voiceEditKey.value || '',
        speech_rate: row.speech_rate || '',
        emotion: row.emotion || '',
        consistency_note: row.consistency_note || '',
        scene_type: row.scene_type || '',
        front_path: row.front_path || '',
        side_path: row.side_path || '',
        back_path: row.back_path || '',
        expression_note: row.expression_note || '',
        costume_note: row.costume_note || '',
        lora_ref: row.lora_ref || '',
        angle_paths: row.angle_paths || '',
        prop_category: row.prop_category || '',
        voice_lang: row.voice_lang || '',
        speaker_name: row.speaker_name || '',
      },
    });
    voiceEditOpen.value = false;
    ElMessage.success('音色已保存');
    await load();
  } catch (err) {
    ElMessage.error(err.message || '音色没有保存');
  } finally {
    voiceSaving.value = false;
  }
}
function defaultKind() {
  return kindByRoute[route.params.kind] || 'character';
}
function publicByKind(kind) {
  return kind === 'character' || kind === 'scene';
}
function openRegister() {
  const kind = defaultKind();
  shared.name = '';
  shared.description = '';
  shared.kind = kind;
  shared.isPublic = publicByKind(kind);
  shared.project_id = null;
  drawerOpen.value = true;
  ensureProjects().catch(() => {});
}
function onKindChange(kind) {
  if (publicByKind(kind)) shared.isPublic = true;
}
async function beforeDrawerPublic() {
  if (!shared.isPublic) {
    shared.isPublic = true;
    return false;
  }
  const projectId = await askProject(shared.project_id);
  if (!projectId) return false;
  shared.project_id = projectId;
  shared.isPublic = false;
  return false;
}
async function rebindDraft() {
  const projectId = await askProject(shared.project_id);
  if (projectId) shared.project_id = projectId;
}
async function onPublicSwitch(row) {
  try {
    if (row.is_public) {
      const projectId = await askProject(row.project_id);
      if (!projectId) return false;
      if (row.source === 'library') {
        await request(`/library/shared/${row.id}/bind`, { method: 'post', data: { project_id: projectId } });
      } else {
        await request(`/library/assets/${row.id}/visibility`, {
          method: 'post',
          data: { public: false, project_id: projectId },
        });
      }
      ElMessage.success('已绑定到项目');
    } else {
      await request(`/library/assets/${row.id}/visibility`, { method: 'post', data: { public: true } });
      ElMessage.success('已设为公共资产');
    }
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
  return false;
}
async function createShared() {
  const name = String(shared.name || '').trim();
  if (!name) {
    ElMessage.warning('需要资产名称');
    return;
  }
  let projectId = shared.project_id;
  if (!shared.isPublic && !projectId) {
    projectId = await askProject();
    if (!projectId) return;
    shared.project_id = projectId;
  }
  saving.value = true;
  try {
    const row = await request('/library/shared', {
      method: 'post',
      data: {
        name,
        kind: shared.kind,
        description: shared.description,
        public: shared.isPublic,
        project_id: shared.isPublic ? undefined : projectId,
      },
    });
    shared.name = '';
    shared.description = '';
    drawerOpen.value = false;
    ElMessage.success(row?.id ? `已登记，编号 ${row.id}` : '已登记');
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
const { loading, run } = useRegionLoad({ immediate: true });
async function load() {
  await run(async () => {
    try {
      if (route.name === 'assets') {
        try {
          projects.value = await request('/projects') || [];
        } catch (err) {
          projects.value = [];
          ElMessage.error(err.message);
        }
        try {
          const voices = await request('/voice-library');
          voiceCatalog.value = voices?.rows || [];
        } catch (err) {
          voiceCatalog.value = [];
          ElMessage.error(err.message || '音色库没有打开');
        }
      }
      const projectId = route.name === 'assets' ? (Number(projectFilter.value) || null) : null;
      rows.value = await request(page.value.api, { params: projectId ? { project_id: projectId } : {} }) || [];
    } catch (err) {
      rows.value = [];
      ElMessage.error(err.message);
    }
  });
}
watch(() => route.fullPath, () => {
  load();
}, { immediate: true });
watch(projectFilter, () => {
  if (route.name === 'assets') load();
});
</script>

<style scoped>
.cartoon-public-switch {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  color: var(--cartoon-color-muted);
  font-size: 13px;
}
</style>
