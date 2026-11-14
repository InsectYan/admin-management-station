<template>
  <PageShell v-if="shot" :title="plain ? '' : (shot.description || '生成产物')">
    <template v-if="!plain" #extra>
      <el-button link type="primary" @click="back">← 返回</el-button>
      <el-button @click="openOutputs">查看产物</el-button>
    </template>
    <section class="cartoon-module">
      <p class="cartoon-module__hint">{{ chapterTitle }}</p>
      <el-form label-position="top">
        <el-tabs v-model="formTab">
        <el-tab-pane label="文本" name="text" :lazy="false">
        <el-form-item label="类型">
          <el-button :type="media === 'image' ? 'primary' : 'default'" :disabled="readOnly" @click="media = 'image'">生图</el-button>
          <el-button :type="media === 'video' ? 'primary' : 'default'" :disabled="readOnly" @click="media = 'video'">生视频</el-button>
        </el-form-item>
        <el-form-item label="工作流">
          <el-select v-model="workflowId" filterable placeholder="选择工作流" style="width: 100%">
            <el-option v-for="item in choices" :key="item.id" :label="workflowLabel(item)" :value="item.id" />
          </el-select>
          <p class="cartoon-module__hint">生图列出文生图和改图。生视频列出文生视频、首尾帧、图生视频。带 [RefMod] 的工作流会把参考图和开头的角色锁定一起交给模型。选了首尾帧后要确认首帧；尾帧可以不传，不传就只按首帧生成。</p>
        </el-form-item>
        <el-form-item label="主景别">
          <el-select v-model="shotSizes" multiple collapse-tags :disabled="readOnly" style="width: 100%" placeholder="多选景别">
            <el-option v-for="item in sizeOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="主运镜">
          <el-select v-model="cameraMoves" multiple collapse-tags :disabled="readOnly" style="width: 100%" placeholder="多选运镜">
            <el-option v-for="item in moveOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <template v-if="media === 'image'">
        <el-form-item label="这次生成">
          <el-button :type="imageFrame === 'start' ? 'primary' : 'default'" :disabled="readOnly" @click="imageFrame = 'start'">首帧</el-button>
          <el-button :type="imageFrame === 'end' ? 'primary' : 'default'" :disabled="readOnly" @click="imageFrame = 'end'">尾帧</el-button>
        </el-form-item>
        <el-form-item label="首帧提示词">
          <el-input v-model="frameStartText" type="textarea" :rows="8" :readonly="readOnly" />
        </el-form-item>
        <el-form-item label="尾帧提示词">
          <el-input v-model="frameEndText" type="textarea" :rows="8" :readonly="readOnly" />
        </el-form-item>
        </template>
        <el-form-item v-else label="视频提示词">
          <el-input v-model="promptText" type="textarea" :rows="12" :readonly="readOnly" />
        </el-form-item>
        <el-form-item label="负向提示词">
          <el-input v-model="negativeText" type="textarea" :rows="4" :readonly="readOnly" />
        </el-form-item>
        <el-form-item v-for="row in stageRows" :key="row.key" :label="row.label">
          <p v-if="readOnly" style="margin: 0; white-space: pre-wrap; color: #5c6b62; line-height: 1.6">{{ stageNotes[row.bucket][row.name] || '未填写本章说明' }}</p>
          <el-input
            v-else
            v-model="stageNotes[row.bucket][row.name]"
            type="textarea"
            :rows="2"
            maxlength="500"
            placeholder="本章说明，可以不填。只写这一章和资产不一样的地方"
            @change="persistStage"
          />
        </el-form-item>
        <el-form-item v-if="conditionAssets.length || stageLineText" :label="media === 'video' ? '送给模型的提示词' : '这次的生成条件'">
          <el-input :model-value="conditionPreview" type="textarea" :rows="6" readonly />
        </el-form-item>
        <el-form-item v-if="media === 'video'" label="时长（秒）">
          <el-input-number v-model="durationSec" :min="1" :max="60" :step="1" :precision="0" />
          <p class="cartoon-module__hint">按这条工作流的帧率写成帧数，并对齐到模型要求的倍数。生图不用填。</p>
        </el-form-item>
        <p v-if="contractError" class="cartoon-module__hint">{{ contractError }}</p>
        </el-tab-pane>
        <el-tab-pane label="图片" name="image" :lazy="false">
        <el-form-item label="关联资产">
          <el-select v-model="assetIds" multiple filterable :disabled="readOnly" placeholder="可多选角色、场景、道具" style="width: 100%">
            <el-option-group v-for="group in assetGroups" :key="group.kind" :label="group.label">
              <el-option v-for="item in group.items" :key="item.id" :label="item.name" :value="item.id" />
            </el-option-group>
          </el-select>
          <div v-if="assetMarks.length" class="cartoon-asset-marks">
            <span
              v-for="item in assetMarks"
              :key="`${item.asset_id || 'x'}-${item.name}`"
              class="cartoon-asset-mark"
              :class="item.state === 'have' ? 'is-have' : 'is-miss'"
            >{{ item.name }}</span>
          </div>
          <p class="cartoon-module__hint">绿色是已经关联的资产。红色是当前剧情或提示词里还没有关联上的，没有资产记录的名字也不能选。</p>
          <div v-if="linkedSheets.length" class="cartoon-linked-sheets">
            <figure v-for="(item, index) in linkedSheets" :key="item.key">
              <el-image
                :src="item.url"
                fit="cover"
                :preview-src-list="linkedPreview"
                :initial-index="index"
                preview-teleported
                hide-on-click-modal
              />
              <figcaption>{{ kindLabel(item.kind) }} · {{ item.name }}</figcaption>
            </figure>
          </div>
          <p v-if="!readOnly" class="cartoon-module__hint">生图按选择顺序带上人物、场景、道具的描述，这次选中的首帧或尾帧提示词附在最后。生视频只要选中角色（含剧情里自动关联上的），就把该角色的 RefMod 锁定写在提示词开头。保存时按当前提示词和剧情再校验一次。</p>
          <div v-if="refmodChoices.length" class="cartoon-refmod-pick">
            <p class="cartoon-module__hint">勾选这镜要用的参考图。说明写在资产的 RefMod 里，生成时按编号分开写。</p>
            <div v-for="item in refmodChoices" :key="item.id" class="cartoon-refmod-pick__asset">
              <p>{{ kindLabel(item.kind) }}「{{ item.name }}」</p>
              <label v-for="image in item.images" :key="image.name" class="cartoon-refmod-pick__row">
                <el-checkbox
                  :model-value="image.checked"
                  :disabled="readOnly"
                  @change="checked => setRefmodPick(item.id, image.name, checked)"
                />
                <img :src="image.url" alt="" />
                <span>{{ image.note || '参考图' }}</span>
              </label>
            </div>
          </div>
        </el-form-item>
        <el-form-item v-if="needsRefmod" label="RefMod 对应">
          <div class="cartoon-refmod-plan">
            <p v-if="!picturePlan.length" class="cartoon-module__hint">先选中已经绑了 RefMod 的角色或场景。剧情里自动关联上的角色和场景也算。</p>
            <div v-for="item in picturePlan" :key="item.id" class="cartoon-refmod-bind">
              <p class="cartoon-module__hint">
                <template v-if="item.count">{{ kindLabel(item.kind) }}「{{ item.name }}」 · {{ item.count }} 张</template>
                <template v-else-if="item.hasPack">{{ kindLabel(item.kind) }}「{{ item.name }}」这镜没有勾选参考图</template>
                <template v-else>{{ kindLabel(item.kind) }}「{{ item.name }}」还没有 RefMod，只写入提示词</template>
              </p>
              <button v-if="item.count" type="button" class="cartoon-refmod-strip" @click="openRefmodDetail(item)">
                <img v-for="image in item.images.slice(0, 4)" :key="image.name" :src="image.url" alt="" />
                <span v-if="item.images.length > 4">+{{ item.images.length - 4 }}</span>
              </button>
            </div>
            <p class="cartoon-module__hint">点图片组查看全部参考图。生成时按这个顺序把角色锁定写在提示词开头，并挂上对应参考图。</p>
          </div>
        </el-form-item>
        <el-form-item v-if="usesFrames || hasStoredFrames" label="首尾帧">
          <p v-if="usesFrames" class="cartoon-module__hint">{{ frameChoiceText }}</p>
          <div class="cartoon-frame-row">
            <figure v-if="frameSrc('manual')">
              <el-image :src="frameSrc('manual')" fit="contain" :preview-src-list="[frameSrc('manual')]" preview-teleported hide-on-click-modal :style="frameBox('manual')" />
              <figcaption>生成的首帧</figcaption>
            </figure>
            <figure v-if="frameSrc('end')">
              <el-image :src="frameSrc('end')" fit="contain" :preview-src-list="[frameSrc('end')]" preview-teleported hide-on-click-modal :style="frameBox('end')" />
              <figcaption>生成的尾帧</figcaption>
            </figure>
            <figure v-if="frameSrc('auto')">
              <el-image :src="frameSrc('auto')" fit="contain" :preview-src-list="[frameSrc('auto')]" preview-teleported hide-on-click-modal :style="frameBox('auto')" />
              <figcaption>上镜尾帧</figcaption>
            </figure>
          </div>
        </el-form-item>
        <el-form-item v-for="slot in slots" :key="slot.id" :label="slot.label">
          <div class="cartoon-image-field">
            <el-upload
              :key="`${workflowId}-${slot.id}`"
              v-model:file-list="imageLists[slot.id]"
              class="cartoon-image-upload"
              action="#"
              list-type="picture"
              accept="image/png,image/jpeg,image/webp"
              :auto-upload="false"
              :limit="1"
              :on-change="file => onImage(slot, file)"
              :on-remove="() => clearImage(slot)"
              :on-exceed="files => replaceImage(slot, files)"
            >
              <el-button type="primary" plain>选择图片</el-button>
            </el-upload>
            <p class="cartoon-module__hint">{{ slot.role === 'end' ? '尾帧可以不传。不传就只按首帧生成。' : (slot.role === 'start' ? '上传后记为指定首帧，生成时优先于上镜尾帧。' : slot.spec) }}</p>
          </div>
        </el-form-item>
        </el-tab-pane>
        </el-tabs>
      </el-form>
    </section>
    <el-dialog v-model="refmodDetailOpen" :title="refmodDetailTitle" width="720px" append-to-body>
      <div v-if="refmodDetail" class="cartoon-refmod-detail">
        <figure v-for="image in refmodDetail.images" :key="image.name">
          <img :src="image.url" alt="" />
          <figcaption>{{ image.note || '参考图' }}</figcaption>
        </figure>
      </div>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request, resolveApiBase } from '../services/apiConfig.js';
