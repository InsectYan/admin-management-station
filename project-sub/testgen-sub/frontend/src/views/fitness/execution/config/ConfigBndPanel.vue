<template>
  <el-form label-width="120px">
    <el-form-item label="说明"><span>边界/等价类矩阵编辑器（引擎未开发，可粘贴 JSON/CSV）</span></el-form-item>
    <el-form-item label="矩阵行">
      <el-input v-model="matrixText" type="textarea" :rows="8" placeholder="每行一组输入+期望" @input="sync" />
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({ item: Object, modelValue: Object });
const emit = defineEmits([ 'update:modelValue' ]);
const matrixText = ref(JSON.stringify(props.item?.test_steps || [], null, 2));

function sync() {
  emit('update:modelValue', { matrixText: matrixText.value });
}
watch(() => props.modelValue, () => {});
</script>
