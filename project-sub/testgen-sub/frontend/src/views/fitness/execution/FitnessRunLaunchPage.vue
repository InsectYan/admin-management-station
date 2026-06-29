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
    <p>TS: {{ item?.scheme_primary_id }} · VS: {{ item?.validation_primary_id }}</p>
    <el-button type="primary" :loading="launching" :disabled="!envId" @click="launch">一键执行</el-button>
    <el-alert v-if="engineMsg" type="warning" :title="engineMsg" style="margin-top:16px" />
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchEnvironments, fetchTestItem, launchRun } from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const itemId = route.params.itemId;
const loading = ref(false);
const launching = ref(false);
const item = ref(null);
const envs = ref([]);
const envId = ref(null);
const checkedPre = ref([]);
const engineMsg = ref('');

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
      scheme_id: item.value.scheme_primary_id,
      validation_id: item.value.validation_primary_id,
    });
    router.push(`/fitness/execution/runs/${run.id}`);
  } catch (e) {
    engineMsg.value = e.message || '执行失败';
  } finally {
    launching.value = false;
  }
}
</script>
