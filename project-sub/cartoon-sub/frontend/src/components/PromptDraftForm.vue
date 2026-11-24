<template>
  <section class="prompt-draft" :class="{ 'is-busy': loading || generating, 'is-contained': contained }">
    <h4 class="prompt-draft__title">单独生成提示词 · {{ partLabel }}</h4>
    <p v-if="error" class="prompt-draft__error">{{ error }}</p>
    <p v-else-if="loading" class="prompt-draft__hint">正在读取这次生成要用的入参。</p>
    <template v-else>
      <div v-for="field in fields" :key="field.key" class="prompt-draft__field">
        <label :for="fieldId(field.key)">{{ field.label }}</label>
        <p class="prompt-draft__hint">{{ field.hint }}</p>
        <el-input
          :id="fieldId(field.key)"
          v-model="field.value"
          type="textarea"
          :rows="field.rows || 2"
          resize="vertical"
        />
      </div>
      <div class="prompt-draft__field">
        <label :for="fieldId('requirement')">要求提示</label>
        <p class="prompt-draft__hint">这次额外要模型遵守的话。留空就按上面的入参写。不写入项目设定。</p>
        <el-input :id="fieldId('requirement')" v-model="requirement" type="textarea" :rows="3" resize="vertical" />
      </div>
      <div v-if="showGenerate" class="prompt-draft__actions">
        <el-button type="primary" :loading="generating" :disabled="loading" @click="generate">生成提示词</el-button>
      </div>
      <div v-for="box in boxes" :key="box.key" class="prompt-draft__field">
        <label :for="fieldId(box.key)">新提示词 · {{ box.label }}</label>
        <p class="prompt-draft__hint">可以改。再次点击生成会覆盖这里。</p>
        <el-input
          :id="fieldId(box.key)"
          v-model="prompts[box.key]"
          type="textarea"
          :rows="6"
          resize="vertical"
          @change="commitAdjust"
        />
      </div>
      <div class="prompt-draft__field">
        <label :for="fieldId('score')">生成评分</label>
        <p class="prompt-draft__hint">1 到 10。这次生成给出的分数，可以改。分数只记在生成记录里，不写进镜头。</p>
        <div class="prompt-draft__score">
          <el-input-number
            :id="fieldId('score')"
            v-model="score"
            :min="1"
            :max="10"
            :step="1"
            :precision="0"
            controls-position="right"
            @change="commitAdjust"
          />
          <el-input v-model="scoreNote" placeholder="评分说明" @change="commitAdjust" />
        </div>
      </div>
      <p v-if="warning" class="prompt-draft__hint">{{ warning }}</p>
    </template>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { request } from '../services/apiConfig.js';

const props = defineProps({
  projectId: { type: [ String, Number ], required: true },
  importId: { type: [ String, Number ], required: true },
  shotId: { type: [ String, Number ], required: true },
  part: { type: String, default: 'all' },
  scope: { type: [ String, Number ], default: '' },
  showGenerate: { type: Boolean, default: true },
  preserveOnPart: { type: Boolean, default: false },
  contained: { type: Boolean, default: false },
  deferSave: { type: Boolean, default: false },
});
const emit = defineEmits([ 'saved' ]);

const PARTS = {
  positive: { key: 'positive_zh', label: '视频' },
  frame_start: { key: 'frame_start_zh', label: '首帧' },
  frame_end: { key: 'frame_end_zh', label: '尾帧' },
};

const fields = ref([]);
const requirement = ref('');
const prompts = ref({ positive_zh: '', frame_start_zh: '', frame_end_zh: '', negative_zh: '' });
const score = ref(null);
const scoreNote = ref('');
const loading = ref(false);
const generating = ref(false);
const error = ref('');
const warning = ref('');
let recorded = '';

const partLabel = computed(() => PARTS[props.part]?.label || '视频');
const boxes = computed(() => {
  if (props.part === 'frame_start' || props.part === 'frame_end' || props.part === 'positive') {
    return [ PARTS[props.part] ];
  }
  return [ PARTS.positive, PARTS.frame_start, PARTS.frame_end ];
});
let loadToken = 0;

function fieldId(key) {
  return `prompt-draft-${props.scope || props.shotId}-${props.part}-${key}`;
}

function fingerprint() {
  return JSON.stringify({
    prompts: prompts.value,
    score: score.value,
    score_note: scoreNote.value,
  });
}

