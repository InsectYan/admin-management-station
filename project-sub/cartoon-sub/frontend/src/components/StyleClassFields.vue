<template>
  <el-form-item v-for="item in classes" :key="item.key" :label="item.name">
    <el-select
      :model-value="modelValue?.[item.key] || ''"
      clearable
      filterable
      placeholder="不使用"
      style="width: 100%"
      @update:model-value="set(item.key, $event)"
    >
      <el-option v-for="option in item.options" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>
    <p class="cartoon-module__hint">叠在画面风格上。不选就只用画面风格。</p>
  </el-form-item>
</template>

<script setup>
const props = defineProps({
  classes: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue' ]);

function set(key, value) {
  const next = { ...(props.modelValue || {}) };
  if (value) next[key] = value;
  else delete next[key];
  emit('update:modelValue', next);
}
</script>
