<template>
  <span class="table-json-import">
    <el-button size="small" :disabled="disabled" @click="triggerImport">
      {{ label }}
    </el-button>
    <input
      ref="inputRef"
      type="file"
      accept=".json,application/json"
      style="display:none"
      @change="onFileChange"
    />
  </span>
</template>

<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { parseTemplateConfigRoot } from '@/utils/templateTableImport.js';

const props = defineProps({
  arrayKey: { type: String, required: true },
  label: { type: String, default: '导入 JSON' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits([ 'import' ]);

const inputRef = ref(null);

function triggerImport() {
  inputRef.value?.click();
}

async function onFileChange(ev) {
  const file = ev.target.files?.[0];
  ev.target.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const { rows, vars } = parseTemplateConfigRoot(text, props.arrayKey);
    if (!rows.length) {
      ElMessage.warning('JSON 中未包含有效行');
      return;
    }
    emit('import', rows, { vars });
    ElMessage.success(`已导入 ${rows.length} 行`);
  } catch (e) {
    ElMessage.error(e.message || '导入失败');
  }
}
</script>

<style scoped>
.table-json-import {
  display: inline-block;
  margin-left: 8px;
}
</style>
