<template>
  <div v-if="!project" class="cartoon-workbench cartoon-workbench--boot">
    <LoadMask :loading="entryLoading" />
    <p v-if="error && !entryLoading" class="cartoon-module__hint">{{ error }}</p>
  </div>
  <div v-else class="cartoon-workbench">
    <aside class="cartoon-workbench__nav">
      <el-button link type="primary" @click="router.push(`/projects/${projectId}`)">← 返回项目</el-button>
      <h1>{{ project.name }}</h1>
      <p>{{ episodeTitle }}</p>
      <p v-if="pinLabel" class="cartoon-workbench__pin">{{ pinLabel }}</p>
      <button
        v-for="item in nodes"
        :key="item.id"
        type="button"
        class="cartoon-workbench__node"
        :class="{ 'is-active': node === item.id }"
        @click="selectNode(item.id)"
      >
        <i class="cartoon-workbench__dot" :class="`is-${nodeMark(item.id)}`" />
        {{ item.title }}
      </button>
    </aside>
    <RegionLoad class="cartoon-workbench__main" :loading="entryLoading || voiceLoading">
      <section v-if="customNodes.length || episode?.warning" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">专项检查</h3>
        <p v-if="episode?.warning" class="cartoon-module__hint">{{ episode.warning }}</p>
        <div class="cartoon-toolbar">
          <el-button v-for="item in customNodes" :key="item.node_key" @click="runCustom(item)">运行{{ item.title }}</el-button>
        </div>
      </section>
      <ProjectDetailPage v-if="scriptStep" :forced-step="scriptStep" :nav-target="navTarget" :launch-shot-id="launchShotId" />
      <section v-else-if="node === 'assets'" class="cartoon-module cartoon-asset-page">
        <div class="cartoon-asset-head">
          <h3 class="cartoon-module__title">资产</h3>
          <el-button type="primary" @click="openAssetCreate">新增</el-button>
        </div>
        <p class="cartoon-module__hint">点一行打开编辑。新增会清空表单。角色、场景和道具的 RefMod 就在这个抽屉里，每张图写一句说明。</p>
        <el-tabs v-model="assetTab" class="cartoon-asset-tabs">
          <el-tab-pane label="资产清单" name="list">
        <el-empty v-if="!assets.length" description="还没有资产" />
        <el-table v-else :data="assets" size="small" highlight-current-row class="cartoon-asset-table" @row-click="openAssetEdit">
          <el-table-column label="类型" width="80" fixed="left">
            <template #default="{ row }">{{ assetKind(row.kind) }}</template>
          </el-table-column>
          <el-table-column prop="name" label="名称" width="140" />
          <el-table-column prop="description" label="描述" />
          <el-table-column prop="character_id" label="人物编号" width="120" />
          <el-table-column prop="scene_type" label="场景类型" width="100" />
          <el-table-column prop="angle_paths" label="多角度" min-width="140" />
          <el-table-column prop="prop_category" label="道具分类" width="100" />
          <el-table-column prop="voice_lang" label="语种" width="80" />
          <el-table-column prop="speaker_name" label="发音人" width="100" />
          <el-table-column label="三视图" min-width="160">
            <template #default="{ row }">{{ [ row.front_path, row.side_path, row.back_path ].filter(Boolean).join(' / ') }}</template>
          </el-table-column>
          <el-table-column prop="reference_path" label="参考图" />
          <el-table-column prop="voice_key" label="音色" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">{{ row.disabled ? '已停用' : '使用中' }}</template>
          </el-table-column>
          <el-table-column label="" width="120">
            <template #default="{ row }">
              <el-button v-if="!row.disabled" link type="danger" @click.stop="disableAsset(row)">停用</el-button>
              <el-button link type="danger" @click.stop="removeAsset(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <p v-if="staleShots.length" class="cartoon-module__hint">资产已更新，这些镜头已经出过画面，不会自动重跑：{{ staleShots.map(item => item.shot_code || item.id).join('、') }}</p>
          </el-tab-pane>
          <el-tab-pane label="镜头绑定" name="bind">
        <div class="cartoon-toolbar">
          <el-input v-model="sharedAssetId" placeholder="共享资产编号" style="width: 180px" />
          <el-button @click="linkShared">引用共享资产</el-button>
          <el-button @click="matchAssets">同名匹配</el-button>
          <el-button @click="suggestAssets">请技能建议</el-button>
          <el-button type="primary" :disabled="!assetSuggestions.length" @click="applyAssets">写入绑定</el-button>
        </div>
        <el-table :data="bindingRows" size="small">
          <el-table-column prop="shot_code" label="镜头" width="120" fixed="left" />
          <el-table-column prop="asset_name" label="资产名称" width="160" />
          <el-table-column prop="asset_kind" label="类型" width="90" />
          <el-table-column prop="reason" label="原因" />
        </el-table>
        <el-table v-if="suggestionRows.length" :data="suggestionRows" size="small">
          <el-table-column prop="shot_code" label="镜头" width="120" fixed="left" />
          <el-table-column prop="asset_name" label="资产名称" width="160" />
          <el-table-column prop="reason" label="原因" />
        </el-table>
          </el-tab-pane>
        </el-tabs>
        <el-drawer v-model="assetDrawerOpen" :title="editingAssetId ? '编辑资产' : '新增资产'" size="640px" append-to-body>
        <RegionLoad pane>
        <el-form label-position="top" class="cartoon-entry-form" @submit.prevent="editingAssetId ? saveAsset() : createAsset()">
          <div class="cartoon-entry-grid">
            <el-form-item label="名称"><el-input v-model="assetForm.name" /></el-form-item>
            <el-form-item label="类型">
              <el-select v-model="assetForm.kind" style="width: 100%">
                <el-option label="角色" value="character" />
                <el-option label="场景" value="scene" />
                <el-option label="道具" value="prop" />
                <el-option label="配音" value="voice" />
                <el-option label="背景音乐" value="bgm" />
                <el-option label="音效" value="sfx" />
                <el-option label="字幕样式" value="subtitle_style" />
                <el-option label="转场" value="transition" />
              </el-select>
            </el-form-item>
            <el-form-item class="is-wide" label="描述">
              <el-input v-model="assetForm.description" type="textarea" :rows="2" />
            </el-form-item>
            <template v-if="assetForm.kind === 'character'">
              <p class="cartoon-entry-label">角色</p>
              <el-form-item v-if="editingAssetId" label="人物编号"><el-input v-model="assetForm.character_id" /></el-form-item>
              <el-form-item label="一致性备注"><el-input v-model="assetForm.consistency_note" /></el-form-item>
              <el-form-item label="正面图"><AssetImageField v-model="assetForm.front_path" :project-id="projectId" /></el-form-item>
              <el-form-item label="侧面图"><AssetImageField v-model="assetForm.side_path" :project-id="projectId" /></el-form-item>
              <el-form-item label="背面图"><AssetImageField v-model="assetForm.back_path" :project-id="projectId" /></el-form-item>
              <el-form-item class="is-wide" label="参考图">
                <AssetImageField v-model="assetForm.reference_path" :project-id="projectId" />
              </el-form-item>
              <el-form-item label="表情"><el-input v-model="assetForm.expression_note" /></el-form-item>
              <el-form-item label="服装"><el-input v-model="assetForm.costume_note" /></el-form-item>
              <el-form-item class="is-wide" label="LoRA 引用"><el-input v-model="assetForm.lora_ref" /></el-form-item>
            </template>
            <template v-else-if="assetForm.kind === 'scene'">
              <p class="cartoon-entry-label">场景</p>
              <el-form-item label="场景类型">
                <el-select v-model="assetForm.scene_type" placeholder="选择类型" style="width: 100%">
                  <el-option v-for="item in sceneTypes" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
              <el-form-item class="is-wide" label="多角度图片">
                <AssetImageField v-model="assetForm.angle_paths" :project-id="projectId" multiple />
              </el-form-item>
            </template>
            <template v-else-if="assetForm.kind === 'prop'">
              <p class="cartoon-entry-label">道具</p>
              <el-form-item label="道具分类">
                <el-select v-model="assetForm.prop_category" placeholder="选择分类" style="width: 100%">
                  <el-option v-for="item in propCategories" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
            </template>
            <template v-else-if="assetForm.kind === 'voice'">
              <p class="cartoon-entry-label">配音</p>
              <el-form-item label="音色标识"><el-input v-model="assetForm.voice_key" /></el-form-item>
              <el-form-item label="语速"><el-input v-model="assetForm.speech_rate" /></el-form-item>
              <el-form-item label="情绪"><el-input v-model="assetForm.emotion" /></el-form-item>
              <el-form-item label="语种"><el-input v-model="assetForm.voice_lang" /></el-form-item>
              <el-form-item label="发音人"><el-input v-model="assetForm.speaker_name" /></el-form-item>
            </template>
            <template v-else-if="assetForm.kind === 'bgm' || assetForm.kind === 'sfx'">
              <el-form-item class="is-wide" label="文件路径"><el-input v-model="assetForm.reference_path" /></el-form-item>
            </template>
          </div>
          <el-form-item v-if="[ 'character', 'scene', 'prop' ].includes(assetForm.kind)" class="is-wide" label="RefMod 图集">
            <RefModPacks
              ref="refmodEditor"
              variant="editor"
              :project-id="projectId"
              :asset-id="editingAssetId"
              :asset-name="assetForm.name"
              :asset-kind="assetForm.kind"
            />
          </el-form-item>
          <div class="cartoon-entry-actions">
            <el-button v-if="!editingAssetId" type="primary" @click="createAsset">创建</el-button>
            <el-button v-else type="primary" @click="saveAsset">保存</el-button>
          </div>
        </el-form>
        </RegionLoad>
        </el-drawer>
      </section>
      <section v-else-if="node === 'voice'" class="cartoon-module cartoon-voice-page">
        <div class="cartoon-asset-head">
          <h3 class="cartoon-module__title">配音</h3>
          <el-button type="primary" :disabled="!selectedVoice || !voiceShotIds.length" @click="assignLibraryVoice">用这个音色配音</el-button>
        </div>
        <p class="cartoon-module__hint">先在音色库里试听，选定一条后勾选有台词的镜头。配音会把这条音色登记到项目，并写上这些镜头的时间轴。试听播放的是样本，不是这条台词的成片。</p>
        <p v-if="voiceSkipped.length" class="cartoon-module__hint">这些分组的文件名过长，读不到：{{ voiceSkipped.join('、') }}</p>
        <div class="cartoon-voice">
          <div class="cartoon-voice__library">
            <div class="cartoon-toolbar">
              <el-input v-model="voiceQuery" clearable placeholder="搜索音色" style="width: 180px" />
              <el-select v-model="voiceFolder" clearable placeholder="全部分组" style="width: 180px">
                <el-option v-for="folder in voiceFolders" :key="folder" :label="folder" :value="folder" />
              </el-select>
            </div>
            <el-table
              :data="voicePageRows"
              size="small"
              highlight-current-row
              class="cartoon-voice-table"
              @row-click="selectLibraryVoice"
            >
              <el-table-column prop="name" label="音色" min-width="140" fixed="left" />
              <el-table-column prop="folder" label="分组" width="140" show-overflow-tooltip />
              <el-table-column label="" width="72">
                <template #default="{ row }">
                  <el-button link type="primary" @click.stop="previewLibraryVoice(row)">试听</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-pagination
              v-model:current-page="voicePage"
              class="cartoon-pager"
              :page-size="10"
              :total="voiceFiltered.length"
              layout="total, prev, pager, next"
            />
            <audio ref="voiceAudio" class="cartoon-voice-player" controls></audio>
            <p v-if="selectedVoice" class="cartoon-module__hint">已选 {{ selectedVoice.folder }} / {{ selectedVoice.name }}</p>
          </div>
          <div class="cartoon-voice__shots">
            <el-table :data="spokenShots" size="small" @selection-change="voiceShotIds = $event.map(item => item.id)">
              <el-table-column type="selection" width="42" fixed="left" />
              <el-table-column prop="shot_code" label="镜头" width="110" />
              <el-table-column label="台词" min-width="180">
                <template #default="{ row }"><ClampText title="台词" :text="row.dialogue || ''" /></template>
              </el-table-column>
              <el-table-column label="当前音色" width="140">
                <template #default="{ row }">{{ voiceNameOf(row.id) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </section>
      <section v-else-if="node === 'subtitle'" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">字幕</h3>
        <p class="cartoon-module__hint">用镜头台词和已登记的字幕样式排时间轴，不调用技能。节点未启用时不能排。</p>
        <div class="cartoon-toolbar">
          <el-button type="primary" @click="buildSubtitles">按台词排时间轴</el-button>
        </div>
      </section>
      <section v-else-if="node === 'review'" class="cartoon-module cartoon-workbench__note">
        <h3 class="cartoon-module__title">AI 初审</h3>
        <p class="cartoon-module__hint">初审只列出问题。通过或驳回仍在人工确认里完成。</p>
        <div class="cartoon-toolbar">
          <el-button @click="suggestReview">请技能建议</el-button>
          <el-button type="primary" :disabled="!reviewSuggestions.length" @click="applyReview">记下问题</el-button>
        </div>
        <el-table v-if="findings.length" :data="findings" size="small">
          <el-table-column prop="level" label="级别" width="90" fixed="left" />
          <el-table-column prop="message" label="问题" />
          <el-table-column prop="node" label="回到" width="100" />
        </el-table>
      </section>
      <template v-else-if="node === 'preview'">
        <section v-if="!shotQuery" class="cartoon-module cartoon-workbench__note">
          <h3 class="cartoon-module__title">选择镜头</h3>
          <el-empty v-if="!shots.length" description="还没有镜头">
            <el-button type="primary" @click="selectNode('storyboard')">去镜头</el-button>
          </el-empty>
          <el-table v-else class="cartoon-preview-table" :data="previewPageRows" @row-click="pickShot">
            <el-table-column prop="shot_code" label="镜头" width="130" fixed="left" />
            <el-table-column prop="chapter_title" label="章节" width="220" show-overflow-tooltip />
            <el-table-column label="描述" width="560">
              <template #default="{ row }"><ClampText title="描述" :text="row.description || ''" /></template>
            </el-table-column>
            <el-table-column label="景别" width="160">
              <template #default="{ row }">{{ (row.shot_sizes || []).join('、') || row.shot_size || '—' }}</template>
            </el-table-column>
            <el-table-column label="运镜" width="180">
              <template #default="{ row }">{{ (row.camera_moves || []).join('、') || row.camera_move || '—' }}</template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click.stop="pickShot(row)">查看产物</el-button>
                <el-button link type="primary" :disabled="!workflowTasks(row).length" @click.stop="openWorkflow(row)">查看工作流</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-if="previewShots.length"
            v-model:current-page="previewPage"
            class="cartoon-pager"
            :page-size="10"
            :total="previewShots.length"
            layout="total, prev, pager, next"
          />
        </section>
        <ShotOutputsPage v-if="shotQuery" :key="`preview-${shotQuery}`" />
      </template>
      <template v-else-if="node === 'compose' || node === 'export'">
        <ExportSpecs v-if="node === 'export'" class="cartoon-workbench__note" :project-id="projectId" />
        <p v-if="node === 'export'" class="cartoon-module__hint cartoon-workbench__note">已有成片仍用本页右上角「导出成片」。下面的规格会重新编码，有台词时烧进画面，长版可以混入背景音乐。</p>
        <ProjectEditPage />
      </template>
    </RegionLoad>
    <aside class="cartoon-workbench__side">
      <h2>这一集</h2>
      <p>类型 · {{ typeName }}</p>
      <p>画面 · {{ styleLabel || project.visual_style || '未选' }}</p>
      <p>钉扎 · {{ pinLabel || '未选择故事包' }}</p>
      <p>节点 · {{ nodeTitle }}</p>
    </aside>
    <el-dialog v-model="workflowOpen" :title="workflowTitle" width="760px" append-to-body destroy-on-close>
      <div v-if="workflowChoices.length > 1" class="cartoon-workflow-pick">
        <span>记录</span>
        <el-select v-model="workflowTaskId" style="width: 220px" @change="loadWorkflow">
          <el-option v-for="item in workflowChoices" :key="item.id" :label="`记录 #${item.id}`" :value="item.id" />
        </el-select>
      </div>
      <div class="cartoon-workflow-body">
        <pre v-if="!workflowLoading" class="cartoon-workflow-json">{{ workflowText }}</pre>
        <LoadMask :loading="workflowLoading" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import ProjectDetailPage from './ProjectDetailPage.vue';
