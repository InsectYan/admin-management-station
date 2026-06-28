<template>
  <PageShell title="执行确认" v-loading="loading">
    <el-checkbox-group v-model="checkedPre">
      <el-checkbox v-for="(p,i) in item?.preconditions||[]" :key="i" :label="p">{{ p }}</el-checkbox>
    </el-checkbox-group>
    <el-divider />
    <p>TS: {{ item?.scheme_primary_id }} · VS: {{ item?.validation_primary_id }}</p>
    <el-button type="primary" :loading="launching" @click="launch">一键执行</el-button>
    <el-alert v-if="engineMsg" type="warning" :title="engineMsg" style="margin-top:16px" />
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchTestItem, launchRun } from '@/services/fitnessService.js';

const route = useRoute();
const router = useRouter();
const itemId = route.params.itemId;
const loading = ref(false);
const launching = ref(false);
const item = ref(null);
const checkedPre = ref([]);
const engineMsg = ref('');

onMounted(async () => {
  loading.value = true;
  item.value = await fetchTestItem(itemId);
  loading.value = false;
});

async function launch() {
  launching.value = true;
  engineMsg.value = '';
  try {
    const run = await launchRun(itemId, {
      scheme_id: item.value.scheme_primary_id,
      validation_id: item.value.validation_primary_id,
    });
    router.push(`/fitness/execution/runs/${run.id}`);
  } catch (e) {
    engineMsg.value = e.message || '执行引擎未开发';
  } finally {
    launching.value = false;
  }
}
</script>