function applyResult(data, notice) {
  const incoming = {
    positive_zh: data?.prompts?.positive_zh || '',
    frame_start_zh: data?.prompts?.frame_start_zh || '',
    frame_end_zh: data?.prompts?.frame_end_zh || '',
    negative_zh: data?.prompts?.negative_zh || '',
  };
  if (props.preserveOnPart && props.part !== 'all') {
    const next = { ...prompts.value };
    if (props.part === 'positive') {
      next.positive_zh = incoming.positive_zh;
      next.negative_zh = incoming.negative_zh;
    } else if (props.part === 'frame_start') {
      next.frame_start_zh = incoming.frame_start_zh;
    } else if (props.part === 'frame_end') {
      next.frame_end_zh = incoming.frame_end_zh;
    }
    prompts.value = next;
  } else {
    prompts.value = incoming;
  }
  score.value = Number.isInteger(data?.score) ? data.score : score.value;
  scoreNote.value = data?.score_note != null ? String(data.score_note || '') : scoreNote.value;
  warning.value = data?.warning || '';
  recorded = fingerprint();
  if (data?.memory_recorded === false) ElMessage.warning('提示词已经写回，生成记录没有记下');
  else if (notice) ElMessage.success(notice);
  emit('saved');
}

async function load() {
  if (!props.projectId || !props.importId || !props.shotId) return;
  const token = ++loadToken;
  loading.value = true;
  error.value = '';
  try {
    const data = await request(`/projects/${props.projectId}/imports/${props.importId}/shots/${props.shotId}/prompt-form`);
    if (token !== loadToken) return;
    fields.value = Array.isArray(data?.fields) ? data.fields.map(item => ({ ...item })) : [];
    requirement.value = '';
    prompts.value = {
      positive_zh: data?.prompts?.positive_zh || '',
      frame_start_zh: data?.prompts?.frame_start_zh || '',
      frame_end_zh: data?.prompts?.frame_end_zh || '',
      negative_zh: data?.prompts?.negative_zh || '',
    };
    score.value = null;
    scoreNote.value = '';
    warning.value = '';
    recorded = fingerprint();
  } catch (err) {
    if (token !== loadToken) return;
    error.value = err.message || '入参没有读出来';
  } finally {
    if (token === loadToken) loading.value = false;
  }
}

function payload(action) {
  const values = {};
  fields.value.forEach(item => {
    values[item.key] = item.value;
  });
  return {
    action,
    part: props.part || 'all',
    requirement: requirement.value,
    fields: values,
    prompts: { ...prompts.value },
    score: score.value,
    score_note: scoreNote.value,
  };
}

async function generate() {
  generating.value = true;
  error.value = '';
  try {
    const data = await request(formUrl(), {
      method: 'post',
      timeout: 7200000,
      data: payload('generate'),
    });
    applyResult(data, '已生成，并覆盖下面的提示词');
  } catch (err) {
    error.value = err.message || '生成提示词失败';
    ElMessage.error(error.value);
  } finally {
    generating.value = false;
  }
}

async function confirm() {
  if (loading.value || generating.value) return false;
  try {
    const data = await request(formUrl(), {
      method: 'post',
      data: { ...payload('adjust'), part: 'all' },
    });
    recorded = fingerprint();
    if (data?.memory_recorded === false) ElMessage.warning('提示词已经写回，生成记录没有记下');
    else ElMessage.success('已写回这条镜头的视频和首尾帧提示词');
    emit('saved');
    return true;
  } catch (err) {
    ElMessage.error(err.message || '修改没有写回');
    return false;
  }
}

async function commitAdjust() {
  if (props.deferSave || loading.value || generating.value) return;
  const next = fingerprint();
  if (next === recorded) return;
  try {
    const data = await request(formUrl(), {
      method: 'post',
      data: payload('adjust'),
    });
    recorded = fingerprint();
    if (data?.memory_recorded === false) ElMessage.warning('修改已写回镜头，生成记录没有记下');
    emit('saved');
  } catch (err) {
    ElMessage.error(err.message || '修改没有写回');
  }
}

function formUrl() {
  return `/projects/${props.projectId}/imports/${props.importId}/shots/${props.shotId}/prompt-form`;
}

watch(() => [ props.projectId, props.importId, props.shotId ], load, { immediate: true });
watch(() => props.part, (next, prev) => {
  if (props.preserveOnPart) return;
  if (!prev || next === prev) return;
  load();
});

defineExpose({ generate, confirm, generating });
</script>

<style scoped>
.prompt-draft {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  max-height: 70vh;
  overflow: auto;
  padding-right: 4px;
}
.prompt-draft.is-contained { max-height: 60vh; overflow: auto; padding-right: 0; }
.prompt-draft__title { margin: 0; font-size: 15px; }
.prompt-draft__field label { font-weight: 600; }
.prompt-draft__hint { margin: 2px 0 6px; color: #5c6b62; font-size: 12px; line-height: 1.5; }
.prompt-draft__error { margin: 0; color: #b54747; }
.prompt-draft__actions { display: flex; justify-content: flex-end; }
.prompt-draft__score { display: flex; gap: 8px; align-items: center; }
.prompt-draft__score :deep(.el-input) { flex: 1; }
</style>