import { useRegionLoad } from '../lib/useRegionLoad.js';

const props = defineProps({
  plain: { type: Boolean, default: false },
  shotIdOverride: { type: [ String, Number ], default: '' },
  mode: { type: String, default: 'detail' },
});
const emit = defineEmits([ 'saved', 'running' ]);
const { run: runRegionLoad } = useRegionLoad();
const readOnly = computed(() => props.mode === 'detail');
const formTab = ref('text');
const route = useRoute();
const router = useRouter();
const shot = ref(null);
const chapterTitle = ref('');
const promptText = ref('');
const frameStartText = ref('');
const frameEndText = ref('');
const imageFrame = ref('start');
const negativeText = ref('');
const shotSizes = ref([ '中景' ]);
const cameraMoves = ref([ '固定' ]);
const sizeOptions = ref([ '极远景', '远景', '全景', '中景', '近景', '特写', '大特写' ]);
const moveOptions = ref([ '固定', '推', '急推', '拉', '急拉', '摇', '移', '跟', '升', '降', '甩', '震颤', '旋转' ]);
const media = ref('video');
const durationSec = ref(10);
const workflowId = ref(null);
const contracts = ref({});
const IMAGE_TYPES = new Set([ 'image/png', 'image/jpeg', 'image/webp' ]);
const files = reactive({});
const imageLists = reactive({});
const generating = ref(false);
const packs = ref([]);
const projectAssets = ref([]);
const assetIds = ref([]);
const assetMarks = ref([]);
const refmodPicks = ref({});
const savingAssets = ref(false);
const refmodDetailOpen = ref(false);
const refmodDetail = ref(null);
let pollTimer = null;
let pollToken = 0;

