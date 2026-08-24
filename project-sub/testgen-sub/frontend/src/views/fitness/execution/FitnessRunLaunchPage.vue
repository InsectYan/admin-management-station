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
    <el-divider content-position="left">执行方案</el-divider>
    <SchemePhaseTable :phases="launchPhases" />
    <p v-if="hasSecondary" class="hint">主执行方案完成后自动串联辅执行方案</p>
    <el-divider />
    <p v-if="isSetScheme">样本集 ID: {{ runConfig?.sample_set_id || '未绑定' }}</p>
    <p v-if="isBndScheme">矩阵行数: {{ matrixCount }}</p>
    <p v-if="isRepScheme">重复次数: {{ repeatCount }}</p>
    <p v-if="isChainScheme">链路步骤: {{ chainStepCount }}</p>
    <p v-if="isApiCtxScheme">接口模板: {{ runConfig?.api_template_id || runConfig?.config_json?.api_template_id || '未配置' }}</p>
    <p v-if="isPairScheme">对照臂: {{ pairArmCount }}</p>
    <p v-if="isNegScheme">对抗用例: {{ negCaseCount }}</p>
    <p v-if="isObsScheme">可观测检查: {{ obsCheckCount }}</p>
    <p v-if="hasSecondary && isSecondarySetScheme">辅方案样本集: {{ secondaryRunConfig?.sample_set_id || '未绑定' }}</p>
    <p v-if="hasSecondary && isSecondaryBndScheme">辅方案矩阵行数: {{ secondaryMatrixCount }}</p>
    <p v-if="hasSecondary && isSecondaryChainScheme">辅方案链路步骤: {{ secondaryChainStepCount }}</p>
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
            <FitnessStatusTag prop="sub_verdict" :row="row" />
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
import SchemePhaseTable from '@/components/fitness/SchemePhaseTable.vue';
import FitnessStatusTag from '@/components/fitness/FitnessStatusTag.vue';
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
const secondaryRunConfig = ref(null);
const envs = ref([]);
const envId = ref(null);
const checkedPre = ref([]);
const engineMsg = ref('');

const schemeId = computed(() => item.value?.scheme_primary_id || '');
const validationId = computed(() => item.value?.validation_primary_id || '');
const secondarySchemeId = computed(() => item.value?.scheme_secondary_id || '');
const hasSecondary = computed(() => Boolean(secondarySchemeId.value));

const launchPhases = computed(() => {
  const phases = [
    {
      role: 'primary',
      role_label: '主执行方案',
      scheme_id: schemeId.value,
      scheme_name: item.value?.scheme_primary_name,
      validation_id: validationId.value,
      validation_name: item.value?.validation_primary_name,
      status: 'pending',
      status_label: '等待中',
    },
  ];
  if (hasSecondary.value) {
    phases.push({
      role: 'secondary',
      role_label: '辅执行方案',
      scheme_id: secondarySchemeId.value,
      scheme_name: item.value?.scheme_secondary_name,
      validation_id: item.value?.validation_secondary_id,
      validation_name: item.value?.validation_secondary_name,
      status: 'pending',
      status_label: '等待中',
    });
  }
  return phases;
});

const isSetScheme = computed(() => schemeId.value === 'TS-04-SET');
const isBndScheme = computed(() => schemeId.value === 'TS-02-BND');
const isRepScheme = computed(() => schemeId.value === 'TS-03-REP');
const isChainScheme = computed(() => schemeId.value === 'TS-05-CHAIN');
const isApiCtxScheme = computed(() => schemeId.value === 'TS-05-API');
const isChainFamilyScheme = computed(() => isChainScheme.value || isApiCtxScheme.value);
const isPairScheme = computed(() => schemeId.value === 'TS-06-PAIR');
const isNegScheme = computed(() => schemeId.value === 'TS-07-NEG');
const isObsScheme = computed(() => schemeId.value === 'TS-08-OBS');

const isSecondarySetScheme = computed(() => secondarySchemeId.value === 'TS-04-SET');
const isSecondaryBndScheme = computed(() => secondarySchemeId.value === 'TS-02-BND');
const isSecondaryChainScheme = computed(() => secondarySchemeId.value === 'TS-05-CHAIN');
const isSecondaryApiCtxScheme = computed(() => secondarySchemeId.value === 'TS-05-API');

const matrixCount = computed(() => runConfig.value?.config_json?.matrix?.length ?? 0);
const secondaryMatrixCount = computed(() => secondaryRunConfig.value?.config_json?.matrix?.length ?? 0);
const chainStepCount = computed(() => runConfig.value?.config_json?.steps?.length ?? 0);
const secondaryChainStepCount = computed(() => secondaryRunConfig.value?.config_json?.steps?.length ?? 0);
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

