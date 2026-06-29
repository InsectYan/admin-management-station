<template>
  <el-form label-width="120px">
    <el-form-item label="关联用例">
      <el-input :model-value="item.item_id" disabled />
    </el-form-item>
    <el-form-item label="判定">
      <el-input :model-value="item.validation_primary_id" disabled />
    </el-form-item>
    <el-divider content-position="left">边界矩阵 (config_json.matrix)</el-divider>
    <el-button type="primary" size="small" @click="addRow">添加行</el-button>
    <el-table :data="matrix" size="small" border style="margin-top:12px">
      <el-table-column label="Runner" width="100">
        <template #default="{ row }">
          <el-select v-model="row.runner" size="small" @change="sync">
            <el-option label="HTTP" value="http" />
            <el-option label="CLI" value="cli" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="Path / Command" min-width="180">
        <template #default="{ row }">
          <el-input
            v-if="row.runner === 'cli'"
            v-model="row.command"
            size="small"
            placeholder="npm run test:stations -- s05"
            @input="sync"
          />
          <el-input v-else v-model="row.path" size="small" placeholder="/health" @input="sync" />
        </template>
      </el-table-column>
      <el-table-column label="Method" width="90">
        <template #default="{ row }">
          <el-select v-if="row.runner !== 'cli'" v-model="row.method" size="small" @change="sync">
            <el-option label="GET" value="GET" />
            <el-option label="POST" value="POST" />
          </el-select>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="Expect" width="100">
        <template #default="{ row }">
          <el-input-number
            v-if="row.runner !== 'cli'"
            v-model="row.expect_status"
            size="small"
            :min="100"
            :max="599"
            @change="sync"
          />
          <span v-else>exit 0</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="70">
        <template #default="{ $index }">
          <el-button link type="danger" @click="removeRow($index)">删</el-button>
        </template>
      </el-table-column>
    </el-table>
    <p class="hint">TS-02-BND 逐行执行矩阵；VS-02/VS-01 要求全部子项 pass。</p>
  </el-form>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue' ]);

const matrix = ref([]);

function defaultRow() {
  return {
    runner: 'http',
    path: '/health',
    method: 'GET',
    expect_status: 200,
    command: '',
  };
}

function sync() {
  emit('update:modelValue', { matrix: matrix.value.map(r => ({ ...r })) });
}

function addRow() {
  matrix.value.push(defaultRow());
  sync();
}

function removeRow(index) {
  matrix.value.splice(index, 1);
  sync();
}

function initFromProps() {
  const rows = props.modelValue?.matrix;
  if (Array.isArray(rows) && rows.length) {
    matrix.value = rows.map(r => ({ ...defaultRow(), ...r }));
  } else if (!matrix.value.length) {
    matrix.value = [ defaultRow() ];
  }
}

watch(() => props.modelValue, initFromProps, { deep: true });
onMounted(initFromProps);
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; margin-top: 12px; }
</style>