let heldProjectId = '';
function projectKey() {
  const live = String(route.params.id || '');
  if (live) heldProjectId = live;
  return heldProjectId;
}
const projectId = computed(() => projectKey());
const shotId = computed(() => props.shotIdOverride || route.params.shotId || route.query.shot);
const inWorkbench = computed(() => route.name === 'workbench');
const choices = computed(() => (contracts.value.workflows || []).filter(item => item.media === media.value));
const selected = computed(() => choices.value.find(item => item.id === workflowId.value) || null);
const slots = computed(() => selected.value?.images || []);
const needsRefmod = computed(() => String(selected.value?.name || '').includes('[RefMod]'));
const visualAssets = computed(() => projectAssets.value.filter(item => [ 'character', 'scene', 'prop' ].includes(item.kind) && !item.disabled));
const assetGroups = computed(() => [
  { kind: 'character', label: '角色', items: visualAssets.value.filter(item => item.kind === 'character') },
  { kind: 'scene', label: '场景', items: visualAssets.value.filter(item => item.kind === 'scene') },
  { kind: 'prop', label: '道具', items: visualAssets.value.filter(item => item.kind === 'prop') },
].filter(group => group.items.length));
const selectedAssets = computed(() => assetIds.value
  .map(id => visualAssets.value.find(item => item.id === id))
  .filter(Boolean));