function schemeConfigReady(id, config, itemRef) {
  if (!LAUNCHABLE_SCHEMES.has(id)) return false;
  if (id === 'TS-04-SET') return Boolean(config?.sample_set_id);
  if (id === 'TS-02-BND') return (config?.config_json?.matrix?.length ?? 0) > 0;
  if (id === 'TS-03-REP') {
    const n = Number(config?.config_json?.repeat_count ?? config?.threshold_json?.passk_N);
    return Number.isFinite(n) && n >= 1;
  }
  if (id === 'TS-05-CHAIN' || id === 'TS-05-API') {
    const mode = config?.config_json?.execution_mode
      || (id === 'TS-05-API' ? 'api_ctx' : 'chain')
      || (itemRef?.template_code === 'TPL-API-CTX' ? 'api_ctx' : 'chain');
    if (mode === 'api_ctx') {
      return Boolean(config?.api_template_id || config?.config_json?.api_template_id);
    }
    return (config?.config_json?.steps?.length ?? 0) > 0;
  }
  if (id === 'TS-06-PAIR') return (config?.config_json?.pairs?.length ?? 0) > 0;
  if (id === 'TS-07-NEG') return (config?.config_json?.cases?.length ?? 0) > 0;
  if (id === 'TS-08-OBS') {
    const c = config?.config_json?.checks;
    if (Array.isArray(c) && c.length) return true;
    return Boolean(config?.config_json?.mode);
  }
  return true;
}

const canLaunch = computed(() => {
  if (!envId.value) return false;
  if (!schemeConfigReady(schemeId.value, runConfig.value, item.value)) return false;
  if (hasSecondary.value && !schemeConfigReady(secondarySchemeId.value, secondaryRunConfig.value, item.value)) return false;
  return true;
});
const canDryRun = computed(() => envId.value && LAUNCHABLE_SCHEMES.has(schemeId.value));
const dryRunSubRows = computed(() => dryRunResult.value?.sub_results || []);

async function loadLaunchData() {
  loading.value = true;
  try {
    const itemData = await fetchTestItem(itemId.value);
    item.value = itemData;
    const projectCode = itemData.project_code;
    if (!projectCode) {
      engineMsg.value = '用例缺少 project_code，无法加载执行环境';
      envs.value = [];
      envId.value = null;
      return;
    }
    const [ envData ] = await Promise.all([
      fetchEnvironments({ pageSize: 50, project_code: projectCode }),
    ]);
    envs.value = envData.list || [];
    if (!envs.value.length) {
      engineMsg.value = `项目「${projectCode}」暂无执行环境。请在「项目 → 环境配置」或「执行 → 环境与服务端点」中为本项目创建`;
    }
    const def = envs.value.find(e => e.is_default) || envs.value[0];
    envId.value = def?.id ?? null;

    const configTasks = [];
    if (itemData.scheme_primary_id) {
      configTasks.push(
        fetchRunConfig(itemId.value, itemData.scheme_primary_id).then(cfg => { runConfig.value = cfg; }),
      );
    } else {
      runConfig.value = null;
    }
    if (itemData.scheme_secondary_id) {
      configTasks.push(
        fetchRunConfig(itemId.value, itemData.scheme_secondary_id).then(cfg => { secondaryRunConfig.value = cfg; }),
      );
    } else {
      secondaryRunConfig.value = null;
    }
    await Promise.all(configTasks);
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
      autofill: true,
    });
    router.push(buildRunConsoleRoute(run.id, route.query));
  } catch (e) {
    const payload = e.response?.data;
    if (payload?.code === 'CONFIG_AUTOFILL_BLOCKED') {
      const data = payload.data || {};
      // 后端 message 已含中文 field label + detail；兜底再拼 missing_fixed
      if (payload.message && !/缺失:\s*endpoint_path/i.test(payload.message)) {
        engineMsg.value = payload.message;
      } else {
        const miss = (data.missing_fixed || []).map(m => {
          const head = m.label && m.field && m.label !== m.field
            ? `${m.label}（${m.field}）`
            : (m.label || m.field);
          return m.detail ? `${head}：${m.detail}` : head;
        });
        engineMsg.value = miss.length
          ? `执行前配置不齐全：${miss.join('；')}`
          : (payload.message || '执行前配置不齐全');
      }
    } else {
      engineMsg.value = payload?.message || e.message || '执行失败';
    }
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
.hint {
  margin-top: 8px;
  color: #909399;
  font-size: 13px;
}
</style>
