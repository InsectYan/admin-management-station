<template>
  <el-form label-width="140px">
    <el-form-item label="Rubric ID">
      <el-input v-model="local.rubric_id" placeholder="consult_quality_v1" @input="sync" />
    </el-form-item>
    <el-form-item label="评审人数">
      <el-input-number v-model="local.reviewer_count" :min="1" :max="10" @change="sync" />
    </el-form-item>
    <el-form-item label="待审 Run ID">
      <el-input v-model="scoreForm.run_id" placeholder="留空则选首个待审" />
    </el-form-item>
    <el-form-item>
      <el-button type="primary" :loading="launching" @click="launchReview">发起人工评审</el-button>
      <el-button :loading="loadingPending" @click="loadPending">刷新待审队列</el-button>
    </el-form-item>

    <el-divider content-position="left">待审打分</el-divider>
    <el-empty v-if="!pendingRuns.length" description="暂无待审运行" />
    <div v-for="pr in pendingRuns" :key="pr.id" class="pending-row">
      <span>Run #{{ pr.id }} · {{ pr.item_id }}</span>
      <el-radio-group v-model="scoreByRun[pr.id].verdict" size="small">
        <el-radio-button label="pass">通过</el-radio-button>
        <el-radio-button label="fail">不通过</el-radio-button>
      </el-radio-group>
      <el-input v-model="scoreByRun[pr.id].comment" placeholder="评语" size="small" style="max-width:240px" />
      <el-button size="small" type="primary" :loading="scoreByRun[pr.id].loading" @click="submitScore(pr.id)">
        提交
      </el-button>
    </div>
    <p class="hint">TS-10-MAN 人工评审；VS-11 多数决判定。</p>
  </el-form>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchEnvironments, fetchFtRuns, launchRun, scoreManualRun } from '@/services/fitnessService.js';

const props = defineProps({
  item: { type: Object, required: true },
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits([ 'update:modelValue' ]);

const router = useRouter();
const launching = ref(false);
const loadingPending = ref(false);
const pendingRuns = ref([]);
const scoreByRun = reactive({});
const scoreForm = reactive({ run_id: '' });

const local = reactive({
  rubric_id: props.modelValue?.rubric_id ?? 'consult_quality_v1',
  reviewer_count: props.modelValue?.reviewer_count ?? 2,
});

function sync() {
  emit('update:modelValue', { ...local });
}

watch(() => props.modelValue, (v) => Object.assign(local, {
  rubric_id: v?.rubric_id ?? 'consult_quality_v1',
  reviewer_count: v?.reviewer_count ?? 2,
}), { deep: true });

function ensureScoreRow(runId) {
  if (!scoreByRun[runId]) {
    scoreByRun[runId] = { verdict: 'pass', comment: '', loading: false };
  }
}

async function loadPending() {
  loadingPending.value = true;
  try {
    const data = await fetchFtRuns({
      item_id: props.item?.item_id,
      scheme_id: 'TS-10-MAN',
      pageSize: 20,
    });
    pendingRuns.value = (data.list || []).filter(r =>
      r.status === 'running' || r.verdict === 'pending' || !r.verdict,
    );
    for (const r of pendingRuns.value) ensureScoreRow(r.id);
    if (!scoreForm.run_id && pendingRuns.value[0]) {
      scoreForm.run_id = String(pendingRuns.value[0].id);
    }
  } finally {
    loadingPending.value = false;
  }
}

async function launchReview() {
  launching.value = true;
  try {
    const envs = await fetchEnvironments({ pageSize: 50 });
    const env = envs.list?.find(e => e.is_default) || envs.list?.[0];
    const run = await launchRun(props.item.item_id, {
      env_id: env?.id,
      scheme_id: 'TS-10-MAN',
      validation_id: props.item.validation_primary_id || 'VS-11-MAJORITY',
    });
    ElMessage.success(`评审已发起 Run #${run.id}`);
    router.push(`/fitness/execution/runs/${run.id}`);
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '发起失败');
  } finally {
    launching.value = false;
  }
}

async function submitScore(runId) {
  ensureScoreRow(runId);
  scoreByRun[runId].loading = true;
  try {
    await scoreManualRun(runId, {
      verdict: scoreByRun[runId].verdict,
      comment: scoreByRun[runId].comment,
    });
    ElMessage.success('打分已提交');
    await loadPending();
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e.message || '提交失败');
  } finally {
    scoreByRun[runId].loading = false;
  }
}

onMounted(loadPending);
</script>

<style scoped>
.hint { color: #909399; font-size: 13px; }
.pending-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
</style>
