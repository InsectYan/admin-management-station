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
        @change="mode => onModeChange(mode)"
      >
        <el-radio-button label="manual">手动输入</el-radio-button>
        <el-radio-button label="sample_set">文本样本集</el-radio-button>
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
          :loading="sampleSetsLoading"
          filterable
          placeholder="选择文本样本集"
          style="width:100%"
          @visible-change="onSelectVisible"
          @change="sync"
        >
          <el-option
            v-for="s in textSampleSets"
            :key="s.id"
            :label="formatSetLabel(s)"
            :value="s.id"
          />
        </el-select>
        <p v-if="!sampleSetsLoading && !textSampleSets.length" class="empty-hint">
          暂无文本样本集，请先在
          <router-link to="/fitness/execution/samples">样本集管理</router-link>
          创建「文本」类型样本集（每行一条，按字段 key 注入）
        </p>
        <el-input
          v-model="bindings[field.key].field_key"
          :disabled="readonly"
          placeholder="样本字段 key，默认同 inject key"
          style="margin-top:6px"
          @input="sync"
        />
        <p class="hint">文本样本集每条记录注入一次；field_key 对应样本 input_data 中的字段名</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { fetchSampleSets } from '@/services/fitnessService.js';

const props = defineProps({
  fields: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
  readonly: { type: Boolean, default: false },
  itemId: { type: String, default: '' },
});

const emit = defineEmits([ 'update:modelValue' ]);

const sampleSets = ref([]);
const sampleSetsLoading = ref(false);
const bindings = reactive({});
let applyingFromProps = false;

const textSampleSets = computed(() => {
  const list = sampleSets.value;
  if (!props.itemId) return list;
  return [ ...list ].sort((a, b) => {
    const aLinked = a.item_id === props.itemId ? 0 : 1;
    const bLinked = b.item_id === props.itemId ? 0 : 1;
    return aLinked - bLinked || b.id - a.id;
  });
});

function formatSetLabel(s) {
  const count = s.sample_count || 0;
  const linked = s.item_id && s.item_id === props.itemId ? ' · 本用例' : '';
  return `${s.name} (${count}条)${linked}`;
}

function ensureBinding(key) {
  if (!bindings[key]) {
    bindings[key] = { mode: 'manual', value: '', sample_set_id: null, field_key: key };
  }
}

function applyFields() {
  applyingFromProps = true;
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
  applyingFromProps = false;
}

function sync() {
  if (applyingFromProps) return;
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
  sampleSetsLoading.value = true;
  try {
    const res = await fetchSampleSets({ set_type: 'text', pageSize: 200 });
    sampleSets.value = res.list || [];
  } catch {
    sampleSets.value = [];
  } finally {
    sampleSetsLoading.value = false;
  }
}

function onModeChange(mode) {
  if (mode === 'sample_set' && !sampleSets.value.length && !sampleSetsLoading.value) {
    loadSampleSets();
  }
  sync();
}

function onSelectVisible(visible) {
  if (visible && !sampleSets.value.length && !sampleSetsLoading.value) {
    loadSampleSets();
  }
}

watch(() => props.fields, applyFields, { deep: true, immediate: true });
watch(() => props.modelValue, applyFields, { deep: true });
watch(() => props.itemId, loadSampleSets, { immediate: true });
</script>

<style scoped>
.inject-row { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ebeef5; }
.inject-label { margin-bottom: 8px; }
.inject-label .meta { margin-left: 8px; color: #909399; font-size: 12px; }
.inject-value { margin-top: 8px; }
.hint { color: #909399; font-size: 12px; margin: 6px 0 0; }
.empty-hint { color: #e6a23c; font-size: 12px; margin: 6px 0 0; }
.empty-hint a { color: #409eff; }
</style>