function storedAssetUrls(asset) {
  return [ asset?.reference_path, ...String(asset?.angle_paths || '').split('\n') ]
    .map(item => String(item || '').trim())
    .filter(item => item.startsWith('/projects/'));
}
const linkedSheets = computed(() => {
  const rows = [];
  selectedAssets.value.forEach(asset => {
    storedAssetUrls(asset).forEach(item => {
      rows.push({
        key: `${asset.id}-${item}`,
        name: asset.name,
        kind: asset.kind,
        url: `${resolveApiBase()}${item}`,
      });
    });
  });
  return rows;
});
const linkedPreview = computed(() => linkedSheets.value.map(item => item.url));
const assetsLocked = computed(() => {
  const fields = shot.value?.overridden_fields;
  return Array.isArray(fields) && fields.includes('assets');
});
function mentionedVisualIds(text, assets) {
  const catalog = assets
    .filter(asset => (asset.kind === 'character' || asset.kind === 'scene') && String(asset.name || '').trim())
    .slice()
    .sort((a, b) => b.name.length - a.name.length);
  const source = String(text || '');
  const occupied = [];
  const ids = [];
  catalog.forEach(asset => {
    let from = 0;
    while (from < source.length) {
      const at = source.indexOf(asset.name, from);
      if (at < 0) break;
      const end = at + asset.name.length;
      const overlap = occupied.some(span => at < span.end && end > span.start);
      if (!overlap) {
        occupied.push({ start: at, end });
        ids.push(asset.id);
        break;
      }
      from = at + 1;
    }
  });
  return ids;
}
const lockVisuals = computed(() => {
  const ids = [];
  assetIds.value.forEach(id => {
    const asset = visualAssets.value.find(item => item.id === id);
    if ((asset?.kind === 'character' || asset?.kind === 'scene') && !ids.includes(id)) ids.push(id);
  });
  if (!assetsLocked.value) {
    const text = [ shot.value?.description, shot.value?.dialogue, promptText.value, frameStartText.value, frameEndText.value, negativeText.value ]
      .filter(Boolean)
      .join('\n');
    mentionedVisualIds(text, visualAssets.value).forEach(id => {
      if (!ids.includes(id)) ids.push(id);
    });
  }
  return ids.map(id => visualAssets.value.find(item => item.id === id)).filter(Boolean);
});
const conditionAssets = computed(() => (media.value === 'video' ? lockVisuals.value : selectedAssets.value));
function packOf(assetId) {
  return packs.value.find(item => item.asset_id === assetId) || null;
}
function pickedNames(assetId, pack) {
  const names = pack?.images || [];
  const picked = refmodPicks.value[String(assetId)];
  if (!Array.isArray(picked)) return names.slice();
  const allow = new Set(picked);
  return names.filter(name => allow.has(name));
}
function setRefmodPick(assetId, name, checked) {
  const pack = packOf(assetId);
  const names = pack?.images || [];
  const current = Array.isArray(refmodPicks.value[String(assetId)])
    ? refmodPicks.value[String(assetId)].slice()
    : names.slice();
  const next = new Set(current);
  if (checked) next.add(name);
  else next.delete(name);
  refmodPicks.value = {
    ...refmodPicks.value,
    [String(assetId)]: names.filter(item => next.has(item)),
  };
}
function refmodFilesPayload() {
  const out = {};
  assetIds.value.forEach(id => {
    const pack = packOf(id);
    if (!pack?.images?.length) return;
    out[id] = pickedNames(id, pack);
  });
  return out;
}
const refmodChoices = computed(() => selectedAssets.value.map(asset => {
  const pack = packOf(asset.id);
  if (!pack?.images?.length) return null;
  const picked = new Set(pickedNames(asset.id, pack));
  return {
    id: asset.id,
    name: asset.name,
    kind: asset.kind,
    images: pack.images.map(name => ({
      name,
      note: pack.notes?.[name] || '',
      url: packFileUrl(pack, name),
      checked: picked.has(name),
    })),
  };
}).filter(Boolean));
const picturePlan = computed(() => {
  let cursor = 1;
  return lockVisuals.value.map(asset => {
    const pack = packOf(asset.id);
    const names = pack ? pickedNames(asset.id, pack) : [];
    const count = names.length;
    const hasPack = Boolean(pack?.images?.length);
    const from = count ? cursor : 0;
    if (count) cursor += count;
    return {
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      count,
      hasPack,
      from,
      to: count ? from + count - 1 : 0,
      images: names.map(name => ({
        name,
        note: pack?.notes?.[name] || '',
        url: packFileUrl(pack, name),
      })),
    };
  });
});
const refmodDetailTitle = computed(() => (
  refmodDetail.value ? `${kindLabel(refmodDetail.value.kind)}「${refmodDetail.value.name}」` : 'RefMod'
));
const chapterScript = ref({ characters: [], places: [] });
const stageNotes = reactive({ characters: {}, places: {} });
const stageRows = computed(() => {
  const rows = [];
  (chapterScript.value.characters || []).forEach(person => {
    if (!person?.name) return;
    rows.push({ key: `c:${person.name}`, bucket: 'characters', name: person.name, label: `角色说明·${person.name}` });
  });
  (chapterScript.value.places || []).forEach(place => {
    if (!place?.name) return;
    rows.push({ key: `p:${place.name}`, bucket: 'places', name: place.name, label: `场景说明·${place.name}` });
  });
  return rows;
});
const stageLineText = computed(() => {
  const lines = [];
  stageRows.value.forEach(row => {
    const note = String(stageNotes[row.bucket]?.[row.name] || '').trim();
    if (!note) return;
    const kind = row.bucket === 'places' ? '场景' : '角色';
    lines.push(`本章说明：${kind}「${row.name}」在这一章的差别：${note}`);
  });
  return lines.join('\n');
});
const activePrompt = computed(() => (
  media.value === 'image'
    ? (imageFrame.value === 'end' ? frameEndText.value : frameStartText.value)
    : promptText.value
));
const conditionPreview = computed(() => {
  const base = composeCondition(
    conditionAssets.value,
    activePrompt.value,
    media.value === 'video' && needsRefmod.value,
    packs.value,
    media.value === 'video',
  );
  return [ base, stageLineText.value ].filter(Boolean).join('\n');
});
const usesFrames = computed(() => slots.value.some(slot => slot.role === 'start' || slot.role === 'end'));
const hasStoredFrames = computed(() => Boolean(frameSrc('manual') || frameSrc('end') || frameSrc('auto')));
const frameChoiceText = computed(() => {
  if (files[startSlotId()]?.data_base64 || shot.value?.manual_frame_path) return '这次用指定首帧。尾帧可以不传。';
  if (shot.value?.first_frame_path) return '这次用上镜尾帧，也就是上一个镜头最新视频的尾帧。尾帧可以不传。';
  return '还没有首帧。请上传一张，会记为指定首帧。尾帧可以不传。';
});
function startSlotId() {
  return slots.value.find(slot => slot.role === 'start')?.id || '';
}
function frameSrc(which) {
  if (!shotId.value) return '';
  if (which === 'end') {
    if (!shot.value?.end_frame_mtime) return '';
    return `${resolveApiBase()}/projects/${projectId.value}/shots/${shotId.value}/frame/end?v=${shot.value.end_frame_mtime}`;
  }
  const stored = which === 'manual' ? shot.value?.manual_frame_path : shot.value?.first_frame_path;
  if (!stored) return '';
  const version = which === 'manual' ? shot.value?.manual_frame_mtime : shot.value?.first_frame_mtime;
  return `${resolveApiBase()}/projects/${projectId.value}/shots/${shotId.value}/frame/${which}?v=${version || encodeURIComponent(stored)}`;
}
function frameBox(which) {
  const width = Number(which === 'end' ? shot.value?.end_frame_width : (which === 'manual' ? shot.value?.manual_frame_width : shot.value?.first_frame_width)) || 0;
  const height = Number(which === 'end' ? shot.value?.end_frame_height : (which === 'manual' ? shot.value?.manual_frame_height : shot.value?.first_frame_height)) || 0;
  const base = { objectFit: 'contain', borderRadius: '6px', background: '#e7f3eb', display: 'block' };
  const long = 96;
  if (!width || !height) return { ...base, height: `${long}px`, width: 'auto' };
  if (height >= width) return { ...base, height: `${long}px`, width: `${Math.max(36, Math.round(long * width / height))}px` };
  return { ...base, width: `${long}px`, height: `${Math.max(36, Math.round(long * height / width))}px` };
}
async function persistStage() {
  try {
    await request(`/shots/${shotId.value}`, {
      method: 'put',
      data: { stage_notes: stagePayload() },
    });
  } catch (err) {
    ElMessage.error(err.message || '本章说明没有保存');
  }
}
function stagePayload() {
  return {
    characters: { ...stageNotes.characters },
    places: { ...stageNotes.places },
  };
}
function placesOfScript(data) {
  if (Array.isArray(data?.places) && data.places.length) return data.places;
  const seen = new Set();
  const list = [];
  (data?.scenes || []).forEach(scene => {
    let title = String(scene?.title || '').replace(/^Scene\s*\d+\s*[:：]\s*/i, '').trim();
    const cut = title.split(/\s[-—]\s/)[0].trim();
    if (cut) title = cut;
    if (!title || seen.has(title)) return;
    seen.add(title);
    list.push({ name: title, stage_note: '' });
  });
  return list;
}
function fillStage(data, saved) {
  const notes = saved && typeof saved === 'object' ? saved : {};
  const characters = {};
  const places = {};
  (data?.characters || []).forEach(person => {
    if (!person?.name) return;
    characters[person.name] = Object.prototype.hasOwnProperty.call(notes.characters || {}, person.name)
      ? String(notes.characters[person.name] ?? '')
      : String(person.stage_note || '');
  });
  placesOfScript(data).forEach(place => {
    if (!place?.name) return;
    places[place.name] = Object.prototype.hasOwnProperty.call(notes.places || {}, place.name)
      ? String(notes.places[place.name] ?? '')
      : String(place.stage_note || '');
  });
  chapterScript.value = {
    characters: data?.characters || [],
    places: placesOfScript(data),
  };
  stageNotes.characters = characters;
  stageNotes.places = places;
}
const submitKind = computed(() => {
  if (needsRefmod.value) return 'refmod';
  if (media.value === 'image') return slots.value.length ? 'edit' : 'image';
  if (slots.value.some(slot => slot.role === 'end') || slots.value.length >= 2) return 'video';
  if (slots.value.length) return 'i2v';
  return 't2v';
});
const contractError = computed(() => contracts.value.error || '');
function packFileUrl(pack, name) {
  return `${resolveApiBase()}/projects/${projectId.value}/refmods/${pack.id}/files/${encodeURIComponent(name)}`;
}
function openRefmodDetail(item) {
  refmodDetail.value = item;
  refmodDetailOpen.value = true;
}
function kindLabel(kind) {
  return { character: '人物', scene: '场景', prop: '道具' }[kind] || '资产';
}
function assetBrief(asset) {
  const bits = [];
  const push = value => {
    const text = String(value || '').trim();
    if (text) bits.push(text);
  };
  push(asset.description);
  if (asset.kind === 'character') {
    push(asset.consistency_note);
    if (String(asset.costume_note || '').trim()) bits.push(`服装：${String(asset.costume_note).trim()}`);
    if (String(asset.expression_note || '').trim()) bits.push(`表情：${String(asset.expression_note).trim()}`);
  }
  if (asset.kind === 'scene') push(asset.scene_type);
  if (asset.kind === 'prop') push(asset.prop_category);
  return bits.join('。');
}
function composeCondition(assets, shotPrompt, pictures, packRows, lock) {
  const rows = lock ? assets.filter(asset => asset.kind === 'character' || asset.kind === 'scene') : assets;
  const lines = [];
  let cursor = 1;
  rows.forEach(asset => {
    const pack = packRows.find(item => item.asset_id === asset.id);
    const names = pictures && pack ? pickedNames(asset.id, pack) : [];
    const who = lock
      ? `${asset.kind === 'scene' ? '场景' : '角色'}「${asset.name}」`
      : `${kindLabel(asset.kind)}「${asset.name}」`;
    const pictureLines = names.map(name => {
      const note = String(pack?.notes?.[name] || '').trim();
      const line = note
        ? `<Picture ${cursor}>：${note}。这张图属于${who}`
        : `<Picture ${cursor}> 是${who}的参考图`;
      cursor += 1;
      return line;
    });
    const brief = assetBrief(asset);
    if (lock) {
      const head = pictureLines.length
        ? `${pictureLines.join('\n')}\n这些图都是${who}，按每张图自己的说明使用，不要互相替代`
        : (asset.kind === 'scene'
          ? `${who}。锁定这个场景的空间、陈设和结构，本段画面保持一致`
          : `${who}。锁定这张脸、体态和服装，本段画面保持一致`);
      lines.push(brief ? `${head}。${brief}` : head);
      return;
    }
    const head = pictureLines.length ? pictureLines.join('\n') : who;
    lines.push(brief ? `${head}。${brief}` : head);
  });
  const shot = String(shotPrompt || '').trim();
  if (!lines.length) return shot;
  if (lock) return [ lines.join('\n'), shot ].filter(Boolean).join('\n');
  return [ lines.join('\n'), shot ? `镜头：${shot}` : '' ].filter(Boolean).join('\n');
}

