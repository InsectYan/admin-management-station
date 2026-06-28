<template>
  <el-form label-width="120px">
    <el-form-item label="HTTP Method">
      <el-input :model-value="item.http_method" disabled />
    </el-form-item>
    <el-form-item label="Path">
      <el-input v-model="local.endpoint_path" @input="sync" />
    </el-form-item>
    <el-form-item label="期望 Status">
      <el-input-number v-model="local.http_status_expected" @change="sync" />
    </el-form-item>
    <el-form-item label="Body 示例">
      <el-input v-model="local.test_input_example" type="textarea" :rows="4" @input="sync" />
    </el-form-item>
    <el-form-item label="断言点">
      <el-tag v-for="(a,i) in item.assertion_points||[]" :key="i" style="margin:2px">{{ a }}</el-tag>
    </el-form-item>
    <el-form-item label="CLI 命令">
      <el-input :model-value="item.automation_command" disabled />
    </el-form-item>
  </el-form>
</template>

<script setup>
import { reactive, watch } from 'vue';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue' ]);

const local = reactive({ ...props.modelValue });

function sync() {
  emit('update:modelValue', { ...local });
}

watch(() => props.modelValue, (v) => Object.assign(local, v || {}), { deep: true });
</script>
