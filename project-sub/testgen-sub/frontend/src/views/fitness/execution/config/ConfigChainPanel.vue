<template>
  <el-form label-width="120px">
    <el-form-item label="关联用例">
      <el-input :model-value="item.item_id" disabled />
    </el-form-item>
    <el-form-item label="判定">
      <el-input :model-value="item.validation_primary_id" disabled />
    </el-form-item>
    <el-divider content-position="left">链路步骤 (config_json.steps)</el-divider>
    <el-button type="primary" size="small" @click="addStep">添加步骤</el-button>
    <el-table :data="steps" size="small" border style="margin-top:12px">
      <el-table-column label="#" width="40" type="index" />
      <el-table-column label="Runner" width="90">
        <template #default="{ row }">
          <el-select v-model="row.runner" size="small" @change="sync">
            <el-option label="HTTP" value="http" />
            <el-option label="CLI" value="cli" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="Path / Command" min-width="140">
        <template #default="{ row }">
          <el-input
            v-if="row.runner === 'cli'"
            v-model="row.command"
            size="small"
            @input="sync"
          />
          <el-input v-else v-model="row.path" size="small" placeholder="/health" @input="sync" />
        </template>
      </el-table-column>
      <el-table-column label="Method" width="80">
        <template #default="{ row }">
          <el-select v-if="row.runner !== 'cli'" v-model="row.method" size="small" @change="sync">
            <el-option label="GET" value="GET" />
            <el-option label="POST" value="POST" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="Expect" width="80">
        <template #default="{ row }">
          <el-input-number
            v-if="row.runner !== 'cli'"
            v-model="row.expect_status"
            size="small"
            :min="100"
            :max="599"
            @change="sync"
          />
        </template>
      </el-table-column>
      <el-table-column label="extract" width="100">
        <template #default="{ row }">
          <el-input
            v-model="row.extractKey"
            size="small"
            placeholder="var:path"
            @input="syncExtract(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="60">
        <template #default="{ $index }">
          <el-button link type="danger" @click="removeStep($index)">删</el-button>
        </template>
      </el-table-column>
    </el-table>
    <p class="hint">支持变量插值（双花括号 var 名）；extract 格式 runtime:runtime 写入变量池。</p>
  </el-form>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue' ]);

const steps = ref([]);

function defaultStep() {
  return {
    runner: 'http',
    path: '/health',
    method: 'GET',
    expect_status: 200,
    command: '',
    extractKey: '',
    extract: {},
  };
}

function syncExtract(row) {
  row.extract = {};
  if (row.extractKey) {
    const [ k, v ] = row.extractKey.split(':');
    if (k && v) row.extract[k.trim()] = v.trim();
  }
  sync();
}

function sync() {
  emit('update:modelValue', {
    steps: steps.value.map(({ extractKey, ...rest }) => ({
      ...rest,
      extract: rest.extract && Object.keys(rest.extract).length ? rest.extract : undefined,
    })),
  });
}

function addStep() {
  steps.value.push(defaultStep());
  sync();
}

function removeStep(i) {
  steps.value.splice(i, 1);
  sync();
}

function initFromProps() {
  const raw = props.modelValue?.steps;
  if (Array.isArray(raw) && raw.length) {
    steps.value = raw.map(s => {
      const row = { ...defaultStep(), ...s };
      const ek = s.extract ? Object.entries(s.extract).map(([ k, v ]) => `${k}:${v}`).join(',') : '';
      row.extractKey = ek;
      return row;
    });
  } else if (!steps.value.length) {
    steps.value = [ defaultStep() ];
  }
}

watch(() => props.modelValue, initFromProps, { deep: true });
onMounted(initFromProps);
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; margin-top: 12px; }
</style>
