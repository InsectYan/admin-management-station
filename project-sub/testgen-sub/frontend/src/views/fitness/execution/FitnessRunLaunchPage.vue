<template>

  <PageShell title="执行确认" v-loading="loading">

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

    <el-button

      type="primary"

      :loading="launching"

      :disabled="!canLaunch"

      @click="launch"

    >

      一键执行

    </el-button>

    <el-alert v-if="engineMsg" type="warning" :title="engineMsg" style="margin-top:16px" />

    <el-alert

      v-if="item && !LAUNCHABLE_SCHEMES.has(schemeId)"

      type="error"

      title="当前方案尚未实现执行引擎（已实现 TS-01～08）"

      :closable="false"

      style="margin-top:16px"

    />

  </PageShell>

</template>



<script setup>

import { computed, onMounted, ref } from 'vue';

import { useRoute, useRouter } from 'vue-router';

import PageShell from '@/components/PageShell.vue';

import {

  LAUNCHABLE_SCHEMES,

  fetchEnvironments,

  fetchRunConfig,

  fetchTestItem,

  launchRun,

} from '@/services/fitnessService.js';



const route = useRoute();

const router = useRouter();

const itemId = route.params.itemId;

const loading = ref(false);

const launching = ref(false);

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



onMounted(async () => {

  loading.value = true;

  try {

    const [ itemData, envData ] = await Promise.all([

      fetchTestItem(itemId),

      fetchEnvironments({ pageSize: 50 }),

    ]);

    item.value = itemData;

    envs.value = envData.list || [];

    const def = envs.value.find(e => e.is_default) || envs.value[0];

    envId.value = def?.id ?? null;

    if (itemData.scheme_primary_id) {

      runConfig.value = await fetchRunConfig(itemId, itemData.scheme_primary_id);

    }

  } finally {

    loading.value = false;

  }

});



async function launch() {

  launching.value = true;

  engineMsg.value = '';

  try {

    const run = await launchRun(itemId, {

      env_id: envId.value,

      scheme_id: schemeId.value,

      validation_id: validationId.value,

    });

    router.push(`/fitness/execution/runs/${run.id}`);

  } catch (e) {

    engineMsg.value = e.response?.data?.message || e.message || '执行失败';

  } finally {

    launching.value = false;

  }

}

</script>


