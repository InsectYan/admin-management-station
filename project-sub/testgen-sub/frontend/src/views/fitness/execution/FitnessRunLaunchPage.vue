<template>
  <div v-loading="loading">
    <el-form label-width="100px">
      <el-form-item label="执行环境">
        <el-select v-model="envId" placeholder="选择环境" style="width: 320px">
          <el-option
            v-for="e in envs"
            :key="e.id"
            :label="e.name + (e.is_default ? ' (默认)' : '')"
            :value="e.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <el-checkbox-group v-model="checkedPre">
      <el-checkbox v-for="(p,i) in item?.preconditions||[]" :key="i" :label="p">{{ p }}</el-checkbox>
    </el-checkbox-group>
    <el-divider />
    <p>TS: {{ schemeId }} · VS: {{ validationId }}</p>
    <p v-if="isSetScheme">样本集 ID: {{ runConfig?.sample_set_id || '未绑定' }}</p>
    <p v-if="isBndScheme">矩阵行数: {{ matrixCount }}</p>
    <p v-if="isRepScheme">重复次数: {{ repeatCount }}</p>
    <p v-if="isChainScheme">链路步骤: {{ chainStepCount }}</p>
    <p v-if="isPairScheme">对照臂: {{ pairArmCount }}</p>
    <p v-if="isNegScheme">对抗用例: {{ negCaseCount }}</p>
    <p v-if="isObsScheme">可观测检查: {{ obsCheckCount }}</p>
    <div class="launch-actions">
      <el-button
        type="primary"
        data-testid="fitness-launch-run"
        :loading="launching"
        :disabled="!canLaunch"
        @click="launch"
      >
        一键执行
      </el-button>
      <el-button
        data-testid="fitness-dry-run"
        :loading="dryRunning"
        :disabled="!canDryRun"
        @click="runDryRun"
      >
        Dry-run 预检
      </el-button>
    </div>
    <template v-if="dryRunResult">
      <el-alert
        :type="dryRunResult.verdict === 'pass' ? 'success' : 'warning'"
        :title="`预检判定: ${dryRunResult.verdict || '-'}`"
        :closable="false"
        style="margin-top:16px"
      />
      <el-table :data="dryRunSubRows" size="small" style="margin-top:12px" border>
        <el-table-column prop="sub_index" label="#" width="50" />
        <el-table-column prop="input_summary" label="输入" min-width="160" />
        <el-table-column prop="output_summary" label="输出" min-width="160" />
        <el-table-column prop="sub_verdict" label="判定" width="80">
          <template #default="{ row }">
            <el-tag :type="row.sub_verdict === 'pass' ? 'success' : 'danger'" size="small">
              {{ row.sub_verdict }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </template>
    <el-alert v-if="engineMsg" type="warning" :title="engineMsg" style="margin-top:16px" />
    <el-alert
      v-if="item && !LAUNCHABLE_SCHEMES.has(schemeId)"
      type="error"
      title="当前方案尚未实现执行引擎（已实现 TS-01～08）"
      :closable="false"
      style="margin-top:16px"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  LAUNCHABLE_SCHEMES,
  dryRunLaunch,
  fetchEnvironments,
  fetchRunConfig,
  fetchTestItem,
  launchRun,
} from '@/services/fitnessService.js';
import { buildRunConsoleRoute } from '@/utils/itemListQuery.js';

const route = useRoute();
const router = useRouter();
const itemId = computed(() => route.params.itemId);
const loading = ref(false);
const launching = ref(false);
const dryRunning = ref(false);
const dryRunResult = ref(null);
const item = ref(null);
const runConfig = ref(null);
const envs = ref([]);
const envId = ref(null);
const checkedPre = ref([]);
const engineMsg = ref('');

