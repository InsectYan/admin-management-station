<template>
  <section class="novel-intents">
    <header>
      <h3>叙事分镜</h3>
      <p>顺序、意图、台词、情绪、出场人物、地点和来源场次。这里不写运镜和画面提示词。</p>
    </header>
    <el-form label-position="top" class="novel-entry-form">
      <div class="novel-entry-grid">
        <el-form-item class="is-wide" label="来源剧本">
          <el-select v-model="form.script_id" clearable placeholder="先有剧本再挂分镜" style="width: 100%">
            <el-option v-for="script in scripts" :key="script.id" :label="script.title" :value="script.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="顺序">
          <el-input-number v-model="form.sort_order" :min="1" />
        </el-form-item>
        <el-form-item label="场次">
          <el-input-number v-model="form.scene_order" :min="0" />
        </el-form-item>
        <el-form-item class="is-wide" label="意图">
          <el-input v-model="form.intent" placeholder="这一镜讲什么" />
        </el-form-item>
        <el-form-item class="is-wide" label="台词">
          <el-input v-model="form.dialogue" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="情绪">
          <el-input v-model="form.emotion" />
        </el-form-item>
        <el-form-item label="地点">
          <el-input v-model="form.location" />
        </el-form-item>
        <el-form-item class="is-wide" label="出场人物">
          <el-select v-model="form.character_ids" multiple style="width: 100%">
            <el-option v-for="person in characters" :key="person.id" :label="person.name" :value="String(person.id)" />
          </el-select>
        </el-form-item>
      </div>
    </el-form>
    <div class="novel-entry-actions">
      <el-button :loading="suggesting" @click="suggest">生成建议</el-button>
      <el-button type="primary" :loading="saving" @click="save">{{ form.id ? '保存分镜' : '添加分镜' }}</el-button>
      <el-button v-if="form.id" @click="reset">取消</el-button>
      <el-button :disabled="!shots.length" @click="downloadJson">导出 JSON</el-button>
      <el-button :disabled="!shots.length" @click="downloadCsv">导出 CSV</el-button>
    </div>
    <p v-if="suggestion">{{ suggestion.reply || `已整理 ${suggestion.shots.length} 条。点写入后才会保存。` }}</p>
    <div v-if="suggestion">
      <el-button type="primary" :loading="writing" @click="writeSuggestion">写入这些分镜</el-button>
    </div>
    <el-empty v-if="!shots.length" description="还没有叙事分镜" />
    <el-table v-else :data="shots" size="small">
      <el-table-column prop="sort_order" label="序" width="60" />
      <el-table-column prop="intent" label="意图" />
      <el-table-column prop="dialogue" label="台词" />
      <el-table-column prop="location" label="地点" width="120" />
      <el-table-column label="" width="200">
        <template #default="{ row }">
          <a v-if="row.video" :href="videoHref(row.video)" target="_blank" rel="noreferrer">看生产分镜</a>
          <el-button link type="primary" @click="edit(row)">编辑</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  createIntentShot,
  deleteIntentShot,
  fetchIntentShots,
  fetchNovel,
  fetchScripts,
  suggestIntentShots,
  updateIntentShot,
} from '../../../services/novelService.js';

const props = defineProps({
  novelId: { type: [Number, String], required: true },
});

const shots = ref([]);
const scripts = ref([]);
const characters = ref([]);
const saving = ref(false);
const suggesting = ref(false);
const writing = ref(false);
const suggestion = ref(null);
const form = reactive(emptyForm());

function emptyForm() {
  return {
    id: null,
    script_id: null,
    sort_order: 1,
    scene_order: 1,
    intent: '',
    dialogue: '',
    emotion: '',
    location: '',
    character_ids: [],
  };
}

function reset() {
  Object.assign(form, emptyForm());
}

function edit(row) {
  Object.assign(form, {
    id: row.id,
    script_id: row.script_id,
    sort_order: row.sort_order,
    scene_order: row.scene_order,
    intent: row.intent,
    dialogue: row.dialogue,
    emotion: row.emotion,
    location: row.location,
    character_ids: [ ...(row.character_ids || []) ],
  });
}

function videoHref(video) {
  const path = `/media/cartoon/projects/${video.project_id}/tasks/${video.task_id || 1}?node=storyboard&shot=${video.shot_id}`;
  if (!window.location.port || window.location.port === '5100') return path;
  return `http://${window.location.hostname}:5105${path}`;
}