import ClampText from '../components/ClampText.vue';
import ShotOutputsPage from './ShotOutputsPage.vue';
import ProjectEditPage from './ProjectEditPage.vue';
import ExportSpecs from '../components/ExportSpecs.vue';
import RefModPacks from '../components/RefModPacks.vue';
import AssetImageField from '../components/AssetImageField.vue';
import RegionLoad from '../components/RegionLoad.vue';
import LoadMask from '../components/LoadMask.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { isLocalType, typeLabel } from '../lib/contentTypes.js';
import { styleDisplayLabel } from '../utils/visualStyles.js';

const nodes = [
  { id: 'input', title: '输入与绑定' },
  { id: 'script', title: '剧本' },
  { id: 'storyboard', title: '镜头' },
  { id: 'assets', title: '资产' },
  { id: 'voice', title: '配音' },
  { id: 'subtitle', title: '字幕' },
  { id: 'review', title: '初审' },
  { id: 'compose', title: '合成' },
  { id: 'preview', title: '预览' },
  { id: 'export', title: '导出' },
];
const stepByNode = { input: 1, script: 2, storyboard: 4 };

const route = useRoute();
const router = useRouter();
const project = ref(null);
const entryLoading = ref(true);
const voiceLoading = ref(false);
let entryToken = 0;
const bundle = ref(null);
const episode = ref(null);
const shots = ref([]);
const styles = ref([]);
const error = ref('');
const sceneTypes = [ '室内', '室外', '城市', '自然', '古风', '品牌' ];
const propCategories = [ '服饰', '器物', '食物', '文书', '交通', '其他' ];
const editingAssetId = ref(null);
const assetDrawerOpen = ref(false);
const assetTab = ref('list');
const voiceRows = ref([]);
const voiceSkipped = ref([]);
const voiceFolders = ref([]);
const voiceQuery = ref('');
const voiceFolder = ref('');
const voicePage = ref(1);
const selectedVoice = ref(null);
const voicePreviewUrl = ref('');
const voiceAudio = ref(null);
const voiceShotIds = ref([]);
const refmodEditor = ref(null);
const launchShotId = ref('');
const navTarget = ref('');
const assetForm = reactive({
  name: '', kind: 'character', description: '', reference_path: '', character_id: '', voice_key: '', speech_rate: '', emotion: '',
  consistency_note: '', scene_type: '', front_path: '', side_path: '', back_path: '', expression_note: '', costume_note: '', lora_ref: '',
  angle_paths: '', prop_category: '', voice_lang: '', speaker_name: '',
});
const assets = computed(() => bundle.value?.assets || []);
const bindings = computed(() => bundle.value?.bindings || []);
const bindingRows = computed(() => bindings.value.map(item => {
  const asset = assets.value.find(row => String(row.id) === String(item.asset_id));
  const shot = shots.value.find(row => String(row.id) === String(item.shot_id));
  return {
    ...item,
    asset_name: asset?.name || '未找到资产',
    asset_kind: assetKind(asset?.kind),
    shot_code: shot?.shot_code || item.shot_id,
    reason: item.reason || '',
  };
}));
const suggestionRows = computed(() => assetSuggestions.value.map(item => {
  const asset = assets.value.find(row => String(row.id) === String(item.asset_id));
  const shot = shots.value.find(row => String(row.id) === String(item.shot_id));
  return {
    ...item,
    asset_name: asset?.name || item.asset_id,
    shot_code: shot?.shot_code || item.shot_id,
  };
}));
const voiceFiltered = computed(() => voiceRows.value.filter(item => {
  if (voiceFolder.value && item.folder !== voiceFolder.value) return false;
  const keyword = voiceQuery.value.trim();
  return !keyword || item.name.includes(keyword);
}));
const voicePageRows = computed(() => voiceFiltered.value.slice((voicePage.value - 1) * 10, voicePage.value * 10));
const spokenShots = computed(() => shots.value.filter(item => String(item.dialogue || '').trim()));
function voiceNameOf(shotId) {
  const cue = (bundle.value?.voice_cues || []).find(item => String(item.shot_id) === String(shotId));
  if (!cue) return '—';
  const asset = assets.value.find(item => item.kind === 'voice' && item.voice_key === cue.voice_key);
  return asset?.name || cue.voice_key;
}
const staleShots = computed(() => (bundle.value?.shots || []).filter(item => item.asset_stale));
const findings = computed(() => bundle.value?.review_findings || []);
const assetSuggestions = ref([]);
const voiceSuggestions = ref([]);
const reviewSuggestions = ref([]);
const customNodes = ref([]);
const sharedAssetId = ref('');
const requestAudio = ref(false);
const nodeTitle = computed(() => nodes.find(item => item.id === node.value)?.title || '');