const schemeId = computed(() => item.value?.scheme_primary_id || '');
const validationId = computed(() => item.value?.validation_primary_id || '');
const isSetScheme = computed(() => schemeId.value === 'TS-04-SET');
const isBndScheme = computed(() => schemeId.value === 'TS-02-BND');
const isRepScheme = computed(() => schemeId.value === 'TS-03-REP');
const isChainScheme = computed(() => schemeId.value === 'TS-05-CHAIN');
const isPairScheme = computed(() => schemeId.value === 'TS-06-PAIR');
const isNegScheme = computed(() => schemeId.value === 'TS-07-NEG');
const isObsScheme = computed(() => schemeId.value === 'TS-08-OBS');
const matrixCount = computed(() => runConfig.value?.config_json?.matrix?.length ?? 0);
const chainStepCount = computed(() => runConfig.value?.config_json?.steps?.length ?? 0);
const pairArmCount = computed(() => runConfig.value?.config_json?.pairs?.length ?? 0);
const negCaseCount = computed(() => runConfig.value?.config_json?.cases?.length ?? 0);
const obsCheckCount = computed(() => {
  const c = runConfig.value?.config_json?.checks;
  if (Array.isArray(c) && c.length) return c.length;
  return runConfig.value?.config_json?.mode ? 1 : 0;
});
const repeatCount = computed(() =>
  runConfig.value?.config_json?.repeat_count
  ?? runConfig.value?.threshold_json?.passk_N
  ?? '-',
);
const canLaunch = computed(() => {
  if (!envId.value || !LAUNCHABLE_SCHEMES.has(schemeId.value)) return false;
  if (isSetScheme.value && !runConfig.value?.sample_set_id) return false;
  if (isBndScheme.value && matrixCount.value === 0) return false;
  if (isRepScheme.value) {
    const n = Number(repeatCount.value);
    if (!Number.isFinite(n) || n < 1) return false;
  }
  if (isChainScheme.value && chainStepCount.value === 0) return false;
  if (isPairScheme.value && pairArmCount.value === 0) return false;
  if (isNegScheme.value && negCaseCount.value === 0) return false;
  if (isObsScheme.value && obsCheckCount.value === 0) return false;
  return true;
});
const canDryRun = computed(() => envId.value && LAUNCHABLE_SCHEMES.has(schemeId.value));
const dryRunSubRows = computed(() => dryRunResult.value?.sub_results || []);

async function loadLaunchData() {
  loading.value = true;
  try {
    const [ itemData, envData ] = await Promise.all([
      fetchTestItem(itemId.value),
      fetchEnvironments({ pageSize: 50 }),
    ]);
    item.value = itemData;
    envs.value = envData.list || [];
    const def = envs.value.find(e => e.is_default) || envs.value[0];
    envId.value = def?.id ?? null;
    if (itemData.scheme_primary_id) {
      runConfig.value = await fetchRunConfig(itemId.value, itemData.scheme_primary_id);
    }
  } finally {
    loading.value = false;
  }
}

async function runDryRun() {
  dryRunning.value = true;
  dryRunResult.value = null;
  engineMsg.value = '';
  try {
    dryRunResult.value = await dryRunLaunch(itemId.value, {
      env_id: envId.value,
      scheme_id: schemeId.value,
      validation_id: validationId.value,
    });
  } catch (e) {
    engineMsg.value = e.response?.data?.message || e.message || '预检失败';
  } finally {
    dryRunning.value = false;
  }
}

async function launch() {
  launching.value = true;
  engineMsg.value = '';
  try {
    const run = await launchRun(itemId.value, {
      env_id: envId.value,
      scheme_id: schemeId.value,
      validation_id: validationId.value,
    });
    router.push(buildRunConsoleRoute(run.id, route.query));
  } catch (e) {
    engineMsg.value = e.response?.data?.message || e.message || '执行失败';
  } finally {
    launching.value = false;
  }
}

watch(itemId, loadLaunchData);

onMounted(loadLaunchData);
</script>

<style scoped>
.launch-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
