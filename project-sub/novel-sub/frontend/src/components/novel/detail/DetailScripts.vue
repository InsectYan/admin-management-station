<template>
  <section class="novel-scripts">
    <header>
      <h3>剧本</h3>
      <p>场次、内外景、地点、人物、对白和动作。景别、秒数和运镜留在视频生产分镜。</p>
    </header>
    <el-form label-width="72px">
      <el-form-item label="标题">
        <el-input v-model="form.title" placeholder="例如 第一章漫剧稿" style="max-width: 320px" />
      </el-form-item>
      <el-form-item label="改写">
        <el-select v-model="form.variant" style="width: 160px">
          <el-option label="漫剧改写" value="comic" />
          <el-option label="短剧改写" value="short_drama" />
        </el-select>
      </el-form-item>
      <el-form-item label="章节">
        <el-select v-model="form.chapter_ids" multiple collapse-tags placeholder="来源章节" style="width: 320px">
          <el-option v-for="chapter in chapters" :key="chapter.chapter_id" :label="chapter.title" :value="chapter.chapter_id" />
        </el-select>
      </el-form-item>
    </el-form>
    <div v-for="(scene, index) in form.scenes" :key="index" class="novel-scripts__scene">
      <strong>第 {{ index + 1 }} 场</strong>
      <el-select v-model="scene.interior" style="width: 88px">
        <el-option label="内" value="in" />
        <el-option label="外" value="out" />
      </el-select>
      <el-input v-model="scene.location" placeholder="地点" style="width: 140px" />
      <el-input v-model="scene.characters" placeholder="人物" style="width: 140px" />
      <el-input v-model="scene.dialogue" placeholder="对白" />
      <el-input v-model="scene.action" placeholder="动作" />
      <el-button link type="danger" @click="form.scenes.splice(index, 1)">删除这场</el-button>
    </div>
    <div>
      <el-button @click="form.scenes.push(blankScene())">加一场</el-button>
      <el-button :loading="suggesting" @click="suggest">生成建议</el-button>
      <el-button type="primary" :loading="saving" @click="save">{{ form.id ? '保存剧本' : '添加剧本' }}</el-button>
      <el-button v-if="form.id" @click="reset">取消</el-button>
    </div>
    <p v-if="suggestion" class="novel-scripts__hint">{{ suggestion.reply || '建议已返回。填入表单后还要再点保存。' }}</p>
    <div v-if="suggestion">
      <el-button @click="applySuggestion">填入表单</el-button>
    </div>
    <el-empty v-if="!scripts.length" description="还没有剧本" />
    <el-table v-else :data="scripts" size="small">
      <el-table-column prop="title" label="标题" />
      <el-table-column label="改写" width="100">
        <template #default="{ row }">{{ row.variant === 'short_drama' ? '短剧改写' : '漫剧改写' }}</template>
      </el-table-column>
      <el-table-column label="场次" width="80">
        <template #default="{ row }">{{ (row.scenes || []).length }}</template>
      </el-table-column>
      <el-table-column label="" width="140">
        <template #default="{ row }">
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
  createScript,
  deleteScript,
  fetchChapterMeta,
  fetchScripts,
  suggestScript,
  updateScript,
} from '../../../services/novelService.js';

const props = defineProps({
  novelId: { type: [Number, String], required: true },
});

const scripts = ref([]);
const chapters = ref([]);
const saving = ref(false);
const suggesting = ref(false);
const suggestion = ref(null);
const form = reactive(emptyForm());

function blankScene() {
  return { interior: 'out', location: '', characters: '', dialogue: '', action: '' };
}

function emptyForm() {
  return { id: null, title: '', variant: 'comic', chapter_ids: [], scenes: [ blankScene() ] };
}

function reset() {
  const next = emptyForm();
  form.id = next.id;
  form.title = next.title;
  form.variant = next.variant;
  form.chapter_ids = next.chapter_ids;
  form.scenes = next.scenes;
}

function edit(row) {
  form.id = row.id;
  form.title = row.title;
  form.variant = row.variant || 'comic';
  form.chapter_ids = [ ...(row.chapter_ids || []) ];
  form.scenes = (row.scenes || []).map(scene => ({ ...blankScene(), ...scene }));
  if (!form.scenes.length) form.scenes = [ blankScene() ];
}

async function load() {
  const [list, meta] = await Promise.all([
    fetchScripts(props.novelId),
    fetchChapterMeta(props.novelId),
  ]);
  scripts.value = list || [];
  chapters.value = meta || [];
}

async function suggest() {
  if (!form.chapter_ids.length) {
    ElMessage.warning('先选择章节');
    return;
  }
  suggesting.value = true;
  suggestion.value = null;
  try {
    suggestion.value = await suggestScript(props.novelId, {
      chapter_ids: form.chapter_ids,
      variant: form.variant,
    });
    ElMessage.success('建议已返回，还没有写入剧本');
  } catch (err) {
    ElMessage.error(err.message || '剧本建议没有生成');
  } finally {
    suggesting.value = false;
  }
}

function applySuggestion() {
  if (!suggestion.value) return;
  form.id = null;
  form.title = suggestion.value.title || form.title;
  form.variant = suggestion.value.variant || form.variant;
  form.chapter_ids = [ ...(suggestion.value.chapter_ids || form.chapter_ids) ];
  form.scenes = (suggestion.value.scenes || []).map(scene => ({ ...blankScene(), ...scene }));
  if (!form.scenes.length) form.scenes = [ blankScene() ];
  ElMessage.success('已填入表单，点保存后才会写入');
}

async function save() {
  if (!form.title.trim()) {
    ElMessage.warning('先写标题');
    return;
  }
  saving.value = true;
  const payload = {
    title: form.title.trim(),
    variant: form.variant,
    chapter_ids: form.chapter_ids,
    scenes: form.scenes,
  };
  try {
    if (form.id) await updateScript(props.novelId, form.id, payload);
    else await createScript(props.novelId, payload);
    reset();
    await load();
  } catch (err) {
    ElMessage.error(err.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function remove(row) {
  try {
    await ElMessageBox.confirm(`删除剧本「${row.title}」？已发布的故事包不会变。`, '删除剧本', { type: 'warning' });
  } catch {
    return;
  }
  await deleteScript(props.novelId, row.id);
  if (form.id === row.id) reset();
  await load();
}

onMounted(() => {
  load().catch(err => ElMessage.error(err.message || '剧本加载失败'));
});
</script>

<style scoped>
.novel-scripts { display: flex; flex-direction: column; gap: 12px; }
.novel-scripts header p { margin: 4px 0 0; color: var(--el-text-color-secondary); }
.novel-scripts__scene { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
</style>