const projectId = computed(() => route.params.id);
const node = computed(() => {
  const raw = String(route.query.node || episode.value?.current_node || 'input');
  const value = raw === 'generate' ? 'storyboard' : (raw === 'refmods' ? 'assets' : raw);
  return nodes.some(item => item.id === value) ? value : 'input';
});
const scriptStep = computed(() => stepByNode[node.value] || 0);
const shotQuery = computed(() => String(route.query.shot || ''));
const previewShots = computed(() => {
  const imports = bundle.value?.imports || [];
  return shots.value.map(item => {
    const chapter = imports.find(row => String(row.id) === String(item.import_id));
    return {
      ...item,
      chapter_title: chapter?.chapter_title || (item.import_id ? '未命名章节' : '未关联快照'),
    };
  });
});
const previewPage = ref(1);
const previewPageRows = computed(() => previewShots.value.slice((previewPage.value - 1) * 10, previewPage.value * 10));
watch(previewShots, (rows) => {
  const max = Math.max(1, Math.ceil(rows.length / 10));
  if (previewPage.value > max) previewPage.value = max;
});
const episodeTitle = computed(() => episode.value?.title || '第1集');
const typeName = computed(() => typeLabel(project.value?.content_type));
const styleLabel = computed(() => styleDisplayLabel(styles.value, project.value?.visual_style));
const pinLabel = computed(() => {
  if (project.value?.package_version) return `故事包 v${project.value.package_version}`;
  if (project.value?.pin_mode === 'legacy') return '未钉扎';
  if (project.value?.pin_mode === 'local') return '本地文案';
  if (project.value?.pin_mode === 'optional') return '可以不绑故事包';
  return '';
});

