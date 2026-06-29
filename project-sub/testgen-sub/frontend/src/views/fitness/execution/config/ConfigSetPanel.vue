<template>
  <el-form label-width="120px">
    <el-form-item label="关联用例">
      <el-input :model-value="item.item_id" disabled />
    </el-form-item>
    <el-form-item label="样本集" required>
      <el-select
        v-model="local.sample_set_id"
        placeholder="选择样本集"
        filterable
        style="width: 100%"
        @change="sync"
      >
        <el-option
          v-for="s in sampleSets"
          :key="s.id"
          :label="`${s.name} (${s.sample_count}条)`"
          :value="s.id"
        />
      </el-select>
      <el-button link type="primary" style="margin-left:8px" @click="router.push('/fitness/execution/samples')">
        管理样本集
      </el-button>
    </el-form-item>
    <el-form-item v-if="selectedSet" label="样本预览">
      <el-tag v-for="(row, i) in previewItems" :key="i" style="margin:2px">
        {{ formatSample(row) }}
      </el-tag>
      <span v-if="!previewItems.length" class="hint">暂无样本条目</span>
    </el-form-item>
    <el-divider content-position="left">达标率阈值 (VS-07)</el-divider>
    <el-form-item label="判定方案">
      <el-input :model-value="item.validation_primary_id" disabled />
    </el-form-item>
    <el-form-item v-if="showRate('L')" label="rate_L (%)">
      <el-input-number v-model="thresholdLocal.rate_L" :min="0" :max="100" :precision="1" @change="syncThreshold" />
    </el-form-item>
    <el-form-item v-if="showRate('M')" label="rate_M (%)">
      <el-input-number v-model="thresholdLocal.rate_M" :min="0" :max="100" :precision="1" @change="syncThreshold" />
    </el-form-item>
    <el-form-item v-if="showRate('H')" label="rate_H (%)">
      <el-input-number v-model="thresholdLocal.rate_H" :min="0" :max="100" :precision="1" @change="syncThreshold" />
    </el-form-item>
    <p class="hint">TS-04-SET 遍历样本集 HTTP 请求；VS-07 按子项 pass 比例与阈值比较。</p>
  </el-form>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { fetchSampleSet, fetchSampleSets } from '@/services/fitnessService.js';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
  threshold: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue', 'update:threshold' ]);

const router = useRouter();
const sampleSets = ref([]);
const previewItems = ref([]);
const local = reactive({ sample_set_id: props.modelValue?.sample_set_id ?? null });
const thresholdLocal = reactive({
  rate_L: props.threshold?.rate_L ?? null,
  rate_M: props.threshold?.rate_M ?? 100,
  rate_H: props.threshold?.rate_H ?? null,
});

const selectedSet = computed(() =>
  sampleSets.value.find(s => s.id === local.sample_set_id),
);

const activeRateLevel = computed(() => {
  const vid = props.item?.validation_primary_id || '';
  const m = String(vid).match(/VS-07-RATE-([LMH])/i);
  return m ? m[1].toUpperCase() : 'M';
});

function showRate(level) {
  return activeRateLevel.value === level;
}

function formatSample(row) {
  const d = row.input_data || {};
  return `${d.method || 'GET'} ${d.path || '?'} → ${d.expect_status ?? 200}`;
}

function sync() {
  emit('update:modelValue', { sample_set_id: local.sample_set_id });
}

function syncThreshold() {
  emit('update:threshold', { ...thresholdLocal });
}

async function loadPreview(setId) {
  if (!setId) {
    previewItems.value = [];
    return;
  }
  const data = await fetchSampleSet(setId);
  previewItems.value = (data.items || []).slice(0, 8);
}

async function loadSets() {
  const data = await fetchSampleSets({ pageSize: 100, item_id: props.item?.item_id });
  let list = data.list || [];
  if (!list.length) {
    const all = await fetchSampleSets({ pageSize: 100 });
    list = all.list || [];
  }
  sampleSets.value = list;
}

watch(() => local.sample_set_id, loadPreview);

watch(() => props.modelValue, (v) => {
  local.sample_set_id = v?.sample_set_id ?? null;
}, { deep: true });

watch(() => props.threshold, (v) => Object.assign(thresholdLocal, v || {}), { deep: true });

onMounted(async () => {
  await loadSets();
  if (local.sample_set_id) await loadPreview(local.sample_set_id);
  sync();
  syncThreshold();
});
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; }
</style>
