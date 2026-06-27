<template>
  <div class="testgen-assert-editor">
    <el-button type="primary" link size="small" @click="addRule">+ 添加断言</el-button>
    <el-table :data="rules" size="small" border style="margin-top: 8px">
      <el-table-column label="类型" width="120">
        <template #default="{ row }">
          <el-select v-model="row.type" size="small">
            <el-option label="状态码" value="status" />
            <el-option label="JSONPath" value="json_path" />
            <el-option label="响应时间" value="latency_ms" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="配置">
        <template #default="{ row }">
          <template v-if="row.type === 'status'">
            <el-input-number v-model="row.expect" :min="100" :max="599" size="small" />
          </template>
          <template v-else-if="row.type === 'json_path'">
            <el-input v-model="row.path" placeholder="$.code" size="small" style="width: 40%" />
            <el-input v-model="row.expect" placeholder="期望值" size="small" style="width: 40%; margin-left: 8px" />
          </template>
          <template v-else>
            <span>最大 </span>
            <el-input-number v-model="row.max" :min="1" size="small" />
            <span> ms</span>
          </template>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80">
        <template #default="{ $index }">
          <el-button link type="danger" size="small" @click="removeRule($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue']);

const rules = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

function addRule() {
  emit('update:modelValue', [
    ...rules.value,
    { type: 'status', expect: 200 },
  ]);
}

function removeRule(index) {
  const next = [...rules.value];
  next.splice(index, 1);
  emit('update:modelValue', next);
}
</script>