function saveFile(name, text, type) {
  const blob = new Blob([ text ], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadJson() {
  saveFile('叙事分镜.json', `${JSON.stringify(shots.value, null, 2)}\n`, 'application/json');
}

function downloadCsv() {
  const header = [ '顺序', '场次', '意图', '台词', '情绪', '地点' ];
  const lines = shots.value.map(row => [ row.sort_order, row.scene_order, row.intent, row.dialogue, row.emotion, row.location ]
    .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
    .join(','));
  saveFile('叙事分镜.csv', `\uFEFF${[ header.join(','), ...lines ].join('\n')}\n`, 'text/csv');
}

async function load() {
  const [list, scriptList, novel] = await Promise.all([
    fetchIntentShots(props.novelId),
    fetchScripts(props.novelId),
    fetchNovel(props.novelId),
  ]);
  shots.value = list || [];
  scripts.value = scriptList || [];
  characters.value = novel?.setting_json?.characters || [];
}

async function suggest() {
  if (!form.script_id) {
    ElMessage.warning('先选择剧本');
    return;
  }
  suggesting.value = true;
  suggestion.value = null;
  try {
    suggestion.value = await suggestIntentShots(props.novelId, { script_id: form.script_id });
    ElMessage.success('建议已返回，还没有写入分镜');
  } catch (err) {
    ElMessage.error(err.message || '叙事分镜建议没有生成');
  } finally {
    suggesting.value = false;
  }
}

async function writeSuggestion() {
  const rows = suggestion.value?.shots || [];
  if (!rows.length) return;
  writing.value = true;
  try {
    for (const row of rows) {
      await createIntentShot(props.novelId, row);
    }
    suggestion.value = null;
    reset();
    await load();
    ElMessage.success('叙事分镜已写入');
  } catch (err) {
    ElMessage.error(err.message || '写入失败');
    await load();
  } finally {
    writing.value = false;
  }
}

async function save() {
  saving.value = true;
  const payload = { ...form, id: undefined };
  try {
    if (form.id) await updateIntentShot(props.novelId, form.id, payload);
    else await createIntentShot(props.novelId, payload);
    reset();
    await load();
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

function hasSuggestion() {
  return Boolean(suggestion.value?.shots?.length);
}

function applyFromPatch(patch) {
  const rows = Array.isArray(patch?.intent_shots) ? patch.intent_shots : [];
  if (!rows.length) {
    ElMessage.info('这一轮没有可填入的叙事分镜');
    return;
  }
  const byName = new Map((characters.value || []).map(person => [ person.name, String(person.id) ]));
  suggestion.value = {
    shots: rows.map((row, index) => {
      const names = Array.isArray(row.characters)
        ? row.characters
        : String(row.characters || '').split(/[、,，]/);
      const ids = (Array.isArray(row.character_ids) ? row.character_ids : []).map(id => String(id));
      names.forEach(name => {
        const id = byName.get(String(name || '').trim());
        if (id && !ids.includes(id)) ids.push(id);
      });
      return {
        script_id: form.script_id || row.script_id || null,
        sort_order: Number(row.sort_order) || index + 1,
        scene_order: Number(row.scene_order) || 1,
        intent: row.intent || '',
        dialogue: row.dialogue || '',
        emotion: row.emotion || '',
        location: row.location || '',
        character_ids: ids,
      };
    }),
    reply: '',
  };
  ElMessage.success(`已整理 ${rows.length} 条，点写入后才会保存`);
}

defineExpose({ applyFromPatch, hasSuggestion, writeSuggestion });

async function remove(row) {
  try {
    await ElMessageBox.confirm('删除这条叙事分镜？已发布的故事包不会变。', '删除分镜', { type: 'warning' });
  } catch {
    return;
  }
  await deleteIntentShot(props.novelId, row.id);
  if (form.id === row.id) reset();
  await load();
}

onMounted(() => {
  load().catch(err => ElMessage.error(err.message || '叙事分镜加载失败'));
});
</script>

<style scoped>
.novel-intents { display: flex; flex-direction: column; gap: 12px; }
.novel-intents header p { margin: 4px 0 0; color: var(--el-text-color-secondary); }
.novel-intents a { margin-right: 8px; }
</style>