function workflowLabel(item) {
  const duplicated = choices.value.filter(row => row.name === item.name).length > 1;
  return duplicated ? `${item.name} #${item.id}` : item.name;
}
const jobLive = ref(false);
const jobPercent = ref(0);
const jobMax = ref(0);
const jobNote = ref('');
const jobWaiting = computed(() => jobLive.value && jobPercent.value === 0 && jobMax.value === 0);
function progressText(task) {
  if (task.status === 'saving') return '正在保存产物';
  if (task.phase === 'queued') {
    return task.queue_ahead > 0 ? `排队，前面还有 ${task.queue_ahead} 个` : '排队中';
  }
  if (task.progress_max > 0) {
    const node = task.node ? `节点 ${task.node} ` : '';
    return `${node}${task.progress_value}/${task.progress_max}`;
  }
  if (task.node) return `节点 ${task.node}，等待这一步的步数`;
  return '正在生成，等待 ComfyUI 回报步数';
}
function statusLabel(status) {
  return { queued: '排队', running: '生成中', saving: '生成中', success: '成功', failed: '失败', cancelled: '已停止' }[status] || status;
}
let activeTaskId = '';
let generateAbort = null;
let haltQuiet = false;
function publishRunning(live, taskId) {
  emit('running', { live: Boolean(live), taskId: taskId || activeTaskId || '' });
}
function isStop(err) {
  return err?.code === 'ERR_CANCELED'
    || err?.name === 'CanceledError'
    || err?.name === 'AbortError'
    || [ 'canceled', '已停止' ].includes(err?.message);
}
function back() {
  if (inWorkbench.value) {
    router.replace({ query: { node: 'storyboard' } });
    return;
  }
  if (route.query.from === 'work') {
    router.push({ path: `/projects/${projectId.value}/work`, query: { step: '4' } });
    return;
  }
  router.push({ path: `/projects/${projectId.value}`, query: { tab: route.query.tab || '3' } });
}
function rollSeed() {
  const digits = 8 + Math.floor(Math.random() * 3);
  const min = 10 ** (digits - 1);
  return min + Math.floor(Math.random() * (10 ** digits - min));
}
function openAssets() {
  if (inWorkbench.value) {
    router.replace({ query: { node: 'assets' } });
    return;
  }
  router.push({ path: `/projects/${projectId.value}`, query: { tab: 'assets' } });
}
function openOutputs() {
  if (inWorkbench.value) {
    router.replace({ query: { node: 'preview', shot: String(shotId.value) } });
    return;
  }
  router.push({
    path: `/projects/${projectId.value}/shots/${shotId.value}/outputs`,
    query: { from: route.query.from || 'detail', tab: route.query.tab || '3' },
  });
}
function stopPoll() {
  pollToken += 1;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
function resetFiles() {
  Object.keys(files).forEach(key => { delete files[key]; });
  Object.keys(imageLists).forEach(key => { delete imageLists[key]; });
  primeStoredFrames();
}
function primeStoredFrames() {
  const start = slots.value.find(slot => slot.role === 'start');
  if (!start) return;
  const which = shot.value?.manual_frame_path ? 'manual' : (shot.value?.first_frame_path ? 'auto' : '');
  if (!which) return;
  imageLists[start.id] = [{
    name: which === 'manual' ? '指定首帧' : '上镜尾帧',
    url: frameSrc(which),
    status: 'success',
    uid: which,
  }];
}
function ensureList(slotId) {
  if (!imageLists[slotId]) imageLists[slotId] = [];
}
function readImage(slot, file) {
  if (!file) return;
  if (file.type && !IMAGE_TYPES.has(file.type)) {
    ElMessage.warning('请上传 png、jpg 或 webp');
    imageLists[slot.id] = [];
    delete files[slot.id];
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const data = String(reader.result || '');
    files[slot.id] = { filename: file.name, data_base64: data };
    if (slot.role === 'start') storeManual(data);
  };
  reader.readAsDataURL(file);
}
function onImage(slot, uploadFile) {
  ensureList(slot.id);
  readImage(slot, uploadFile?.raw);
}
function clearImage(slot) {
  delete files[slot.id];
}
async function storeManual(dataUrl) {
  try {
    const saved = await request(`/projects/${projectId.value}/shots/${shotId.value}/frame`, {
      method: 'post',
      data: { data_base64: dataUrl },
    });
    if (shot.value) shot.value.manual_frame_path = saved?.manual_frame_path || 'frames/manual.png';
    emit('saved');
  } catch (err) {
    ElMessage.error(err.message || '首帧没有记下');
  }
}
function replaceImage(slot, picked) {
  const file = picked?.[0];
  if (!file) return;
  imageLists[slot.id] = [{
    name: file.name,
    url: URL.createObjectURL(file),
    status: 'ready',
    uid: Date.now(),
    raw: file,
  }];
  readImage(slot, file);
}
async function load() {
  await runRegionLoad(async () => {
  const [detail, meta] = await Promise.all([
    request(`/projects/${projectId.value}`),
    request('/meta').catch(() => null),
  ]);
  if (meta?.shot_sizes?.length) sizeOptions.value = meta.shot_sizes;
  if (meta?.camera_moves?.length) moveOptions.value = meta.camera_moves;
  const found = (detail.shots || []).find(item => String(item.id) === String(shotId.value));
  if (!found) {
    ElMessage.error('分镜不存在');
    if (!props.plain) back();
    return;
  }
  shot.value = found;
  projectAssets.value = detail.assets || [];
  const bound = (detail.bindings || [])
    .filter(item => String(item.shot_id) === String(found.id))
    .map(item => item.asset_id);
  assetIds.value = bound.filter(id => projectAssets.value.some(asset => asset.id === id && [ 'character', 'scene', 'prop' ].includes(asset.kind) && !asset.disabled));
  assetMarks.value = Array.isArray(found.asset_marks) ? found.asset_marks : [];
  const picks = {};
  (detail.bindings || []).filter(item => String(item.shot_id) === String(found.id)).forEach(item => {
    if (item.refmod_files == null || item.refmod_files === '') return;
    try {
      const names = JSON.parse(item.refmod_files);
      if (Array.isArray(names)) picks[String(item.asset_id)] = names;
    } catch {
      // 旧绑定没有图集选择时，默认用全部参考图。
    }
  });
  refmodPicks.value = picks;
  promptText.value = found.prompt?.positive_zh || '';
  frameStartText.value = found.prompt?.frame_start_zh || '';
  frameEndText.value = found.prompt?.frame_end_zh || '';
  negativeText.value = found.prompt?.negative_zh || '';
  shotSizes.value = Array.isArray(found.shot_sizes) && found.shot_sizes.length ? found.shot_sizes.slice() : [ '中景' ];
  cameraMoves.value = Array.isArray(found.camera_moves) && found.camera_moves.length
    ? found.camera_moves.slice()
    : String(found.camera_move || '固定').split(/[,，、|/]+/).map(item => item.trim()).filter(Boolean);
  if (Number(found.duration_ms) > 0) {
    durationSec.value = Math.min(60, Math.max(1, Math.round(found.duration_ms / 1000)));
  } else {
    durationSec.value = 10;
  }
  const chapter = (detail.imports || []).find(item => String(item.id) === String(found.import_id));
  chapterTitle.value = chapter?.chapter_title || '未关联快照';
  fillStage(chapter?.script_data || {}, found.stage_notes);
  try {
    contracts.value = await request('/generate-inputs');
    packs.value = await request(`/projects/${projectId.value}/refmods`) || [];
    const savedWorkflow = (contracts.value.workflows || []).find(item => item.id === Number(found.workflow_id));
    if (savedWorkflow) {
      echoing = true;
      media.value = savedWorkflow.media || 'video';
      workflowId.value = savedWorkflow.id;
      echoing = false;
    } else {
      pickDefault(media.value);
    }
    const live = (detail.tasks || [])
      .filter(item => String(item.shot_id) === String(found.id) && [ 'queued', 'running', 'saving' ].includes(item.status))
      .sort((a, b) => Number(b.id) - Number(a.id))[0];
    if (live) {
      const workflow = (contracts.value.workflows || []).find(item => item.id === live.precheck_workflow_id);
      if (workflow) {
        echoing = true;
        media.value = workflow.media || 'video';
        workflowId.value = workflow.id;
        echoing = false;
      }
      beginPoll(live);
    }
  } catch (err) {
    ElMessage.error(err.message);
  }
  primeStoredFrames();
  });
}
let echoing = false;
function pickDefault(nextMedia) {
  const list = (contracts.value.workflows || []).filter(item => item.media === nextMedia);
  const nameOf = item => String(item?.name || '');
  const textToVideo = nextMedia === 'video'
    ? (list.find(item => /满血-h3-文生视频/i.test(nameOf(item)) && /\[refmod\]/i.test(nameOf(item)))
      || list.find(item => nameOf(item).includes('文生视频') && /\[refmod\]/i.test(nameOf(item)))
      || list.find(item => nameOf(item) === '满血-h3-文生视频'))
    : null;
  const preferred = nextMedia === 'image' ? contracts.value.image?.workflow_id : null;
  const found = textToVideo || list.find(item => item.id === preferred) || list[0];
  workflowId.value = found ? found.id : null;
}
function jobPercentOf(task) {
  if (!task) return 0;
  if (task.status === 'success') return 100;
  if (task.status === 'saving') return 99;
  const max = Number(task.progress_max) || 0;
  const value = Number(task.progress_value) || 0;
  if (max > 0) return Math.min(99, Math.round((value / max) * 100));
  const percent = Number(task.progress_percent);
  return Number.isFinite(percent) ? Math.min(99, Math.max(0, Math.round(percent))) : 0;
}
function beginPoll(task) {
  stopPoll();
  const id = projectKey();
  const taskId = task.id;
  activeTaskId = taskId;
  jobLive.value = true;
  publishRunning(true, taskId);
  jobPercent.value = jobPercentOf(task);
  jobMax.value = Number(task?.progress_max) || 0;
  jobNote.value = progressText(task);
  if (!id) return;
  pollTimer = setInterval(async () => {
    const ticket = ++pollToken;
    try {
      const detail = await request(`/projects/${id}`);
      if (ticket !== pollToken) return;
      const latest = (detail.tasks || []).find(item => String(item.id) === String(taskId));
      if (!latest || [ 'queued', 'running', 'saving' ].includes(latest.status)) {
        if (!latest) return;
        jobPercent.value = jobPercentOf(latest);
        jobMax.value = Number(latest.progress_max) || 0;
        jobNote.value = progressText(latest);
        return;
      }
      stopPoll();
      jobPercent.value = latest.status === 'success' ? 100 : 0;
      jobLive.value = false;
      publishRunning(false, taskId);
      if (latest.status === 'success') {
        ElMessage.success('生成成功');
        emit('saved');
      }
      else if (latest.status === 'cancelled') {
        jobNote.value = '已停止';
        if (!haltQuiet) ElMessage.info(latest.error_message || '已停止');
      } else if (!haltQuiet) ElMessage.error(latest.error_message || statusLabel(latest.status));
    } catch (err) {
      if (ticket !== pollToken) return;
      stopPoll();
      jobLive.value = false;
      publishRunning(false, taskId);
      if (!haltQuiet && !isStop(err)) ElMessage.error(err.message);
    }
  }, 3000);
}
function haltJob() {
  haltQuiet = true;
  generateAbort?.abort();
  stopPoll();
  generating.value = false;
  jobLive.value = false;
  jobNote.value = '已停止';
  publishRunning(false, activeTaskId);
}
async function saveAssets() {
  savingAssets.value = true;
  try {
    await request(`/shots/${shotId.value}`, {
      method: 'put',
      data: {
        shot_sizes: shotSizes.value,
        camera_moves: cameraMoves.value,
        duration_sec: Number(durationSec.value) || undefined,
        workflow_id: workflowId.value,
        stage_notes: stagePayload(),
        positive_zh: promptText.value,
        frame_start_zh: frameStartText.value,
        frame_end_zh: frameEndText.value,
        negative_zh: negativeText.value,
      },
    });
    const saved = await request(`/projects/${projectId.value}/shots/${shotId.value}/assets`, {
      method: 'put',
      data: {
        asset_ids: assetIds.value,
        positive_zh: promptText.value,
        frame_start_zh: frameStartText.value,
        frame_end_zh: frameEndText.value,
        negative_zh: negativeText.value,
        description: shot.value?.description || '',
        dialogue: shot.value?.dialogue || '',
        refmod_files: refmodFilesPayload(),
      },
    });
    assetMarks.value = saved?.marks || [];
    if (assetMarks.value.some(item => item.state === 'miss')) ElMessage.warning('已保存，还有没对上的资产');
    else ElMessage.success('已保存');
    emit('saved');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    savingAssets.value = false;
  }
}
async function generate() {
  if (!workflowId.value) {
    ElMessage.error('请选择工作流');
    return;
  }
  if (needsRefmod.value && !picturePlan.value.some(item => item.count)) {
    ElMessage.error('请选择已经绑了 RefMod 的角色或场景');
    return;
  }
  const missing = slots.value.filter(slot => {
    if (slot.role === 'end') return false;
    if (files[slot.id]?.data_base64) return false;
    if (slot.role === 'start' && (shot.value?.manual_frame_path || shot.value?.first_frame_path)) return false;
    return true;
  });
  if (missing.length) {
    ElMessage.error(`请上传${missing.map(slot => slot.label).join('、')}`);
    return;
  }
  if (media.value === 'video' && !String(promptText.value || '').trim()) {
    ElMessage.warning('请填写视频提示词');
    return;
  }
  if (media.value === 'image' && !String(activePrompt.value || '').trim()) {
    ElMessage.warning(imageFrame.value === 'end' ? '请填写尾帧提示词' : '请填写首帧提示词');
    return;
  }
  if (media.value === 'video' && !(Number(durationSec.value) >= 1)) {
    ElMessage.warning('请填写视频时长');
    return;
  }
  if (!shotSizes.value.length) {
    ElMessage.warning('请至少选一个主景别');
    return;
  }
  if (!cameraMoves.value.length) {
    ElMessage.warning('请至少选一个主运镜');
    return;
  }
  const nextSeed = rollSeed();
  haltQuiet = false;
  generateAbort = new AbortController();
  generating.value = true;
  jobLive.value = true;
  publishRunning(true);
  jobPercent.value = 0;
  jobMax.value = 0;
  jobNote.value = '排队';
  const id = projectKey();
  if (!id) {
    generating.value = false;
    jobLive.value = false;
    publishRunning(false);
    ElMessage.error('项目编号丢了');
    return;
  }
  try {
    const task = await request(`/projects/${id}/shots/${shotId.value}/generate?kind=${submitKind.value}`, {
      method: 'post',
      signal: generateAbort.signal,
      data: {
        positive_zh: promptText.value,
        frame_start_zh: frameStartText.value,
        frame_end_zh: frameEndText.value,
        frame_target: imageFrame.value,
        negative_zh: negativeText.value,
        shot_sizes: shotSizes.value,
        camera_moves: cameraMoves.value,
        images: slots.value.filter(slot => files[slot.id]?.data_base64).map(slot => ({
          slot_id: slot.id,
          filename: files[slot.id].filename,
          data_base64: files[slot.id].data_base64,
        })),
        workflow_id: workflowId.value,
        stage_notes: stagePayload(),
        asset_ids: assetIds.value,
        refmod_files: refmodFilesPayload(),
        duration_sec: media.value === 'video' ? Number(durationSec.value) : undefined,
        seed: nextSeed,
      },
    });
    if (task.status === 'cancelled') {
      jobLive.value = false;
      jobNote.value = '已停止';
      publishRunning(false);
      if (!haltQuiet) ElMessage.info(task.error_message || '已停止');
    } else if (task.status === 'failed') {
      jobLive.value = false;
      publishRunning(false);
      ElMessage.error(task.error_message || '生成失败');
    } else if (task.status === 'success') {
      jobLive.value = false;
      publishRunning(false);
      ElMessage.success('生成成功');
    }
    if ([ 'queued', 'running', 'saving' ].includes(task.status)) beginPoll(task);
  } catch (err) {
    jobLive.value = false;
    publishRunning(false);
    if (!haltQuiet && !isStop(err)) ElMessage.error(err.message);
  } finally {
    generating.value = false;
  }
}
watch(media, () => {
  if (echoing) return;
  pickDefault(media.value);
  resetFiles();
});
watch(workflowId, resetFiles);
watch(slots, next => {
  (next || []).forEach(slot => ensureList(slot.id));
}, { immediate: true });
watch(shotId, (id) => { if (id) load(); }, { immediate: true });
onUnmounted(() => {
  const live = jobLive.value;
  const taskId = activeTaskId;
  stopPoll();
  if (live) emit('running', { live: true, taskId });
});
defineExpose({
  saveAssets,
  generate,
  haltJob,
  openAssets,
  savingAssets,
  generating,
  jobLive,
  jobPercent,
  jobWaiting,
  jobNote,
});
</script>

<style scoped>
.cartoon-image-field { width: 100%; max-width: 420px; }
.cartoon-image-upload { display: block; }
.cartoon-generate-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cartoon-asset-marks { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.cartoon-asset-mark { padding: 0 8px; border-radius: 6px; line-height: 22px; font-size: 12px; }
.cartoon-asset-mark.is-have { color: #1f7a45; background: #e7f6ee; }
.cartoon-asset-mark.is-miss { color: #c45656; background: #fdecec; }
.cartoon-linked-sheets,
.cartoon-frame-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.cartoon-linked-sheets figure,
.cartoon-frame-row figure { margin: 0; width: 96px; }
.cartoon-linked-sheets :deep(.el-image),
.cartoon-frame-row :deep(.el-image) {
  width: 96px;
  height: 96px;
  border-radius: 8px;
  background: #eef3ef;
  cursor: zoom-in;
}
.cartoon-linked-sheets figcaption,
.cartoon-frame-row figcaption { margin-top: 4px; font-size: 12px; color: #5c6b62; line-height: 1.4; }
.cartoon-job-progress { max-width: 420px; margin-top: 12px; }
.cartoon-refmod-pick,
.cartoon-refmod-plan {
  flex: 1 0 100%;
  width: 100%;
}
.cartoon-refmod-plan {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.cartoon-refmod-bind,
.cartoon-refmod-pick__asset {
  display: block;
  width: 100%;
}
.cartoon-refmod-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.cartoon-refmod-strip img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
}
.cartoon-refmod-strip span { color: #5c6b62; }
.cartoon-refmod-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cartoon-refmod-pick__asset + .cartoon-refmod-pick__asset { margin-top: 8px; }
.cartoon-refmod-pick__row { display: flex; gap: 8px; align-items: center; margin-top: 6px; }
.cartoon-refmod-pick__row img { width: 64px; height: 64px; object-fit: cover; border-radius: 6px; }
.cartoon-refmod-detail figure { margin: 0; }
.cartoon-refmod-detail figcaption { margin-top: 4px; color: #5c6b62; font-size: 12px; }
.cartoon-refmod-detail img {
  width: 160px;
  height: 160px;
  object-fit: cover;
  border-radius: 8px;
}
.cartoon-image-upload :deep(.el-upload-list--picture .el-upload-list__item) {
  border-radius: 10px;
  border-color: rgba(47, 138, 91, 0.16);
}
</style>
