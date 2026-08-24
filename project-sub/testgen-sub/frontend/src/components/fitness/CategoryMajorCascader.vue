<template>
  <el-cascader
    :model-value="cascaderModel"
    :options="options"
    :props="cascaderProps"
    :placeholder="placeholder"
    :clearable="clearable"
    :filterable="filterable"
    :collapse-tags="multiple"
    :collapse-tags-tooltip="multiple"
    :style="styleAttr"
    :disabled="disabled"
    @update:model-value="onUpdate"
    @change="onChange"
  />
</template>

<script setup>
import { computed } from 'vue';
import { buildCategoryCascaderOptions } from '@/utils/testCategoryDisplay.js';

const props = defineProps({
  modelValue: { type: [ String, Array ], default: '' },
  majors: { type: Array, default: () => [] },
  multiple: { type: Boolean, default: false },
  placeholder: { type: String, default: '测试分类' },
  clearable: { type: Boolean, default: true },
  filterable: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
  width: { type: [ String, Number ], default: '220px' },
});

const emit = defineEmits([ 'update:modelValue', 'change' ]);

const options = computed(() => buildCategoryCascaderOptions(props.majors));

const cascaderProps = computed(() => ({
  multiple: props.multiple,
  emitPath: false,
  checkStrictly: false,
  value: 'value',
  label: 'label',
  children: 'children',
}));

const styleAttr = computed(() => {
  const w = typeof props.width === 'number' ? `${props.width}px` : props.width;
  return { width: w };
});

/** el-cascader 空值用 null/[]，避免空字符串告警 */
const cascaderModel = computed(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue : [];
  }
  return props.modelValue || null;
});

function normalize(v) {
  if (props.multiple) {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (v == null || v === '') return [];
    return [ v ];
  }
  if (Array.isArray(v)) return v[0] || '';
  return v == null ? '' : v;
}

function onUpdate(v) {
  emit('update:modelValue', normalize(v));
}

function onChange(v) {
  emit('change', normalize(v));
}
</script>
