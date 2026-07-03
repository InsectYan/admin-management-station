<template>
  <div v-if="fields.length" class="inject-bindings">
    <el-divider content-position="left">注入字段配置</el-divider>
    <div v-for="field in fields" :key="field.key" class="inject-row">
      <div class="inject-label">
        <strong>{{ field.label || field.key }}</strong>
        <span class="meta">{{ field.location || 'body' }} · {{ field.json_path || field.key }}</span>
      </div>
      <el-radio-group
        v-model="bindings[field.key].mode"
        :disabled="readonly"
        size="small"
        @change="sync"
      >
        <el-radio-button label="manual">手动输入</el-radio-button>
        <el-radio-button label="sample_set">样本集</el-radio-button>
      </el-radio-group>
      <div v-if="bindings[field.key].mode === 'manual'" class="inject-value">
        <el-input
          v-model="bindings[field.key].value"
          :disabled="readonly"
          placeholder="固定值或提示词"
          @input="sync"
        />
      </div>
      <div v-else class="inject-value inject-sample">
        <el-select
          v-model="bindings[field.key].sample_set_id"
          :disabled="readonly"
          filterable
          placeholder="选择文本/注入样本集"
          style="width:100%"
          @change="sync"
        >
          <el-option
            v-for="s in sampleSets"
            :key="s.id"
            :label="`${s.name} (${s.sample_count || 0}条)`"
            :value="s.id"
          />
        </el-select>
        <el-input
          v-model="bindings[field.key].field_key"
          :disabled="readonly"
          placeholder="样本字段 key，默认同 inject key"
          style="margin-top:6px"
          @input="sync"
        />
        <p class="hint">选用样本集时，每条样本触发一次执行（仅该字段变化）</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { fetchSampleSets } from '@/services/fitnessService.js';

const props = defineProps({
  fields: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
  apiTemplateId: { type: [ Number, String ], default: null },
});

const emit = defineEmits([ 'update:modelValue' ]);

const sampleSets = ref([]);
const bindings = reactive({});

function ensureBinding(key) {
  if (!bindings[key]) {
    bindings[key] = { mode: 'manual', value: '', sample_set_id: null, field_key: key };
  }
}

function applyFields() {
  const keys = new Set(Object.keys(bindings));
  for (const f of props.fields) {
    ensureBinding(f.key);
    keys.delete(f.key);
  }
  for (const k of keys) delete bindings[k];
  for (const f of props.fields) {
    const src = props.modelValue?.[f.key];
    if (src && typeof src === 'object') {
      Object.assign(bindings[f.key], {
        mode: src.mode || 'manual',
        value: src.value ?? '',
        sample_set_id: src.sample_set_id ?? null,
        field_key: src.field_key || f.key,
      });
    }
  }
}

function sync() {
  const out = {};
  for (const f of props.fields) {
    const b = bindings[f.key];
    if (!b) continue;
    out[f.key] = {
      mode: b.mode,
      value: b.value,
      sample_set_id: b.sample_set_id,
      field_key: b.field_key || f.key,
    };
  }
  emit('update:modelValue', out);
}

async function loadSampleSets() {
  const params = { pageSize: 100, set_type: 'text' };
  if (props.apiTemplateId) params.api_template_id = props.apiTemplateId;
  const data = await fetchSampleSets(params);
  let list = data.list || [];
  if (!list.length) {
    const injectData = await fetchSampleSets({
      pageSize: 100,
      set_type: 'inject',
      api_template_id: props.apiTemplateId || undefined,
    });
    list = injectData.list || [];
  } else {
    const injectData = await fetchSampleSets({
      pageSize: 100,
      set_type: 'inject',
      api_template_id: props.apiTemplateId || undefined,
    });
    const ids = new Set(list.map(s => s.id));
    for (const s of injectData.list || []) {
      if (!ids.has(s.id)) list.push(s);
    }
  }
  sampleSets.value = list;
}

watch(() => props.fields, applyFields, { deep: true, immediate: true });
watch(() => props.modelValue, applyFields, { deep: true });
watch(() => props.apiTemplateId, loadSampleSets);

onMounted(loadSampleSets);
</script>

<style scoped>
.inject-row { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ebeef5; }
.inject-label { margin-bottom: 8px; }
.inject-label .meta { margin-left: 8px; color: #909399; font-size: 12px; }
.inject-value { margin-top: 8px; }
.hint { color: #909399; font-size: 12px; margin: 6px 0 0; }
</style>
