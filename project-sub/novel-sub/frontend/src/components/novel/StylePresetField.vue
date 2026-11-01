<template>
  <el-form-item label="风格">
    <el-select
      :model-value="form.style_preset || ''"
      clearable
      filterable
      placeholder="选择叙事语气"
      style="width: 100%"
      @update:model-value="onPick"
    >
      <el-option
        v-for="item in presets"
        :key="item.id"
        :label="item.name"
        :value="item.id"
      />
    </el-select>
    <p v-if="note" class="novel-style-note">{{ note }}</p>
  </el-form-item>
</template>

<script setup>
import { computed } from 'vue';
import { useStylePresets } from '../../composables/useStylePresets.js';

const props = defineProps({
  form: { type: Object, required: true },
});

const emit = defineEmits(['change']);
const { presets } = useStylePresets();

const note = computed(() => (
  presets.value.find((item) => item.id === props.form.style_preset)?.note || ''
));

function onPick(value) {
  props.form.style_preset = value || '';
  emit('change');
}
</script>

<style scoped>
.novel-style-note {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--novel-color-text-secondary, #5c6b62);
}
</style>
