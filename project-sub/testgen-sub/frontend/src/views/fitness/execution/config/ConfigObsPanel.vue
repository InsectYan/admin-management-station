<template>
  <el-form label-width="120px">
    <el-form-item label="关联用例">
      <el-input :model-value="item.item_id" disabled />
    </el-form-item>
    <el-form-item label="判定">
      <el-input :model-value="item.validation_primary_id" disabled />
    </el-form-item>
    <el-divider content-position="left">可观测检查 (checks[])</el-divider>
    <el-button type="primary" size="small" @click="addCheck">添加检查</el-button>
    <el-table :data="checks" size="small" border style="margin-top:12px">
      <el-table-column label="模式" width="120">
        <template #default="{ row }">
          <el-select v-model="row.mode" size="small" @change="sync">
            <el-option label="HTTP 字段" value="http_fields" />
            <el-option label="Journey 列表" value="journey_list" />
            <el-option label="Journey 单条" value="journey_get" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="参数" min-width="200">
        <template #default="{ row }">
          <template v-if="row.mode === 'http_fields'">
            <el-input v-model="row.path" size="small" placeholder="/health" style="width:120px" @input="sync" />
            <el-input
              v-model="row.fieldsText"
              size="small"
              placeholder="status,runtime"
              style="width:160px;margin-left:4px"
              @input="syncFields(row)"
            />
          </template>
          <template v-else-if="row.mode === 'journey_list'">
            limit <el-input-number v-model="row.limit" size="small" :min="1" @change="sync" />
          </template>
          <template v-else>
            <el-input v-model="row.session_id" size="small" placeholder="session_id" @input="sync" />
            <el-input
              v-model="row.client_turn_id"
              size="small"
              placeholder="client_turn_id"
              style="margin-top:4px"
              @input="sync"
            />
          </template>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="60">
        <template #default="{ $index }">
          <el-button link type="danger" @click="removeCheck($index)">删</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-form-item v-if="showComplete" label="完整性" style="margin-top:12px">
      <el-checkbox v-model="thresholdLocal.require_complete" @change="syncThreshold">
        VS-06 要求 journey.stations 非空
      </el-checkbox>
    </el-form-item>
    <p class="hint">JourneyCollector 调用 fitness BFF /api/journeys；HTTP 字段检查用于 /health 等探针。</p>
  </el-form>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
  threshold: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue', 'update:threshold' ]);

const checks = ref([]);
const thresholdLocal = reactive({ require_complete: false });

const showComplete = computed(() =>
  props.item?.validation_primary_id === 'VS-06-COMPLETE',
);

function defaultCheck() {
  return {
    mode: 'http_fields',
    path: '/health',
    method: 'GET',
    expect_status: 200,
    fieldsText: 'status,runtime,database,migrations',
    required_fields: [ 'status', 'runtime', 'database', 'migrations' ],
    limit: 5,
    session_id: '',
    client_turn_id: '',
  };
}

function syncFields(row) {
  row.required_fields = (row.fieldsText || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  sync();
}

function sync() {
  emit('update:modelValue', {
    checks: checks.value.map(({ fieldsText, ...rest }) => rest),
  });
}

function syncThreshold() {
  emit('update:threshold', { ...thresholdLocal });
}

function addCheck() {
  checks.value.push(defaultCheck());
  sync();
}

function removeCheck(i) {
  checks.value.splice(i, 1);
  sync();
}

function initFromProps() {
  const raw = props.modelValue?.checks;
  if (Array.isArray(raw) && raw.length) {
    checks.value = raw.map(c => ({
      ...defaultCheck(),
      ...c,
      fieldsText: (c.required_fields || []).join(','),
    }));
  } else if (!checks.value.length) {
    checks.value = [ defaultCheck() ];
  }
  thresholdLocal.require_complete = props.threshold?.require_complete ?? false;
}

watch(() => props.modelValue, initFromProps, { deep: true });
watch(() => props.threshold, v => {
  thresholdLocal.require_complete = v?.require_complete ?? false;
}, { deep: true });

onMounted(() => {
  initFromProps();
  sync();
  syncThreshold();
});
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; margin-top: 12px; }
</style>
