<template>
  <el-dialog
    v-model="visible"
    title="选择执行环境"
    width="420px"
    destroy-on-close
    @open="loadEnvs"
  >
    <el-form label-width="80px">
      <el-form-item label="环境" required>
        <el-select v-model="envId" placeholder="选择环境" style="width: 100%">
          <el-option
            v-for="env in envs"
            :key="env.id"
            :label="`${env.name} (${env.base_url})`"
            :value="env.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="模式">
        <el-radio-group v-model="mode">
          <el-radio value="functional">功能测试</el-radio>
          <el-radio value="performance">性能测试</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="并发数">
        <el-input-number v-model="concurrency" :min="1" :max="50" />
      </el-form-item>
      <template v-if="mode === 'performance'">
        <el-form-item label="时长(秒)">
          <el-input-number v-model="durationSec" :min="10" :max="600" />
        </el-form-item>
        <el-form-item label="目标 RPS">
          <el-input-number v-model="targetRps" :min="1" :max="500" />
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="confirm">开始执行</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed } from 'vue';
import { listEnvs } from '../services/envConfigService.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'confirm']);

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
});

const envs = ref([]);
const envId = ref(null);
const mode = ref('functional');
const concurrency = ref(1);
const durationSec = ref(30);
const targetRps = ref(10);
const submitting = ref(false);

async function loadEnvs() {
  envs.value = await listEnvs();
  if (envs.value.length && !envId.value) {
    envId.value = envs.value[0].id;
  }
}

function confirm() {
  if (!envId.value) return;
  emit('confirm', {
    env_id: envId.value,
    mode: mode.value,
    concurrency: concurrency.value,
    perf_options: mode.value === 'performance'
      ? { duration_sec: durationSec.value, target_rps: targetRps.value }
      : undefined,
  });
  visible.value = false;
}
</script>