function assetKind(kind) {
  return { character: '角色', scene: '场景', prop: '道具', voice: '配音', bgm: '背景音乐', sfx: '音效', subtitle_style: '字幕样式', transition: '转场' }[kind] || kind;
}
async function runCustom(item) {
  try {
    const data = await request(`/projects/${projectId.value}/nodes/${item.node_key}/run`, { method: 'post', data: {} });
    const count = data?.findings?.length || 0;
    const text = data?.warning || data?.note || (count ? `记下 ${count} 条问题` : '这项检查没有发现问题');
    if (data?.warning) {
      ElMessage.warning(text);
      await load();
    } else {
      ElMessage.success(text);
    }
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function linkShared() {
  await runAction(async () => {
    await request(`/projects/${projectId.value}/assets/link`, {
      method: 'post',
      data: { library_asset_id: Number(sharedAssetId.value) },
    });
    sharedAssetId.value = '';
    ElMessage.success('已引用共享资产');
  });
}
function nodeMark(id) {
  const tasks = bundle.value?.tasks || [];
  const imports = (bundle.value?.imports || []).filter(item => !item.deleted_at);
  if (id === 'input') {
    if (project.value?.package_version) return 'ok';
    if (project.value?.pin_mode === 'local' || project.value?.pin_mode === 'optional') return 'ok';
    if (project.value?.pin_mode === 'legacy') return 'warn';
    return 'idle';
  }
  if (id === 'script') {
    if (isLocalType(project.value?.content_type)) return (bundle.value?.copy_blocks || []).length ? 'ok' : 'idle';
    return imports.length ? 'ok' : 'idle';
  }
  if (id === 'storyboard') return shots.value.length ? 'ok' : 'idle';
  if (id === 'assets') return assets.value.length ? 'ok' : 'idle';
  if (id === 'generate' || id === 'preview') {
    const latest = tasks[0];
    if (!latest) return 'idle';
    if ([ 'pending', 'queued', 'running', 'saving' ].includes(latest.status)) return 'run';
    if (latest.status === 'failed') return 'bad';
    if (latest.status === 'success') return 'ok';
  }
  return 'idle';
}
function assetPayload(includeCharacterId) {
  return {
    name: assetForm.name.trim(),
    kind: assetForm.kind,
    description: assetForm.description,
    reference_path: assetForm.reference_path,
    character_id: includeCharacterId ? assetForm.character_id : '',
    voice_key: assetForm.voice_key,
    speech_rate: assetForm.speech_rate,
    emotion: assetForm.emotion,
    consistency_note: assetForm.consistency_note,
    scene_type: assetForm.scene_type,
    front_path: assetForm.front_path,
    side_path: assetForm.side_path,
    back_path: assetForm.back_path,
    expression_note: assetForm.expression_note,
    costume_note: assetForm.costume_note,
    lora_ref: assetForm.lora_ref,
    angle_paths: assetForm.angle_paths,
    prop_category: assetForm.prop_category,
    voice_lang: assetForm.voice_lang,
    speaker_name: assetForm.speaker_name,
  };
}
function openAssetCreate() {
  resetAssetForm();
  assetDrawerOpen.value = true;
}
function openAssetEdit(row) {
  resetAssetForm();
  fillAsset(row);
  assetDrawerOpen.value = true;
}
function resetAssetForm() {
  editingAssetId.value = null;
  assetForm.name = '';
  assetForm.kind = 'character';
  assetForm.description = '';
  assetForm.reference_path = '';
  assetForm.character_id = '';
  assetForm.voice_key = '';
  assetForm.speech_rate = '';
  assetForm.emotion = '';
  assetForm.consistency_note = '';
  assetForm.scene_type = '';
  assetForm.front_path = '';
  assetForm.side_path = '';
  assetForm.back_path = '';
  assetForm.expression_note = '';
  assetForm.costume_note = '';
  assetForm.lora_ref = '';
  assetForm.angle_paths = '';
  assetForm.prop_category = '';
  assetForm.voice_lang = '';
  assetForm.speaker_name = '';
}
function fillAsset(row) {
  editingAssetId.value = row.id;
  assetForm.name = row.name || '';
  assetForm.kind = row.kind || 'character';
  assetForm.description = row.description || '';
  assetForm.reference_path = row.reference_path || '';
  assetForm.character_id = row.character_id || '';
  assetForm.voice_key = row.voice_key || '';
  assetForm.speech_rate = row.speech_rate || '';
  assetForm.emotion = row.emotion || '';
  assetForm.consistency_note = row.consistency_note || '';
  assetForm.scene_type = row.scene_type || '';
  assetForm.front_path = row.front_path || '';
  assetForm.side_path = row.side_path || '';
  assetForm.back_path = row.back_path || '';
  assetForm.expression_note = row.expression_note || '';
  assetForm.costume_note = row.costume_note || '';
  assetForm.lora_ref = row.lora_ref || '';
  assetForm.angle_paths = row.angle_paths || '';
  assetForm.prop_category = row.prop_category || '';
  assetForm.voice_lang = row.voice_lang || '';
  assetForm.speaker_name = row.speaker_name || '';
}
async function createAsset() {
  if (!assetForm.name.trim()) return;
  try {
    const created = await request(`/projects/${projectId.value}/assets`, { method: 'post', data: assetPayload(false) });
    if (created?.id) await refmodEditor.value?.flush?.(created.id);
    assetDrawerOpen.value = false;
    resetAssetForm();
    await load();
    ElMessage.success(created?.character_id ? `已新增，人物编号 ${created.character_id}` : '已新增');
  } catch (err) {
    ElMessage.error(err.message || '没有新增');
  }
}
async function saveAsset() {
  if (!editingAssetId.value) {
    ElMessage.warning('先点一条资产，再保存修改');
    return;
  }
  if (!assetForm.name.trim()) return;
  try {
    const saved = await request(`/projects/${projectId.value}/assets/${editingAssetId.value}`, {
      method: 'put',
      data: assetPayload(true),
    });
    if (saved?.character_id) assetForm.character_id = saved.character_id;
    await refmodEditor.value?.flush?.(editingAssetId.value);
    assetDrawerOpen.value = false;
    await load();
    ElMessage.success('资产已保存');
  } catch (err) {
    ElMessage.error(err.message || '没有保存');
  }
}
async function runAction(work) {
  try {
    await work();
    await load();
  } catch (err) {
    ElMessage.error(err.message || '没有完成');
  }
}
async function matchAssets() {
  await runAction(async () => {
    await request(`/projects/${projectId.value}/assets/match`, { method: 'post' });
    ElMessage.success('已按名称写入绑定');
  });
}
async function suggestAssets() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/assets/suggest`, { method: 'post' });
    assetSuggestions.value = data?.suggestions || [];
    if (assetSuggestions.value.length) ElMessage.info('建议还没有写入');
    else ElMessage.warning('没有可绑定的资产');
  });
}
async function applyAssets() {
  await runAction(async () => {
    await request(`/projects/${projectId.value}/assets/apply`, { method: 'post', data: { suggestions: assetSuggestions.value } });
    assetSuggestions.value = [];
    ElMessage.success('绑定已写入');
  });
}
async function loadVoiceLibrary() {
  voiceLoading.value = true;
  try {
    const data = await request('/voice-library');
    voiceRows.value = data?.rows || [];
    voiceFolders.value = data?.folders || [];
    voiceSkipped.value = data?.skipped || [];
  } catch (err) {
    voiceRows.value = [];
    voiceFolders.value = [];
    voiceSkipped.value = [];
    ElMessage.error(err.message || '音色库没有打开');
  } finally {
    voiceLoading.value = false;
  }
}
function selectLibraryVoice(row) {
  selectedVoice.value = row;
}
function previewLibraryVoice(row) {
  selectedVoice.value = row;
  const audio = voiceAudio.value;
  if (!audio) return;
  audio.src = `${resolveApiBase()}/voice-library/file?id=${encodeURIComponent(row.id)}`;
  audio.play().catch(() => {});
}
async function assignLibraryVoice() {
  if (!selectedVoice.value || !voiceShotIds.value.length) return;
  await runAction(async () => {
    await request(`/projects/${projectId.value}/voice/library-assign`, {
      method: 'post',
      data: { voice_id: selectedVoice.value.id, shot_ids: voiceShotIds.value },
    });
    ElMessage.success(`已用「${selectedVoice.value.name}」给 ${voiceShotIds.value.length} 条镜头配音`);
  });
}
async function suggestVoice() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/voice/suggest`, { method: 'post' });
    voiceSuggestions.value = data?.cues || [];
    ElMessage.info('时间轴还没有写入');
  });
}
async function applyVoice() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/voice/apply`, {
      method: 'post',
      data: { cues: voiceSuggestions.value, request_audio: requestAudio.value },
    });
    voiceSuggestions.value = [];
    ElMessage.success(data?.audio_note || '时间轴已写入');
  });
}
async function buildSubtitles() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/subtitles/build`, { method: 'post' });
    ElMessage.success(data?.style ? `已按「${data.style}」排好字幕` : '已按台词排好字幕');
  });
}
async function suggestReview() {
  await runAction(async () => {
    const data = await request(`/projects/${projectId.value}/review-findings/suggest`, { method: 'post' });
    reviewSuggestions.value = data?.issues || [];
    ElMessage.info('问题还没有记下');
  });
}
async function applyReview() {
  await runAction(async () => {
    await request(`/projects/${projectId.value}/review-findings/apply`, { method: 'post', data: { issues: reviewSuggestions.value } });
    reviewSuggestions.value = [];
    ElMessage.success('问题已记下');
  });
}
async function disableAsset(row) {
  try {
    await request(`/projects/${projectId.value}/assets/${row.id}/disable`, { method: 'post' });
    await load();
    ElMessage.success('已停用');
  } catch (err) {
    ElMessage.error(err.message || '没有停用');
  }
}
async function removeAsset(row) {
  try {
    await ElMessageBox.confirm(
      `删除「${row.name}」会同时去掉它的 RefMod、上传图片和镜头绑定。已经生成的分镜画面会留着。`,
      '删除资产',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await request(`/projects/${projectId.value}/assets/${row.id}`, { method: 'delete' });
    if (editingAssetId.value === row.id) {
      resetAssetForm();
    }
    ElMessage.success('已删除资产和对应的 RefMod、图片');
    await load();
  } catch (err) {
    ElMessage.error(err.message || '没有删除');
  }
}
function selectNode(id) {
  navTarget.value = `${id}:${Date.now()}`;
  const query = { node: id };
  if (id === 'preview' && route.query.shot) query.shot = String(route.query.shot);
  router.replace({ query });
}
function pickShot(row) {
  router.replace({ query: { node: node.value, shot: String(row.id) } });
}
const workflowOpen = ref(false);
const workflowLoading = ref(false);
const workflowTaskId = ref(null);
const workflowChoices = ref([]);
const workflowText = ref('');
const workflowTitle = computed(() => (workflowTaskId.value ? `提交给 ComfyUI 的工作流 · 记录 #${workflowTaskId.value}` : '提交给 ComfyUI 的工作流'));
function workflowTasks(row) {
  return (bundle.value?.tasks || []).filter(item => String(item.shot_id) === String(row?.id) && item.has_workflow);
}
async function openWorkflow(row) {
  const tasks = workflowTasks(row);
  if (!tasks.length) {
    ElMessage.warning('这条镜头还没有留下提交给 ComfyUI 的工作流');
    return;
  }
  workflowChoices.value = tasks;
  workflowTaskId.value = tasks[0].id;
  workflowOpen.value = true;
  await loadWorkflow();
}
async function loadWorkflow() {
  workflowLoading.value = true;
  workflowText.value = '';
  try {
    const data = await request(`/tasks/${workflowTaskId.value}/workflow`);
    workflowText.value = data?.submitted
      ? JSON.stringify(data.submitted, null, 2)
      : '这次生成没有留下提交给 ComfyUI 的工作流';
  } catch (err) {
    workflowText.value = '';
    ElMessage.error(err.message || '没有读到工作流');
  } finally {
    workflowLoading.value = false;
  }
}
async function persistNode(value) {
  if (!episode.value || !value || episode.value.current_node === value) return;
  try {
    const saved = await request(`/projects/${projectId.value}/tasks/${episode.value.id}`, {
      method: 'PUT',
      data: { current_node: value },
    });
    episode.value = { ...episode.value, current_node: saved?.current_node || value };
  } catch {
    // 地址栏仍是当前节点，记不住时下次打开回到上次成功写入的节点
  }
}
async function load(mask = false) {
  const token = mask ? ++entryToken : 0;
  if (mask) entryLoading.value = true;
  error.value = '';
  try {
  const detail = await request(`/projects/${projectId.value}`);
  const episodes = detail.episodes || [];
  if (!episodes.length) {
    error.value = '还没有这一集';
    return;
  }
  const current = episodes.find(item => String(item.id) === String(route.params.taskId));
  if (!current) {
    await router.replace({ path: `/projects/${projectId.value}/tasks/${episodes[0].id}`, query: route.query });
    return;
  }
  project.value = detail.project;
  bundle.value = detail;
  episode.value = current || null;
  shots.value = (detail.shots || []).filter(item => !item.deleted_at);
  try {
    const [ pipe, meta ] = await Promise.all([
      request('/pipelines', { params: { content_type: detail.project.content_type } }),
      request('/meta').catch(() => ({ visual_styles: [] })),
    ]);
    customNodes.value = (pipe.nodes || []).filter(item => item.kind === 'custom' && item.enabled);
    styles.value = meta.visual_styles || [];
  } catch {
    customNodes.value = [];
  }
  if (episode.value && !route.query.node && episode.value.current_node) {
    await router.replace({ query: { ...route.query, node: episode.value.current_node } });
  }
  await persistNode(node.value);
  } finally {
    if (mask && token === entryToken) entryLoading.value = false;
  }
}

watch(() => route.query.node, (value) => {
  if (value === 'generate') {
    launchShotId.value = String(route.query.shot || '');
    const query = { node: 'storyboard' };
    if (launchShotId.value) query.shot = launchShotId.value;
    router.replace({ query });
  } else if (value === 'refmods') {
    router.replace({ query: { node: 'assets' } });
  }
}, { immediate: true });
watch(node, (value) => {
  persistNode(value);
  if (value === 'voice' && !voiceRows.value.length) loadVoiceLibrary();
});
watch([ voiceQuery, voiceFolder ], () => {
  voicePage.value = 1;
});
watch(() => route.params.taskId, () => {
  load(true).catch((err) => {
    error.value = err.message || '打不开工作台';
    ElMessage.error(error.value);
  });
});
onMounted(() => {
  load(true).catch((err) => {
    error.value = err.message || '打不开工作台';
    ElMessage.error(error.value);
  });
});
</script>

<style scoped>
.cartoon-workflow-pick { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.cartoon-workflow-json {
  max-height: 60vh;
  margin: 0;
  padding: 12px;
  overflow: auto;
  white-space: pre;
  background: #f6f7f4;
  border-radius: 6px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}
.cartoon-workbench--boot {
  display: block;
  position: relative;
}
.cartoon-workflow-body {
  position: relative;
  min-height: 240px;
}
.cartoon-workbench {
  display: grid;
  grid-template-columns: 196px minmax(0, 1fr) 168px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  align-items: stretch;
}
.cartoon-workbench__nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 16px 12px;
  padding: 10px;
  min-height: 0;
  overflow: auto;
  border-radius: 10px;
  background: rgba(240, 247, 242, 0.72);
  border: 1px solid rgba(47, 138, 91, 0.12);
}
.cartoon-workbench__nav h1 {
  margin: 8px 0 0;
  font-size: 16px;
  color: var(--cartoon-color-deep);
}
.cartoon-workbench__nav p {
  margin: 0 0 8px;
  color: var(--cartoon-color-muted);
  font-size: 13px;
}
.cartoon-workbench__pin { margin-bottom: 12px; }
.cartoon-workbench__node {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  border: 1px solid rgba(47, 138, 91, 0.12);
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--cartoon-color-muted);
  font-weight: 600;
}
.cartoon-workbench__node:hover {
  background: rgba(255, 255, 255, 0.62);
}
.cartoon-workbench__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #c5d1c9;
  flex: none;
}
.cartoon-workbench__dot.is-ok { background: #2f8a5b; }
.cartoon-workbench__dot.is-warn { background: #c48a2a; }
.cartoon-workbench__dot.is-bad { background: #c44b4b; }
.cartoon-workbench__dot.is-run { background: #3b7fc4; }
.cartoon-workbench__side {
  min-height: 0;
  overflow: auto;
  padding: 16px 12px;
  color: var(--cartoon-color-muted);
  font-size: 13px;
}
.cartoon-workbench__side h2 {
  margin: 0 0 8px;
  color: var(--cartoon-color-deep);
  font-size: 14px;
}
.cartoon-workbench__side p { margin: 0 0 6px; }
.cartoon-workbench__node.is-active {
  background: rgba(255, 255, 255, 0.86);
  border-color: rgba(47, 138, 91, 0.32);
  color: var(--cartoon-color-deep);
  box-shadow: 0 1px 2px rgba(31, 61, 44, 0.04);
}
.cartoon-workbench__node.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: #2f8a5b;
}
.cartoon-workbench__main {
  padding: 16px 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.cartoon-workbench__main > .cartoon-page {
  flex: 1 1 0;
  min-height: 0;
}
.cartoon-workbench__main > .cartoon-workbench__note:not(:has(.el-table)) {
  flex: 0 0 auto;
  max-height: 30%;
  overflow: auto;
}
.cartoon-workbench__main > .cartoon-module:has(.el-table) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}
.cartoon-workbench__main > .cartoon-module:has(.el-table) > .el-table {
  flex: 1 1 0;
  min-height: 120px;
}
.cartoon-workbench__main > .cartoon-module:has(.el-table) > .cartoon-entry-form {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 42%;
  overflow: auto;
}
.cartoon-upload-row { display: flex; gap: 12px; align-items: flex-start; }
.cartoon-upload-row > .el-button { flex: none; }
.cartoon-asset-page,
.cartoon-voice-page {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.cartoon-asset-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cartoon-asset-head .cartoon-module__title { margin: 0; }
.cartoon-asset-page :deep(.el-tabs) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cartoon-asset-page :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}
.cartoon-asset-page :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cartoon-voice {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 16px;
}
.cartoon-voice__library,
.cartoon-voice__shots {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.cartoon-voice-player { width: 100%; margin-top: 8px; }
.cartoon-asset-table { cursor: pointer; }
.cartoon-preview-table { width: 100%; }
.cartoon-pager { margin-top: 12px; justify-content: flex-end; }
.cartoon-preview-table :deep(.el-table__row),
.cartoon-preview-table :deep(.el-button) { cursor: pointer; }
</style>
