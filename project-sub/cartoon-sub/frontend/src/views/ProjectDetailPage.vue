<template>
  <PageShell v-if="detail" :title="embedded ? '' : detail.project.name">
    <template v-if="!embedded" #extra>
      <el-button link type="primary" @click="router.push(`/projects/${route.params.id}`)">返回详情</el-button>
    </template>
    <FlowSteps v-if="!embedded" :steps="steps" :current="step" @select="step = $event" />

    <section v-show="step === 1" class="cartoon-module">
      <h3 class="cartoon-module__title">项目设定</h3>
      <el-form label-position="top">
        <div class="cartoon-setting-grid">
          <el-form-item label="项目名称">
            <el-input v-model="projectForm.name" />
          </el-form-item>
          <el-form-item v-if="!isLocal" label="来源小说">
            <el-select v-model="projectForm.source_novel_id" filterable clearable placeholder="从小说平台选择" style="width: 100%" @change="onNovelChange">
              <el-option v-for="item in novels" :key="item.id" :label="item.title" :value="String(item.id)" />
            </el-select>
          </el-form-item>
          <el-form-item label="画面风格">
            <el-select v-model="projectForm.visual_style" filterable placeholder="选择风格" style="width: 100%">
              <el-option v-for="item in meta.visual_styles" :key="item.value" :label="item.label" :value="item.value" />
            </el-select>
          </el-form-item>
        </div>
        <el-button type="primary" :disabled="!canMake()" @click="saveProject">保存设定</el-button>
      </el-form>
      <NovelBriefPanel v-if="!isLocal" :novel="novelBrief" :loading="novelLoading" />
    </section>

    <section v-if="step === 2 && isLocal" class="cartoon-module">
      <h3 class="cartoon-module__title">本地文案</h3>
      <CopyBlocks :project-id="route.params.id" />
    </section>

    <section v-show="step === 2 && !isLocal">
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">从小说拉取</h3>
        <p class="cartoon-module__hint">新项目按叙事工作台已发布的故事包版本拉取。旧项目仍可直接拉章节，并标记为未钉扎。</p>
        <el-form label-position="top">
          <el-form-item v-if="packageVersions.length" label="故事包版本">
            <el-select v-model="packageVersion" placeholder="选择已发布版本" style="width: 100%" @change="onPackageVersion">
              <el-option v-for="item in packageVersions" :key="item.version" :label="`v${item.version} · ${item.published_at || ''}`" :value="item.version" />
            </el-select>
          </el-form-item>
          <el-alert v-else-if="pinRequired" type="info" show-icon :closable="false" title="还没有已发布的故事包。请先到叙事工作台发布，再回来拉取。" />
          <el-form-item label="章节">
            <el-select v-model="chapterId" filterable placeholder="选择章节" style="width: 100%" :disabled="!projectForm.source_novel_id">
              <el-option v-for="item in pullChapters" :key="item.id" :label="item.label || item.title" :value="String(item.id)" />
            </el-select>
          </el-form-item>
          <el-button type="primary" :disabled="!chapterId || !canMake() || (pinRequired && !packageVersion)" @click="pull">{{ pullLabel }}</el-button>
        </el-form>
      </div>
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">手工快照</h3>
        <el-form label-position="top">
          <el-form-item label="标题"><el-input v-model="chapterTitle" /></el-form-item>
          <el-form-item label="正文"><el-input v-model="body" type="textarea" :rows="6" /></el-form-item>
          <el-button :disabled="!canMake()" @click="saveImport">保存手工快照</el-button>
        </el-form>
      </div>
      <div class="cartoon-module">
        <h3 class="cartoon-module__title">已有快照</h3>
        <el-empty v-if="!liveImports.length" description="还没有章节快照" />
        <el-card v-for="item in liveImports" :key="item.id" shadow="never" class="cartoon-snap">
          <strong>{{ item.chapter_title || '未命名章节' }}</strong>
          <el-tag v-if="item.legacy_unpinned" size="small" class="cartoon-status-tag">未钉扎</el-tag>
          <el-tag v-else-if="item.package_version" size="small" type="success">故事包 v{{ item.package_version }}</el-tag>
          <div class="cartoon-snap__body" :class="{ 'is-open': snapOpen[item.id] }">
            <CartoonMarkdown prose :source="item.body" empty-text="还没有正文" />
            <CartoonMarkdown v-if="item.script_data && item.script_data.summary" :source="item.script_data.summary" />
          </div>
          <el-button link type="primary" @click="snapOpen[item.id] = !snapOpen[item.id]">{{ snapOpen[item.id] ? '收起' : '展开' }}</el-button>
          <div class="cartoon-snap__actions">
            <el-button type="primary" :disabled="!canMake()" :loading="draftingId === item.id" @click="generateScript(item)">生成剧本</el-button>
            <el-button
              v-if="hasScript(item)"
              type="primary"
              plain
              @click="openScriptPage(item)"
            >查看剧本</el-button>
            <el-button type="danger" plain :disabled="!canMake()" @click="removeSnapshot(item)">删除快照</el-button>
          </div>
        </el-card>
      </div>
    </section>

    <section v-show="step === 3" class="cartoon-module">
      <div class="cartoon-board__head" style="justify-content: space-between">
        <h3 class="cartoon-module__title" style="margin: 0">剧本</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 8px">
          <el-button @click="goSnapshotPage">返回快照页</el-button>
          <el-button type="primary" plain @click="goShotsPage">镜头</el-button>
          <el-button type="danger" plain :disabled="!canStop" @click="stopWork">停止</el-button>
        </div>
      </div>
      <div class="cartoon-board">
        <aside class="cartoon-board__snaps">
          <p class="cartoon-board__label">章节快照</p>
          <el-empty v-if="!scriptBoardItems.length" description="还没有快照" />
          <div
            v-for="item in scriptBoardItems"
            :key="item.key"
            class="cartoon-board__snap"
            :class="{ 'is-active': item.key === selectedImportKey }"
            role="button"
            tabindex="0"
            @click="selectedImportKey = item.key"
            @keydown.enter="selectedImportKey = item.key"
          >
            <span class="cartoon-board__snap-title">{{ item.title }}</span>
            <el-tag v-if="item.hasScript" type="success" size="small">有剧本</el-tag>
            <span class="cartoon-board__snap-count">{{ item.count }} 镜</span>
          </div>
        </aside>
        <div class="cartoon-board__main">
          <p v-if="!selectedScriptImport" class="cartoon-module__hint">先在左侧选择一条章节快照。</p>
          <template v-else>
            <div class="cartoon-board__head">
              <el-button
                type="primary"
                plain
                :disabled="!canMake()"
                :loading="draftingId === selectedScriptImport.id"
                @click="generateScript(selectedScriptImport)"
              >重新生成剧本</el-button>
              <el-button
                type="primary"
                :disabled="!canMake() || !selectedScriptImport.script_data?.scenes?.length"
                :loading="outliningId === selectedScriptImport.id"
                @click="generateShotOutline(selectedScriptImport)"
              >拆分分镜</el-button>
              <el-button
                type="danger"
                plain
                :disabled="!canMake() || !scriptShots.length"
                @click="clearScriptShots(selectedScriptImport)"
              >一键删除分镜</el-button>
            </div>
            <div v-if="activeScriptData" class="cartoon-script">
              <h4>概要</h4>
              <CartoonMarkdown :source="activeScriptData.summary || ''" empty-text="还没有概要" />
              <h4>人物</h4>
              <el-empty v-if="!(activeScriptData.characters || []).length" description="还没有人物" />
              <ul v-else class="cartoon-script__list">
                <li v-for="(person, index) in activeScriptData.characters" :key="`${person.name}-${index}`">
                  <strong>{{ person.name }}</strong> — {{ person.look }}
                </li>
              </ul>
              <h4>场次</h4>
              <el-empty v-if="!(activeScriptData.scenes || []).length" description="还没有场次" />
              <div v-for="(scene, index) in (activeScriptData.scenes || [])" :key="`${scene.title}-${index}`" class="cartoon-script__scene">
                <strong>{{ index + 1 }}. {{ scene.title || '未命名场次' }}</strong>
                <CartoonMarkdown :source="scene.summary || ''" />
              </div>
            </div>
            <p v-else class="cartoon-module__hint">还没有剧本，请先生成剧本。</p>

            <div v-if="coverageNotices.length" class="cartoon-coverage">
              <el-alert
                v-for="(note, index) in coverageNotices"
                :key="`${note.title}-${index}`"
                type="warning"
                :closable="false"
                show-icon
                :title="note.title"
                :description="note.reason"
              />
            </div>
            <h4 id="script-shot-table" class="cartoon-module__title" style="margin-top: 20px">分镜表（{{ scriptShots.length }}）</h4>
            <p class="cartoon-module__hint">与「镜头」页同一批数据。场次和镜头只按下文字数设下限，不设上限。镜头描述和提示词不限字数，对白多时一条可以写到数千字。拆分后会落库；逐行生成提示词。删除任一侧会同步。</p>
            <el-empty v-if="!scriptShots.length" description="还没有分镜，请先点「拆分分镜」" />
            <template v-else>
            <el-table class="cartoon-shot-table" :data="scriptPageRows" style="margin-top: 8px" row-key="id">
              <el-table-column label="镜头ID" width="120" prop="shot_code" />
              <el-table-column label="时长(秒)" width="110">
                <template #default="{ row }">{{ shotDurationSec(row) }}</template>
              </el-table-column>
              <el-table-column label="主景别" width="180">
                <template #default="{ row }">{{ shotSizeText(row) }}</template>
              </el-table-column>
              <el-table-column label="主运镜" width="180">
                <template #default="{ row }">{{ cameraMoveText(row) }}</template>
              </el-table-column>
              <el-table-column label="涵盖的剧本内容" width="420">
                <template #default="{ row }"><ClampText title="涵盖的剧本内容" :text="row.description || ''" /></template>
              </el-table-column>
              <el-table-column label="对白" width="280">
                <template #default="{ row }"><ClampText title="对白" :text="row.dialogue || ''" /></template>
              </el-table-column>
              <el-table-column label="操作" width="200" fixed="right">
                <template #default="{ row }">
                  <el-button
                    link
                    type="primary"
                    :disabled="!canMake()"
                    :loading="expandingKey === String(row.id)"
                    @click="expandOutlineRow(row)"
                  >生成分镜提示词</el-button>
                  <el-button link type="danger" :disabled="!canMake()" @click="removeShot(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <el-pagination
              v-model:current-page="scriptPage"
              class="cartoon-pager"
              :page-size="pageSize"
              :total="scriptShots.length"
              layout="total, prev, pager, next"
            />
            </template>
          </template>
        </div>
      </div>
    </section>

    <section v-show="step === 4" class="cartoon-module cartoon-shot-page">
      <div class="cartoon-shot-head">
        <h3 class="cartoon-module__title">镜头</h3>
        <div class="cartoon-shot-head__side">
          <span v-if="autoProgressLabel" class="cartoon-auto-progress">{{ autoProgressLabel }}</span>
          <el-button type="primary" :disabled="!canMake() || !selectedBoard || autoRunning" @click="openShotCreate">新增</el-button>
        </div>
      </div>
      <p class="cartoon-module__hint">先在左侧选一条快照，再点右上角新增。表单在抽屉里，打开时会清空。汇总各快照已写入的剧情段（通常 8—15 秒/段），不从剧本页自动跳转过来。</p>
      <el-tabs v-model="shotTab" class="cartoon-shot-tabs">
      <el-tab-pane label="镜头表" name="table">
      <div class="cartoon-board">
        <aside class="cartoon-board__snaps">
          <p class="cartoon-board__label">章节快照</p>
          <el-empty v-if="!boardItems.length" description="还没有快照" />
          <div
            v-for="item in boardItems"
            :key="item.key"
            class="cartoon-board__snap"
            :class="{ 'is-active': item.key === selectedImportKey }"
            role="button"
            tabindex="0"
            @click="selectedImportKey = item.key"
            @keydown.enter="selectedImportKey = item.key"
          >
            <span class="cartoon-board__snap-title">{{ item.title }}</span>
            <el-tag v-if="item.deleted" type="danger" size="small">已删除</el-tag>
            <el-tag v-else-if="item.removed" type="warning" size="small">上游已移除</el-tag>
            <span class="cartoon-board__snap-count">{{ item.count }} 镜</span>
            <el-button
              v-if="item.raw && hasScript(item.raw)"
              link
              type="primary"
              @click.stop="openScriptPage(item.raw)"
            >查看剧本</el-button>
            <el-button
              v-if="item.deleted || item.importId == null"
              link
              type="danger"
              :disabled="!canMake()"
              @click.stop="removeShotGroup(item)"
            >删除</el-button>
          </div>
        </aside>
        <div class="cartoon-board__main">
          <p v-if="!selectedBoard" class="cartoon-module__hint">先在左侧选择一条章节快照。</p>
          <div v-if="selectedBoard" class="cartoon-entry-actions">
            <el-button :disabled="autoRunning" @click="runAuto('prompt')">生成分镜提示词</el-button>
            <el-button :disabled="autoRunning" @click="runAuto('video')">自动生成视频</el-button>
            <el-button type="primary" plain :disabled="autoRunning" @click="runAuto('all')">全自动执行</el-button>
            <el-button type="danger" plain :disabled="!canStop" @click="stopWork">停止</el-button>
          </div>
          <el-table v-if="selectedBoard" class="cartoon-shot-table" :data="boardPageRows" style="margin-top: 12px">
            <el-table-column label="镜头ID" width="120" prop="shot_code" />
            <el-table-column label="时长" width="90">
              <template #default="{ row }">{{ row.duration_ms ? `${Math.round(row.duration_ms / 1000)}s` : '—' }}</template>
            </el-table-column>
            <el-table-column label="主景别" width="180">
              <template #default="{ row }">{{ shotSizeText(row) }}</template>
            </el-table-column>
            <el-table-column label="运镜" width="180">
              <template #default="{ row }">{{ cameraMoveText(row) }}</template>
            </el-table-column>
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                <el-tag v-if="row.upstream_stale" size="small" type="warning">上游已变</el-tag>
                <el-tag v-if="hasOverride(row, 'dialogue')" size="small">台词已改</el-tag>
                <span v-if="!row.upstream_stale && !hasOverride(row, 'dialogue')">—</span>
              </template>
            </el-table-column>
            <el-table-column label="描述" width="360">
              <template #default="{ row }"><ClampText title="描述" :text="row.description || ''" /></template>
            </el-table-column>
            <el-table-column label="正向提示词" width="520">
              <template #default="{ row }"><ClampText title="正向提示词" :text="row.prompt?.positive_zh || ''" /></template>
            </el-table-column>
            <el-table-column label="负向提示词" width="360">
              <template #default="{ row }"><ClampText title="负向提示词" :text="row.prompt?.negative_zh || ''" /></template>
            </el-table-column>
            <el-table-column label="关联资产" width="320">
              <template #default="{ row }">
                <div v-if="row.asset_marks?.length" class="cartoon-asset-marks">
                  <span
                    v-for="item in row.asset_marks"
                    :key="`${item.asset_id || 'x'}-${item.name}`"
                    class="cartoon-asset-mark"
                    :class="item.state === 'have' ? 'is-have' : 'is-miss'"
                  >{{ item.name }}</span>
                </div>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="280" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" :disabled="!canMake()" @click.stop="openPromote(row)">提升台词</el-button>
                <el-button link type="primary" @click.stop="openShotDrawer(row, 'detail')">查看</el-button>
                <el-button link type="primary" :disabled="!canMake()" @click.stop="openShotDrawer(row, 'edit')">编辑</el-button>
                <el-button link type="danger" :disabled="!canMake()" @click.stop="removeShot(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-if="selectedBoard && boardShots.length"
            v-model:current-page="boardPage"
            class="cartoon-pager"
            :page-size="pageSize"
            :total="boardShots.length"
            layout="total, prev, pager, next"
          />
        </div>
      </div>
      </el-tab-pane>
      <el-tab-pane label="执行记录" name="log">
        <el-empty v-if="!autoRecords.length" description="还没有执行记录" />
        <template v-else>
          <el-table :data="recordPageRows">
            <el-table-column label="时间" width="110" prop="at" />
            <el-table-column label="镜头" width="120" prop="shotCode" />
            <el-table-column label="执行内容" width="140" prop="action" />
            <el-table-column label="结果" width="100">
              <template #default="{ row }">
                <el-tag :type="recordTag(row.result)" size="small">{{ row.result }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="反馈">
              <template #default="{ row }"><ClampText title="反馈" :text="row.reason || ''" /></template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="recordPage"
            class="cartoon-pager"
            :page-size="pageSize"
            :total="autoRecords.length"
            layout="total, prev, pager, next"
          />
        </template>
      </el-tab-pane>
      </el-tabs>
    </section>

    <el-drawer v-model="shotCreateOpen" title="新增镜头" size="640px" append-to-body>
      <el-form label-position="top" class="cartoon-entry-form" @submit.prevent="addShot">
        <el-form-item label="主景别">
          <el-select v-model="shot.shot_sizes" multiple collapse-tags style="width: 100%" placeholder="多选景别">
            <el-option v-for="item in meta.shot_sizes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="运镜">
          <el-select v-model="shot.camera_moves" multiple collapse-tags style="width: 100%" placeholder="多选运镜">
            <el-option v-for="item in meta.camera_moves" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="shot.description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="提示词"><el-input v-model="shot.positive_zh" type="textarea" :rows="4" /></el-form-item>
      </el-form>
      <template #footer>
        <div class="cartoon-drawer-footer__actions">
          <el-button type="primary" :disabled="!canMake() || autoRunning" @click="addShot">创建</el-button>
        </div>
      </template>
    </el-drawer>
    <el-drawer v-model="generateOpen" :title="shotDrawerMode === 'edit' ? '编辑镜头' : '镜头详情'" size="640px" append-to-body>
      <ShotGeneratePage
        v-if="generateOpen"
        ref="shotPanel"
        plain
        :mode="shotDrawerMode"
        :shot-id-override="generateShotId"
        @saved="load"
        @running="onShotRunning"
      />
      <template #footer>
        <div class="cartoon-drawer-footer">
          <template v-if="shotDrawerMode === 'detail'">
            <el-progress
              v-if="shotPanel?.jobLive"
              :percentage="shotPanel.jobPercent"
              :indeterminate="shotPanel.jobWaiting"
              :stroke-width="8"
              color="#2f8a5b"
            />
            <p v-if="shotPanel?.jobLive" class="cartoon-module__hint">{{ shotPanel.jobNote }}</p>
            <div class="cartoon-drawer-footer__actions">
              <el-button v-if="shotPanel?.jobLive || shotPanel?.generating" type="danger" plain @click="stopWork">停止</el-button>
              <el-button type="primary" :disabled="!canMake()" :loading="shotPanel?.generating" @click="shotPanel?.generate()">生成</el-button>
              <el-button @click="shotPanel?.openAssets()">查看资产</el-button>
            </div>
          </template>
          <div v-else class="cartoon-drawer-footer__actions">
            <el-button type="primary" :disabled="!canMake()" :loading="shotPanel?.savingAssets" @click="shotPanel?.saveAssets()">保存</el-button>
          </div>
        </div>
      </template>
    </el-drawer>
    <el-dialog v-model="promoteVisible" title="提升到叙事工作台" width="520px">
      <p class="cartoon-module__hint">镜头对白是拆分进生产稿的句子，可以已经和小说不一样。原句必须是钉扎章节里的一整句，改后才是要写回小说的新句子。应用发生在叙事工作台，这里的生产稿不会被改回去。</p>
      <el-form label-position="top">
        <el-form-item label="当前镜头对白"><el-input :model-value="promoteDialogue" type="textarea" :rows="3" readonly /></el-form-item>
        <el-form-item label="原句">
          <el-input v-model="promoteBefore" type="textarea" :rows="3" />
          <p class="cartoon-module__hint">{{ promoteMatched ? '这一句能在钉扎章节里对上。' : '钉扎章节里没有和当前对白相同的句子，请从钉扎正文抄一整句。' }}</p>
        </el-form-item>
        <el-form-item label="改后"><el-input v-model="promoteAfter" type="textarea" :rows="3" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="promoteVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!canMake()" @click="submitPromote">提交</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import FlowSteps from '../components/FlowSteps.vue';
import NovelBriefPanel from '../components/NovelBriefPanel.vue';
import CartoonMarkdown from '../components/CartoonMarkdown.vue';
import CopyBlocks from '../components/CopyBlocks.vue';
import ShotGeneratePage from './ShotGeneratePage.vue';
import ClampText from '../components/ClampText.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';
import { isLocalType } from '../lib/contentTypes.js';
import { uncoveredScenes } from '../utils/sceneCoverage.js';

const props = defineProps({
  forcedStep: { type: Number, default: 0 },
  navTarget: { type: String, default: '' },
  launchShotId: { type: String, default: '' },
});
const route = useRoute();
const router = useRouter();
const steps = [
  { step: 1, title: '项目' },
  { step: 2, title: '快照' },
  { step: 3, title: '剧本' },
  { step: 4, title: '镜头' },
];
const embedded = computed(() => props.forcedStep > 0);
const step = ref(props.forcedStep || Number(route.query.step) || 1);
watch(() => props.forcedStep, (value) => {
  if (!value) return;
  if (value === 2 && step.value === 3) return;
  step.value = value;
});
watch(() => props.navTarget, (value) => {
  const id = String(value || '').split(':')[0];
  if (id === 'storyboard') step.value = 4;
  else if (id === 'script') step.value = 2;
  else if (id === 'input') step.value = 1;
});
const detail = ref(null);
const novels = ref([]);
const chapters = ref([]);
const meta = reactive({ visual_styles: [], shot_sizes: [ '中景' ], camera_moves: [ '固定' ] });
const projectForm = reactive({ name: '', source_novel_id: '', visual_style: '' });
const chapterId = ref('');
const packageDesk = ref(null);
const packageVersion = ref(null);
const promoteVisible = ref(false);
const promoteBefore = ref('');
const promoteAfter = ref('');
const promoteDialogue = ref('');
const promoteMatched = ref(false);
const promoteShotId = ref(null);
const shotDrawerMode = ref('detail');
const shotCreateOpen = ref(false);
const shotPanel = ref(null);
const pinRequired = computed(() => (detail.value?.project?.pin_mode || 'required') !== 'legacy');
const isLocal = computed(() => isLocalType(detail.value?.project?.content_type));
const packageVersions = computed(() => packageDesk.value?.versions || []);
const matchingImport = computed(() => (detail.value?.imports || []).find(item => (
  !item.deleted_at && String(item.chapter_id) === String(chapterId.value)
)));
const pullLabel = computed(() => {
  const row = matchingImport.value;
  if (row?.package_version && packageVersion.value && Number(row.package_version) !== Number(packageVersion.value)) {
    return '更新到此版本';
  }
  return '拉取正文';
});
const pullChapters = computed(() => {
  const version = packageVersions.value.find(item => item.version === packageVersion.value);
  if (version?.chapters?.length) {
    return version.chapters.map(item => ({ id: item.chapter_id, title: item.title, label: item.title }));
  }
  return chapters.value;
});
const chapterTitle = ref('');
const body = ref('');
const shot = reactive({ shot_sizes: [ '中景' ], camera_moves: [ '固定' ], description: '', positive_zh: '' });
const pageSize = 10;
const scriptPage = ref(1);
const boardPage = ref(1);
const novelBrief = ref(null);
const novelLoading = ref(false);
const draftingId = ref(null);
const outliningId = ref(null);
const expandingKey = ref('');
const selectedImportKey = ref('');
const snapOpen = reactive({});
const generateOpen = ref(false);
const generateShotId = ref('');
const autoRunning = ref(false);
const shotTab = ref('table');
const autoRecords = ref([]);
const recordPage = ref(1);
const autoPrompt = reactive({ done: 0, total: 0 });
const autoVideo = reactive({ done: 0, total: 0 });
let autoToken = 0;
let runController = null;
const manualJob = ref(false);
const canStop = computed(() => autoRunning.value || Boolean(expandingKey.value) || manualJob.value || Boolean(shotPanel.value?.jobLive) || Boolean(shotPanel.value?.generating));
function onShotRunning(payload) {
  manualJob.value = Boolean(payload?.live);
}
function ensureController() {
  if (!runController) runController = new AbortController();
  return runController;
}
function stopError() {
  const err = new Error('已停止');
  err.stop = true;
  return err;
}
function isStop(err) {
  return Boolean(err?.stop)
    || err?.code === 'ERR_CANCELED'
    || err?.name === 'CanceledError'
    || err?.name === 'AbortError'
    || [ 'canceled', '已停止' ].includes(err?.message);
}
function isMissingPositive(err) {
  const message = String(err?.message || '');
  if (message.includes('工作流不存在')) return false;
  return message.includes('还没有正向提示词')
    || message.includes('没有写回正向提示词')
    || message.includes('没有正向提示词')
    || message.includes('需要一句提示词');
}
function pause(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(stopError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(stopError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
async function stopWork() {
  if (!canStop.value) return;
  runController?.abort();
  runController = null;
  shotPanel.value?.haltJob?.();
  manualJob.value = false;
  try {
    await request(`/projects/${route.params.id}/generate/stop`, { method: 'post' });
    await load();
    ElMessage.info('已停止');
  } catch (err) {
    if (!isStop(err)) ElMessage.error(err.message || '没有停止');
  }
}
const autoProgressLabel = computed(() => {
  const parts = [];
  if (autoPrompt.total) parts.push(`${autoPrompt.done}/${autoPrompt.total}[生成提示词]`);
  if (autoVideo.total) parts.push(`${autoVideo.done}/${autoVideo.total}[生成视频]`);
  return parts.join(' ');
});
const recordPageRows = computed(() => autoRecords.value.slice((recordPage.value - 1) * pageSize, recordPage.value * pageSize));
watch(autoRecords, (rows) => {
  const max = Math.max(1, Math.ceil(rows.length / pageSize));
  if (recordPage.value > max) recordPage.value = max;
}, { deep: true });
watch(shotTab, () => {
  nextTick(() => window.dispatchEvent(new Event('resize')));
});
function recordTag(result) {
  if (result === '成功') return 'success';
  if (result === '失败') return 'danger';
  if (result === '跳过') return 'warning';
  return 'info';
}
function writeNote(item, note) {
  item.note = note;
  if (item.record) item.record.reason = note;
}
function openRecord(item) {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  const row = {
    id: `${now.getTime()}-${item.key}`,
    at: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
    shotCode: item.shotCode,
    action: item.kind === 'prompt' ? '生成提示词' : '生成视频',
    result: '进行中',
    reason: '',
  };
  autoRecords.value.unshift(row);
  return row;
}

const liveImports = computed(() => (detail.value?.imports || []).filter(item => !item.deleted_at));
function hasScript(item) {
  return Boolean(item?.script_data?.scenes?.length);
}
const scriptBoardItems = computed(() => {
  const shots = detail.value?.shots || [];
  return liveImports.value.map(item => ({
    key: String(item.id),
    title: item.chapter_title || '未命名章节',
    hasScript: hasScript(item),
    count: shots.filter(shotRow => String(shotRow.import_id) === String(item.id)).length,
  }));
});
const selectedScriptImport = computed(() => liveImports.value.find(item => String(item.id) === selectedImportKey.value) || null);
const activeScriptData = computed(() => selectedScriptImport.value?.script_data || null);
const scriptShots = computed(() => {
  const current = selectedScriptImport.value;
  if (!current) return [];
  return (detail.value?.shots || []).filter(shotRow => String(shotRow.import_id) === String(current.id));
});
const scriptPageRows = computed(() => scriptShots.value.slice((scriptPage.value - 1) * pageSize, scriptPage.value * pageSize));
function minStoryUnits(charCount) {
  const n = Math.max(0, Number(charCount) || 0);
  if (n < 800) return 1;
  if (n < 2000) return 2;
  if (n < 4000) return 4;
  if (n < 8000) return 6;
  if (n < 12000) return 8;
  return 8 + Math.ceil((n - 12000) / 2000);
}
const coverageNotices = computed(() => {
  const item = selectedScriptImport.value;
  const script = activeScriptData.value;
  if (!item || !script) return [];
  const notes = [];
  const scenes = script.scenes || [];
  const bodyLen = String(item.body || '').length;
  const floor = minStoryUnits(bodyLen);
  const scriptReasons = (script.omissions || []).filter(row => row && row.reason);
  if (scriptReasons.length) {
    scriptReasons.forEach(row => {
      notes.push({
        title: '剧本删减',
        reason: row.target ? `${row.target}：${row.reason}` : row.reason,
      });
    });
  } else if (scenes.length > 0 && scenes.length < floor) {
    notes.push({
      title: '剧本删减',
      reason: `本章约 ${bodyLen} 字，场次下限是 ${floor}，当前 ${scenes.length} 场，少掉的情节被合并或删掉了。`,
    });
  }
  const shotCount = scriptShots.value.length;
  const shotFloor = Math.max(floor, scenes.length);
  const shotReasons = (script.shot_omissions || []).filter(row => row && row.reason);
  const missingScenes = shotCount > 0 ? uncoveredScenes(scenes, scriptShots.value) : [];
  if (missingScenes.length) {
    notes.push({
      title: '分镜跳过',
      reason: `${missingScenes.map(scene => `第${scene.index}场${scene.title ? `「${scene.title}」` : ''}`).join('、')}没有单独的镜头，被并进了其他场。一场可以拆成多条镜头，但不能少场。`,
    });
  } else if (shotCount > 0 && shotCount < shotFloor) {
    if (shotReasons.length) {
      shotReasons.forEach(row => {
        notes.push({
          title: '分镜跳过',
          reason: row.target ? `${row.target}：${row.reason}` : row.reason,
        });
      });
    } else if (scenes.length && shotCount < scenes.length) {
      notes.push({
        title: '分镜跳过',
        reason: `剧本 ${scenes.length} 场，分镜只有 ${shotCount} 条，少掉的场次被合并或跳过，没有单独成镜。`,
      });
    } else {
      notes.push({
        title: '分镜跳过',
        reason: `本章约 ${bodyLen} 字，镜头下限是 ${shotFloor}，当前 ${shotCount} 条。`,
      });
    }
  }
  return notes;
});
const boardItems = computed(() => {
  const imports = detail.value?.imports || [];
  const shots = detail.value?.shots || [];
  const items = imports.map(item => ({
    key: String(item.id),
    importId: item.id,
    title: item.chapter_title || '未命名章节',
    deleted: Boolean(item.deleted_at),
    removed: Boolean(item.upstream_removed),
    count: shots.filter(shotRow => String(shotRow.import_id) === String(item.id)).length,
    raw: item,
  }));
  const orphans = shots.filter(shotRow => shotRow.import_id == null);
  if (orphans.length) {
    items.push({
      key: 'orphan',
      importId: null,
      title: '未关联快照',
      deleted: false,
      count: orphans.length,
      raw: null,
    });
  }
  return items;
});
const selectedBoard = computed(() => boardItems.value.find(item => item.key === selectedImportKey.value) || null);
const boardShots = computed(() => {
  const current = selectedBoard.value;
  if (!current) return [];
  const shots = detail.value?.shots || [];
  if (current.importId == null) return shots.filter(shotRow => shotRow.import_id == null);
  return shots.filter(shotRow => String(shotRow.import_id) === String(current.importId));
});
const boardPageRows = computed(() => boardShots.value.slice((boardPage.value - 1) * pageSize, boardPage.value * pageSize));
watch(selectedImportKey, () => {
  scriptPage.value = 1;
  boardPage.value = 1;
});
watch(scriptShots, (rows) => {
  const max = Math.max(1, Math.ceil(rows.length / pageSize));
  if (scriptPage.value > max) scriptPage.value = max;
});
watch(boardShots, (rows) => {
  const max = Math.max(1, Math.ceil(rows.length / pageSize));
  if (boardPage.value > max) boardPage.value = max;
});
function ensureBoard() {
  const items = boardItems.value;
  if (!items.length) {
    selectedImportKey.value = '';
    return;
  }
  if (!items.some(item => item.key === selectedImportKey.value)) {
    const live = items.find(item => !item.deleted) || items[0];
    selectedImportKey.value = live.key;
  }
}
function hasOverride(row, field) {
  return Array.isArray(row.overridden_fields) && row.overridden_fields.includes(field);
}
function openShotDrawer(row, mode) {
  shotDrawerMode.value = mode === 'edit' ? 'edit' : 'detail';
  generateShotId.value = String(row.id);
  generateOpen.value = true;
}
function pinnedSentence(row) {
  const chapter = (detail.value?.imports || []).find(item => String(item.id) === String(row.import_id));
  const body = String(chapter?.body || '');
  const line = String(row.dialogue || '').trim();
  if (!body || !line || !body.includes(line)) return '';
  const parts = body.split(/(?<=[。！？!?；;\n])/);
  return (parts.find(part => part.includes(line)) || line).trim();
}
async function removeShotGroup(item) {
  try {
    const extra = item.importId == null ? '' : '左侧这条快照也会一并去掉。';
    await ElMessageBox.confirm(
      `删除「${item.title}」的 ${item.count} 条分镜？分镜上的提示词、资产绑定、配音和产物会一起删除。${extra}`,
      '删除分镜',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await request(`/projects/${route.params.id}/shots/purge`, {
      method: 'post',
      data: { import_id: item.importId },
    });
    await load();
    ElMessage.success(item.importId == null ? '已删除未关联的分镜和产物' : '已删除快照、分镜和产物');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
function openOutputs(row) {
  if (embedded.value) {
    router.replace({ query: { node: 'preview', shot: String(row.id) } });
    return;
  }
  router.push({ path: `/projects/${route.params.id}/shots/${row.id}/outputs`, query: { from: 'work' } });
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
async function loadNovelBrief(novelId) {
  novelBrief.value = null;
  if (!novelId) return;
  novelLoading.value = true;
  try {
    novelBrief.value = await request(`/novel-catalog/${novelId}`);
  } catch (err) {
    novelBrief.value = null;
    ElMessage.warning(err.message || '小说基础信息没有加载出来');
  } finally {
    novelLoading.value = false;
  }
}
async function loadPackages(novelId) {
  packageDesk.value = null;
  if (!novelId) return;
  try {
    packageDesk.value = await request(`/novel-catalog/${novelId}/packages`);
    if (!packageVersion.value && packageDesk.value?.versions?.length) {
      packageVersion.value = packageDesk.value.versions[0].version;
    }
  } catch {
    packageDesk.value = null;
  }
}
function onPackageVersion() {
  chapterId.value = '';
}
async function onNovelChange() {
  chapterId.value = '';
  packageVersion.value = null;
  await Promise.all([
    loadChapters(projectForm.source_novel_id),
    loadNovelBrief(projectForm.source_novel_id),
    loadPackages(projectForm.source_novel_id),
  ]);
}
async function load() {
  detail.value = await request(`/projects/${route.params.id}`);
  fillProject();
  ensureBoard();
  await loadPackages(projectForm.source_novel_id);
}
async function saveProject() {
  try {
    await request(`/projects/${route.params.id}`, {
      method: 'put',
      data: {
        name: projectForm.name,
        source_novel_id: isLocal.value ? null : (projectForm.source_novel_id || null),
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
    const data = { novel_id: projectForm.source_novel_id, chapter_id: chapterId.value };
    if (packageVersion.value && packageDesk.value?.package_id) {
      data.package_id = packageDesk.value.package_id;
      data.version = packageVersion.value;
    }
    const updating = pullLabel.value === '更新到此版本';
    const result = updating
      ? await request(`/projects/${route.params.id}/rebase`, { method: 'post', data: { version: packageVersion.value, chapter_id: chapterId.value } })
      : await request(`/projects/${route.params.id}/imports/from-novel`, { method: 'post', data });
    await load();
    if (result?.unchanged) ElMessage.success(`这一章已经是故事包 v${result.package_version}`);
    else if (result?.preserved_shots) ElMessage.success(`已更新到 v${result.package_version}，${result.preserved_shots} 条已改过的台词或描述保持原样`);
    else if (result?.updated) ElMessage.success(`已更新到 v${result.package_version}`);
    else ElMessage.success(data.package_id ? '已按故事包版本拉取' : '已拉取章节');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
function openPromote(row) {
  promoteShotId.value = row.id;
  const source = pinnedSentence(row);
  promoteMatched.value = Boolean(source);
  promoteBefore.value = source;
  promoteDialogue.value = row.dialogue || '';
  promoteAfter.value = row.dialogue || '';
  promoteVisible.value = true;
}
async function submitPromote() {
  try {
    await request(`/shots/${promoteShotId.value}/promote`, {
      method: 'post',
      data: { before: promoteBefore.value, after: promoteAfter.value },
    });
    promoteVisible.value = false;
    ElMessage.success('已提交到叙事工作台，等待作者应用');
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
async function removeSnapshot(item) {
  try {
    await ElMessageBox.confirm(
      '删除快照会同时删除其关联的全部分镜、提示词与产物，且不可恢复。',
      '删除快照',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await request(`/projects/${route.params.id}/imports/${item.id}`, { method: 'delete' });
    selectedImportKey.value = '';
    await load();
    ElMessage.success('已删除快照及关联镜头');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
function shotDurationSec(row) {
  const sec = Number(row.duration_ms) > 0 ? Math.round(row.duration_ms / 1000) : 10;
  return Math.min(15, Math.max(8, sec));
}
function shotSizeText(row) {
  const sizes = Array.isArray(row.shot_sizes) && row.shot_sizes.length
    ? row.shot_sizes
    : String(row.shot_size || '').split(/[,，、|/]+/).map(item => item.trim()).filter(Boolean);
  return sizes.length ? sizes.join('、') : '—';
}
function cameraMoveText(row) {
  const moves = Array.isArray(row.camera_moves) && row.camera_moves.length
    ? row.camera_moves
    : String(row.camera_move || '').split(/[,，、|/]+/).map(item => item.trim()).filter(Boolean);
  return moves.length ? moves.join('、') : '—';
}
function cameraMovesOf(row) {
  if (Array.isArray(row?.camera_moves) && row.camera_moves.length) return row.camera_moves;
  return String(row?.camera_move || '').split(/[,，、|/]+/).map(item => item.trim()).filter(Boolean);
}
function ensureShotSizes(row) {
  if (!row) return [ '中景' ];
  if (Array.isArray(row.shot_sizes) && row.shot_sizes.length) return row.shot_sizes;
  const text = String(row.shot_size || '').trim();
  const list = text ? text.split(/[,，、|/]+/).map(item => item.trim()).filter(Boolean) : [];
  row.shot_sizes = list.length ? list : [ '中景' ];
  return row.shot_sizes;
}
function openScriptPage(item) {
  selectedImportKey.value = String(item.id);
  step.value = 3;
  if (embedded.value && String(route.query.node || '') !== 'script') {
    router.replace({ query: { ...route.query, node: 'script' } });
  }
}
function goSnapshotPage() {
  step.value = 2;
  if (embedded.value && String(route.query.node || '') !== 'script') {
    router.replace({ query: { ...route.query, node: 'script' } });
  }
}
function goShotsPage() {
  if (selectedScriptImport.value) selectedImportKey.value = String(selectedScriptImport.value.id);
  step.value = 4;
  if (embedded.value && String(route.query.node || '') !== 'storyboard') {
    router.replace({ query: { ...route.query, node: 'storyboard' } });
  }
}
async function removeShot(row) {
  try {
    await ElMessageBox.confirm(
      '删除这条镜头？提示词、资产绑定、配音和产物会一起删除。',
      '删除镜头',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await request(`/shots/${row.id}`, { method: 'delete' });
    await load();
    ElMessage.success('已删除镜头');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function generateScript(item) {
  draftingId.value = item.id;
  ElMessage.info('正在生成剧本并写入…');
  try {
    const data = await request(`/projects/${route.params.id}/imports/${item.id}/draft/script`, {
      method: 'post',
      timeout: 1800000,
    });
    await request(`/projects/${route.params.id}/imports/${item.id}/draft/script/apply`, {
      method: 'post',
      data: { script_data: data.script_data },
    });
    selectedImportKey.value = String(item.id);
    await load();
    ElMessage.success('剧本已生成，可点「查看剧本」');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    draftingId.value = null;
  }
}
async function generateShotOutline(item) {
  const existingCount = (detail.value?.shots || []).filter(shotRow => String(shotRow.import_id) === String(item.id)).length;
  let replace = false;
  if (existingCount) {
    try {
      await ElMessageBox.confirm(
        `该快照已有 ${existingCount} 条分镜。重新拆分会删除旧分镜后写入新列表，镜头页也会同步。`,
        '重新拆分分镜',
        { type: 'warning', confirmButtonText: '替换并拆分', cancelButtonText: '取消' },
      );
      replace = true;
    } catch {
      return;
    }
  }
  outliningId.value = item.id;
  ElMessage.info('正在按剧本拆分分镜并落库（8—15 秒/段）…');
  try {
    const data = await request(`/projects/${route.params.id}/imports/${item.id}/draft/shot-outline`, {
      method: 'post',
      timeout: 1800000,
      data: { replace },
    });
    selectedImportKey.value = String(item.id);
    if (data?.project && Array.isArray(data.shots)) {
      detail.value = data;
      fillProject();
    } else {
      await load();
    }
    selectedImportKey.value = String(item.id);
    const importId = String(item.id);
    const count = (detail.value?.shots || []).filter(shotRow => String(shotRow.import_id ?? '') === importId).length;
    if (!count) {
      const total = (detail.value?.shots || []).length;
      const created = Number(data?.created) || 0;
      ElMessage.error(created > 0
        ? `后端称已创建 ${created} 条，但当前快照 ${importId} 下仍看不到（项目共 ${total} 条）。请刷新页面。`
        : '拆分未写入镜头。请确认已重启后端；若刚升级，刷新后再点一次「拆分分镜」。');
      return;
    }
    ElMessage.success(`已落库 ${count} 段分镜（镜头ID 已生成），刷新后仍会保留；请逐行点「生成分镜提示词」`);
    await nextTick();
    document.getElementById('script-shot-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    outliningId.value = null;
  }
}
async function clearScriptShots(item) {
  try {
    await ElMessageBox.confirm(
      '一键删除将清空该剧本下全部分镜（镜头页同步清空），提示词与产物一并删除。',
      '一键删除分镜',
      { type: 'warning', confirmButtonText: '删除全部', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  try {
    await request(`/projects/${route.params.id}/imports/${item.id}/shots/clear`, { method: 'post' });
    await load();
    ElMessage.success('已清空分镜');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
async function expandOutlineRow(row) {
  const item = selectedScriptImport.value;
  if (!item || !row?.description?.trim()) {
    ElMessage.warning('请先填写本段涵盖的剧本内容');
    return;
  }
  expandingKey.value = String(row.id);
  ElMessage.info(`正在生成 ${row.shot_code || row.id} 的分镜提示词（约 ${shotDurationSec(row)} 秒）…`);
  const signal = ensureController().signal;
  try {
    await request(`/projects/${route.params.id}/imports/${item.id}/draft/shot-expand`, {
      method: 'post',
      timeout: 1800000,
      signal,
      data: {
        shot_id: row.id,
        coverage: row.description,
        duration_sec: shotDurationSec(row),
        shot_sizes: ensureShotSizes(row),
        shot_size: ensureShotSizes(row).join(','),
        camera_moves: cameraMovesOf(row),
        camera_move: cameraMovesOf(row).join(','),
        dialogue: row.dialogue,
      },
    });
    await load();
    ElMessage.success(`${row.shot_code || row.id} 已更新；可到「镜头」页查看，不会自动跳转`);
  } catch (err) {
    if (!isStop(err)) ElMessage.error(err.message);
  } finally {
    expandingKey.value = '';
  }
}
function rollSeed() {
  const digits = 8 + Math.floor(Math.random() * 3);
  const min = 10 ** (digits - 1);
  return min + Math.floor(Math.random() * (10 ** digits - min));
}
function taskNote(task) {
  if (!task) return '';
  if (task.status === 'saving') return '正在保存产物';
  if (task.phase === 'queued') return task.queue_ahead > 0 ? `排队，前面还有 ${task.queue_ahead} 个` : '排队中';
  if (task.progress_max > 0) return `${task.progress_value || 0}/${task.progress_max}`;
  return { queued: '排队中', running: '生成中', success: '完成', failed: task.error_message || '失败' }[task.status] || '';
}
async function waitTask(taskId, item, signal) {
  for (;;) {
    if (signal?.aborted) throw stopError();
    const fresh = await request(`/projects/${route.params.id}`, { signal });
    detail.value = fresh;
    ensureBoard();
    const latest = (fresh.tasks || []).find(row => String(row.id) === String(taskId));
    if (!latest) throw new Error('任务记录消失');
    writeNote(item, taskNote(latest));
    if (latest.status === 'cancelled') throw stopError();
    if ([ 'queued', 'running', 'saving' ].includes(latest.status)) {
      await pause(1000, signal);
      continue;
    }
    if (latest.status !== 'success') {
      const err = new Error(latest.error_message || '视频生成失败');
      if (isMissingPositive(err)) err.skip = true;
      throw err;
    }
    return latest;
  }
}
function hasBothPrompts(row) {
  const prompt = row?.prompt || {};
  return Boolean(String(prompt.positive_zh || '').trim() && String(prompt.negative_zh || '').trim());
}
async function runPromptShot(row, item, signal) {
  if (hasBothPrompts(row)) {
    const err = new Error(`${row.shot_code || row.id} 已有正向和负向提示词`);
    err.skip = true;
    throw err;
  }
  const current = selectedBoard.value;
  if (!current?.importId) throw new Error('未关联快照不能生成提示词');
  item.status = '进行中';
  const sizes = ensureShotSizes(row);
  const moves = cameraMovesOf(row);
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (signal?.aborted) throw stopError();
    writeNote(item, attempt === 1 ? '等待服务端写回提示词' : `第 ${attempt} 次生成提示词`);
    try {
      await request(`/projects/${route.params.id}/imports/${current.importId}/draft/shot-expand`, {
        method: 'post',
        timeout: 1800000,
        signal,
        data: {
          shot_id: row.id,
          coverage: row.description,
          description: row.description,
          dialogue: row.dialogue,
          duration_sec: row.duration_ms ? row.duration_ms / 1000 : 10,
          shot_sizes: sizes,
          shot_size: sizes.join(','),
          camera_moves: moves,
          camera_move: moves.join(','),
        },
      });
      await load();
      const saved = (detail.value?.shots || []).find(shotRow => String(shotRow.id) === String(row.id));
      if (!saved?.prompt?.positive_zh) {
        throw new Error(`${row.shot_code || row.id} 没有写回正向提示词`);
      }
      item.status = '完成';
      writeNote(item, attempt === 1
        ? (saved.prompt.negative_zh ? '已写回提示词' : '负向提示词未写回')
        : `第 ${attempt} 次已写回提示词`);
      return;
    } catch (err) {
      if (isStop(err) || signal?.aborted) throw stopError();
      lastError = err;
    }
  }
  throw new Error(`已试 3 次：${lastError?.message || '失败'}`);
}
async function runVideoShot(row, item, signal) {
  item.status = '进行中';
  await load();
  const saved = (detail.value?.shots || []).find(shotRow => String(shotRow.id) === String(row.id));
  if (!String(saved?.prompt?.positive_zh || '').trim()) {
    const err = new Error(`${row.shot_code || row.id} 没有正向提示词`);
    err.skip = true;
    throw err;
  }
  const live = (detail.value.tasks || [])
    .filter(task => String(task.shot_id) === String(row.id) && [ 'queued', 'running', 'saving' ].includes(task.status))
    .sort((a, b) => Number(b.id) - Number(a.id))[0];
  if (live) {
    writeNote(item, '已有生成任务，等待完成');
    await waitTask(live.id, item, signal);
    item.status = '完成';
    writeNote(item, '视频已生成');
    return;
  }
  const inputs = await request('/generate-inputs', { signal });
  const workflows = inputs.workflows || [];
  const savedWorkflow = workflows.find(entry => entry.id === Number(saved?.workflow_id) && entry.media === 'video');
  const bound = (detail.value.bindings || []).filter(entry => String(entry.shot_id) === String(row.id)).map(entry => Number(entry.asset_id));
  let hasRef = false;
  if (!savedWorkflow && bound.length) {
    const packs = await request(`/projects/${route.params.id}/refmods`, { signal });
    const packAssets = new Set((Array.isArray(packs) ? packs : []).map(entry => Number(entry.asset_id)));
    hasRef = bound.some(id => packAssets.has(id));
  }
  const workflow = savedWorkflow
    || (hasRef
      ? workflows.find(entry => entry.media === 'video' && /满血-h3-文生视频/i.test(entry.name) && /\[refmod\]/i.test(entry.name))
      : null)
    || workflows.find(entry => entry.media === 'video' && entry.name === '满血-h3-文生视频')
    || workflows.find(entry => entry.media === 'video' && String(entry.name).includes('文生视频') && !/refmod/i.test(entry.name));
  if (!workflow) throw new Error('没有找到文生视频工作流');
  if (hasRef && !/\[refmod\]/i.test(workflow.name)) {
    throw new Error('这条镜头绑了 RefMod 参考图，但没有找到能引用这些图的 [RefMod] 工作流');
  }
  const kind = /\[refmod\]/i.test(workflow.name) ? 'refmod' : 't2v';
  const seed = rollSeed();
  writeNote(item, `种子 ${seed}`);
  const task = await request(`/projects/${route.params.id}/shots/${row.id}/generate?kind=${kind}`, {
    method: 'post',
    signal,
    data: {
      positive_zh: saved.prompt.positive_zh,
      negative_zh: saved.prompt.negative_zh || '',
      workflow_id: workflow.id,
      asset_ids: bound,
      duration_sec: saved.duration_ms ? Math.round(saved.duration_ms / 1000) : 10,
      seed,
    },
  });
  if (task?.status === 'cancelled') throw stopError();
  if (!task?.id) throw new Error('没有拿到生成任务');
  if (task.status === 'failed') {
    const err = new Error(task.error_message || '视频生成失败');
    if (isMissingPositive(err)) err.skip = true;
    throw err;
  }
  if (task.status !== 'success') await waitTask(task.id, item, signal);
  await load();
  item.status = '完成';
  writeNote(item, '视频已生成');
}
async function runAuto(mode) {
  if (autoRunning.value) return;
  const shots = boardShots.value.slice();
  if (!shots.length) {
    ElMessage.error('当前快照没有镜头');
    return;
  }
  const token = ++autoToken;
  const controller = ensureController();
  const signal = controller.signal;
  autoRunning.value = true;
  recordPage.value = 1;
  autoPrompt.done = 0;
  autoPrompt.total = mode === 'video' ? 0 : shots.length;
  autoVideo.done = 0;
  autoVideo.total = mode === 'prompt' ? 0 : shots.length;
  const queue = [];
  if (mode !== 'video') {
    shots.forEach(row => queue.push({
      key: `p-${row.id}-${token}`,
      shotId: row.id,
      shotCode: row.shot_code || String(row.id),
      kind: 'prompt',
      note: '',
    }));
  }
  if (mode !== 'prompt') {
    shots.forEach(row => queue.push({
      key: `v-${row.id}-${token}`,
      shotId: row.id,
      shotCode: row.shot_code || String(row.id),
      kind: 'video',
      note: '',
    }));
  }
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let stopped = false;
  try {
    for (const item of queue) {
      if (token !== autoToken || signal.aborted) break;
      const record = openRecord(item);
      item.record = record;
      try {
        const row = (detail.value?.shots || []).find(shotRow => String(shotRow.id) === String(item.shotId));
        if (!row) throw new Error('镜头已不在表格里');
        if (item.kind === 'prompt') await runPromptShot(row, item, signal);
        else await runVideoShot(row, item, signal);
        record.result = '成功';
        if (!record.reason) record.reason = item.kind === 'prompt' ? '已写回提示词' : '视频已生成';
        succeeded += 1;
      } catch (err) {
        if (isStop(err) || signal.aborted) {
          record.result = '已停止';
          record.reason = '已停止';
          stopped = true;
        } else if (err?.skip || (item.kind === 'video' && isMissingPositive(err))) {
          record.result = '跳过';
          record.reason = err?.message || (item.kind === 'prompt' ? '已有正向和负向提示词' : '没有正向提示词');
          skipped += 1;
        } else {
          record.result = '失败';
          record.reason = err?.message || '失败';
          failed += 1;
        }
      } finally {
        if (item.kind === 'prompt') autoPrompt.done += 1;
        else autoVideo.done += 1;
      }
      if (stopped) break;
    }
    if (!stopped && !signal.aborted) {
      const parts = [ `成功 ${succeeded}` ];
      if (failed) parts.push(`失败 ${failed}`);
      if (skipped) parts.push(`跳过 ${skipped}`);
      if (failed) ElMessage.warning(`执行结束，${parts.join('，')}`);
      else if (skipped) ElMessage.success(`执行结束，${parts.join('，')}`);
      else ElMessage.success('执行结束');
    }
  } finally {
    if (token === autoToken) autoRunning.value = false;
    if (runController === controller) runController = null;
  }
}
function resetShotForm() {
  shot.description = '';
  shot.positive_zh = '';
  shot.shot_sizes = [ '中景' ];
  shot.camera_moves = [ '固定' ];
}
function openShotCreate() {
  if (!selectedBoard.value) return;
  resetShotForm();
  shotCreateOpen.value = true;
}
async function addShot() {
  const current = selectedBoard.value;
  if (!current) return;
  const sizes = Array.isArray(shot.shot_sizes) && shot.shot_sizes.length ? shot.shot_sizes : [ '中景' ];
  const moves = Array.isArray(shot.camera_moves) && shot.camera_moves.length ? shot.camera_moves : [ '固定' ];
  try {
    await request(`/projects/${route.params.id}/shots`, {
      method: 'post',
      data: {
        ...shot,
        shot_sizes: sizes,
        shot_size: sizes.join(','),
        camera_moves: moves,
        camera_move: moves.join(','),
        import_id: current.importId,
      },
    });
    shotCreateOpen.value = false;
    resetShotForm();
    await load();
    ElMessage.success('已新增镜头');
  } catch (err) {
    ElMessage.error(err.message || '没有新增');
  }
}
watch(() => props.launchShotId, (id) => {
  if (!id) return;
  shotDrawerMode.value = 'detail';
  generateShotId.value = id;
  generateOpen.value = true;
}, { immediate: true });
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
  await Promise.all([
    loadChapters(projectForm.source_novel_id),
    loadNovelBrief(projectForm.source_novel_id),
  ]);
});
</script>

<style scoped>
.cartoon-shot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cartoon-shot-head .cartoon-module__title { margin: 0; }
.cartoon-shot-head__side { display: flex; align-items: center; gap: 12px; }
.cartoon-auto-progress {
  color: #1f3d2c;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.cartoon-shot-page {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}
.cartoon-shot-page :deep(.el-tabs) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cartoon-shot-page :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}
.cartoon-shot-page :deep(.el-tab-pane) {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.cartoon-shot-page :deep(.el-tab-pane) > .el-table {
  flex: 1 1 0;
  min-height: 120px;
}
.cartoon-drawer-footer { display: flex; flex-direction: column; gap: 8px; }
.cartoon-drawer-footer__actions { display: flex; justify-content: flex-end; gap: 8px; }
.cartoon-setting-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 24px;
  row-gap: 0;
}
.cartoon-coverage { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
.cartoon-snap { margin-bottom: 12px; }
.cartoon-snap__body { max-height: 100px; overflow: hidden; }
.cartoon-snap__body.is-open { max-height: none; }
.cartoon-snap__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}
.cartoon-snap__actions :deep(.el-button + .el-button) { margin-left: 0; }
.cartoon-board { display: flex; gap: 16px; align-items: stretch; width: 100%; min-width: 0; min-height: 0; flex: 1; overflow: hidden; }
.cartoon-board__snaps { flex: 0 0 240px; display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow: auto; }
.cartoon-board__label { margin: 0; color: #5c6b62; font-size: 13px; }
.cartoon-board__snap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  text-align: left;
  border: 1px solid rgba(47, 138, 91, 0.25);
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
}
.cartoon-board__snap.is-active { border-color: #2f8a5b; background: #eef7f1; }
.cartoon-board__snap-title { flex: 1 1 100%; font-weight: 600; }
.cartoon-board__snap-count { color: #5c6b62; font-size: 12px; }
.cartoon-board__main { flex: 1; min-width: 0; min-height: 0; overflow: hidden; display: flex; flex-direction: column; }
.cartoon-shot-table { width: 100%; }
.cartoon-pager { margin-top: 12px; justify-content: flex-end; }
.cartoon-board__head { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; margin-bottom: 12px; }
.cartoon-script { margin-top: 8px; }
.cartoon-script h4 { margin: 16px 0 8px; font-size: 15px; }
.cartoon-script__list { margin: 0; padding-left: 1.2em; }
.cartoon-script__scene { margin-bottom: 12px; padding: 10px 12px; border: 1px solid rgba(47, 138, 91, 0.18); border-radius: 8px; background: #f7fbf8; }
@media (max-width: 900px) {
  .cartoon-setting-grid { grid-template-columns: 1fr; }
}
.cartoon-status-tag {
  margin: 0 4px 4px;
}
</style>
