<template>
  <div class="random-seed-field">
    <span class="random-seed-field__label">随机</span>
    <el-switch v-model="auto" />
    <el-input
      :model-value="text"
      class="random-seed-field__input"
      maxlength="16"
      placeholder="种子"
      @update:model-value="onInput"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';

const props = defineProps({
  modelValue: { type: [ Number, String ], default: null },
});

const emit = defineEmits([ 'update:modelValue' ]);

const auto = ref(true);

const text = computed(() => (props.modelValue == null || props.modelValue === '' ? '' : String(props.modelValue)));

function rollSeed() {
  const digits = 8 + Math.floor(Math.random() * 3);
  const min = 10 ** (digits - 1);
  const span = (10 ** digits) - min;
  return min + Math.floor(Math.random() * span);
}

function parseSeed(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '').slice(0, 16);
  if (!digits) return null;
  const number = Number(digits);
  if (!Number.isSafeInteger(number)) return null;
  return number;
}

function onInput(value) {
  emit('update:modelValue', parseSeed(value));
}

function takeSeed() {
  if (auto.value) {
    const next = rollSeed();
    emit('update:modelValue', next);
    return next;
  }
  return parseSeed(props.modelValue);
}

onMounted(() => {
  if (parseSeed(props.modelValue) == null) emit('update:modelValue', rollSeed());
});

defineExpose({ takeSeed });
</script>

<style scoped>
.random-seed-field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.random-seed-field__label {
  font-size: 13px;
  color: var(--novel-color-text, #2f3d34);
}

.random-seed-field__input {
  width: 168px;
}
</style>
