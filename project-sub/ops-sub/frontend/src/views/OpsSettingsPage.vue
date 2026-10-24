<template>
  <PageShell title="系统配置">
    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <el-form v-else label-width="160px" class="ops-settings-form" @submit.prevent="save">
      <el-form-item label="队列堆积阈值">
        <el-input-number v-model="form.queue_backlog" :min="1" :max="10000" />
      </el-form-item>
      <el-form-item label="卡住判定（分钟）">
        <el-input-number v-model="form.stuck_minutes" :min="1" :max="1440" />
      </el-form-item>
      <el-form-item label="失败率阈值">
        <el-input-number v-model="failPercent" :min="1" :max="100" />
        <span class="ops-settings-hint">近一小时失败占比，按百分比填写</span>
      </el-form-item>
      <el-form-item label="失败率最少样本">
        <el-input-number v-model="form.fail_min_samples" :min="1" :max="100" />
      </el-form-item>
      <el-form-item label="依赖探测间隔（秒）">
        <el-input-number v-model="form.probe_interval_sec" :min="15" :max="3600" />
      </el-form-item>
      <el-form-item label="允许查看提示词">
        <el-switch v-model="form.allow_prompt_view" />
      </el-form-item>
      <el-form-item label="存储水位（MB）">
        <el-input-number v-model="form.storage_watermark_mb" :min="1" :max="1000000" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </el-form-item>
    </el-form>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { fetchContentSettings, updateContentSettings } from '../services/contentOpsService.js';

const loadError = ref('');
const saving = ref(false);
const failPercent = ref(50);
const form = reactive({
  queue_backlog: 20,
  stuck_minutes: 30,
  fail_min_samples: 3,
  probe_interval_sec: 15,
  allow_prompt_view: false,
  storage_watermark_mb: 10240,
});

async function load() {
  try {
    const data = await fetchContentSettings();
    form.queue_backlog = data.queue_backlog;
    form.stuck_minutes = data.stuck_minutes;
    form.fail_min_samples = data.fail_min_samples;
    form.probe_interval_sec = data.probe_interval_sec;
    form.allow_prompt_view = Boolean(data.allow_prompt_view);
    form.storage_watermark_mb = data.storage_watermark_mb;
    failPercent.value = Math.round(Number(data.fail_rate) * 100);
  } catch (err) {
    loadError.value = err.message;
  }
}

async function save() {
  saving.value = true;
  try {
    await updateContentSettings({
      queue_backlog: form.queue_backlog,
      stuck_minutes: form.stuck_minutes,
      fail_min_samples: form.fail_min_samples,
      fail_rate: failPercent.value / 100,
      probe_interval_sec: form.probe_interval_sec,
      allow_prompt_view: form.allow_prompt_view,
      storage_watermark_mb: form.storage_watermark_mb,
    });
    ElMessage.success('已保存');
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ops-settings-form {
  max-width: 640px;
}
.ops-settings-hint {
  margin-left: 12px;
  color: #8a968e;
  font-size: 13px;
}
</style>
