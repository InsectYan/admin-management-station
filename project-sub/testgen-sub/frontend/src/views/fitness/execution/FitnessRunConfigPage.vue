<template>
  <PageShell :title="`方案配置 — ${schemeType?.toUpperCase()}`" v-loading="loading">
    <el-alert type="info" :closable="false" style="margin-bottom:16px">
      配置页预填来自 test_item_detail；保存后可在执行确认页一键执行。E5 支持 TS-01～08（不含 LOAD/MAN）。
    </el-alert>
    <component
      :is="configComponent"
      v-if="item"
      :item="item"
      v-model="configJson"
      v-model:threshold="thresholdJson"
    />
    <el-button type="primary" style="margin-top:16px" @click="save">保存配置</el-button>
  </PageShell>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import {
  SCHEME_TYPE_TO_ID,
  fetchRunConfig,
  fetchTestItem,
  saveRunConfig,
} from '@/services/fitnessService.js';

const COMPONENTS = {
  det: defineAsyncComponent(() => import('./config/ConfigDetPanel.vue')),
  bnd: defineAsyncComponent(() => import('./config/ConfigBndPanel.vue')),
  rep: defineAsyncComponent(() => import('./config/ConfigRepPanel.vue')),
  set: defineAsyncComponent(() => import('./config/ConfigSetPanel.vue')),
  chain: defineAsyncComponent(() => import('./config/ConfigChainPanel.vue')),
  pair: defineAsyncComponent(() => import('./config/ConfigPairPanel.vue')),
  neg: defineAsyncComponent(() => import('./config/ConfigNegPanel.vue')),
  obs: defineAsyncComponent(() => import('./config/ConfigObsPanel.vue')),
  load: defineAsyncComponent(() => import('./config/ConfigLoadPanel.vue')),
  man: defineAsyncComponent(() => import('./config/ConfigManPanel.vue')),
};

const route = useRoute();
const itemId = route.params.itemId;
const schemeType = computed(() => route.params.schemeType);
const schemeId = computed(() => SCHEME_TYPE_TO_ID[schemeType.value] || 'TS-01-DET');
const configComponent = computed(() => COMPONENTS[schemeType.value] || COMPONENTS.det);
const loading = ref(false);
const item = ref(null);
const configJson = ref({});
const thresholdJson = ref({});

onMounted(async () => {
  loading.value = true;
  try {
    item.value = await fetchTestItem(itemId);
    const saved = await fetchRunConfig(itemId, schemeId.value);
    configJson.value = saved?.config_json || {
      http_method: item.value.http_method,
      endpoint_path: item.value.endpoint_path,
      test_input_example: item.value.test_input_example,
      test_steps: item.value.test_steps,
      assertion_points: item.value.assertion_points,
    };
    if (saved?.sample_set_id && schemeId.value === 'TS-04-SET') {
      configJson.value = { ...configJson.value, sample_set_id: saved.sample_set_id };
    }
    thresholdJson.value = saved?.threshold_json || {};
  } finally {
    loading.value = false;
  }
});

async function save() {
  await saveRunConfig(itemId, {
    scheme_id: schemeId.value,
    config_json: configJson.value,
    threshold_json: thresholdJson.value,
    sample_set_id: configJson.value.sample_set_id,
  });
  ElMessage.success('配置已保存');
}
</script>
