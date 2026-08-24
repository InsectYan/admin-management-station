<template>
  <el-divider content-position="left">判定方式</el-divider>
  <el-form-item label="判定方式（VS）">
    <el-select
      v-model="primaryId"
      style="width:100%"
      :disabled="readonly"
      @change="emitChange"
    >
      <el-option
        v-for="v in options"
        :key="v.validation_id"
        :label="`${formatValidationLabel(v.validation_id, v.name)}${v.is_primary ? ' (方案默认)' : ''}`"
        :value="v.validation_id"
      />
    </el-select>
    <p v-if="defaultValidationId && defaultValidationId !== primaryId" class="hint-inline">
      模板/分类推荐：<code>{{ formatValidationLabel(defaultValidationId) }}</code>
      <el-button link type="primary" size="small" @click="applyDefault">应用推荐</el-button>
    </p>
  </el-form-item>
  <el-form-item v-if="!hideSecondary" label="辅判定方式">
    <el-select
      v-model="secondaryId"
      clearable
      style="width:100%"
      :disabled="readonly"
      @change="emitChange"
    >
      <el-option
        v-for="v in options"
        :key="'s-' + v.validation_id"
        :label="formatValidationLabel(v.validation_id, v.name)"
        :value="v.validation_id"
      />
    </el-select>
  </el-form-item>
</template>

<script setup>
import { ref, watch } from 'vue';
import { formatValidationLabel } from '@/utils/testCategoryDisplay.js';

const props = defineProps({
  item: { type: Object, required: true },
  schemeId: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  defaultValidationId: { type: String, default: '' },
  readonly: { type: Boolean, default: false },
  hideSecondary: { type: Boolean, default: false },
});

const emit = defineEmits([ 'update:validations' ]);

const primaryId = ref('');
const secondaryId = ref('');

function emitChange() {
  emit('update:validations', {
    validation_primary_id: primaryId.value || null,
    validation_secondary_id: secondaryId.value || null,
  });
}

function applyDefault() {
  if (props.defaultValidationId) {
    primaryId.value = props.defaultValidationId;
    emitChange();
  }
}

function syncFromItem() {
  primaryId.value = props.item?.validation_primary_id || props.defaultValidationId || '';
  secondaryId.value = props.item?.validation_secondary_id || '';
  emitChange();
}

watch(
  () => [ props.item?.validation_primary_id, props.item?.validation_secondary_id, props.defaultValidationId ],
  syncFromItem,
  { immediate: true },
);
</script>

<style scoped>
.hint-inline { color: #909399; font-size: 12px; margin-top: 4px; }
</style>
