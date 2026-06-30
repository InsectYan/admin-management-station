<template>
  <div v-loading="loading">
    <el-alert type="info" :closable="false" style="margin-bottom:16px">
      配置页预填来自 test_item_detail；保存后可在执行页一键执行。E5 支持 TS-01～08（不含 LOAD/MAN）。
    </el-alert>
    <component
      :is="configComponent"
      v-if="item"
      :item="item"
      v-model="configJson"
      v-model:threshold="thresholdJson"
    />
    <el-collapse v-if="item?.scheme_secondary_id" style="margin-top:16px">
      <el-collapse-item title="次要方案 (scheme_secondary_id)" name="secondary">
        <p>
          {{ item.scheme_secondary_name || item.scheme_secondary_id }}
          · VS: {{ item.validation_secondary_id || '-' }}
        </p>
        <el-alert type="info" :closable="false">
          次要方案配置需单独保存；当前页编辑主方案 {{ schemeId }}。
        </el-alert>
        <el-button
          v-if="secondarySchemeType"
          link
          type="primary"
          style="margin-top:8px"
          @click="loadSecondaryConfig"
        >
          加载次要方案预填
        </el-button>
      </el-collapse-item>
    </el-collapse>
    <el-button type="primary" style="margin-top:16px" @click="save">保存配置</el-button>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  SCHEME_TYPE_TO_ID,
  fetchRunConfig,
  fetchTestItem,
  saveRunConfig,
  schemeToConfigPath,
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
const itemId = computed(() => route.params.itemId);
const schemeType = computed(() => route.params.schemeType || schemeToConfigPath(item.value?.scheme_primary_id));
const schemeId = computed(() => SCHEME_TYPE_TO_ID[schemeType.value] || 'TS-01-DET');
const secondarySchemeType = computed(() =>
  item.value?.scheme_secondary_id ? schemeToConfigPath(item.value.scheme_secondary_id) : null,
);
const configComponent = computed(() => COMPONENTS[schemeType.value] || COMPONENTS.det);
const loading = ref(false);
const item = ref(null);
const configJson = ref({});
const thresholdJson = ref({});

async function loadConfig() {
  loading.value = true;
  try {
    item.value = await fetchTestItem(itemId.value);
    const saved = await fetchRunConfig(itemId.value, schemeId.value);
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
}

async function save() {
  await saveRunConfig(itemId.value, {
    scheme_id: schemeId.value,
    config_json: configJson.value,
    threshold_json: thresholdJson.value,
    sample_set_id: configJson.value.sample_set_id,
  });
  ElMessage.success('配置已保存');
}

async function loadSecondaryConfig() {
  if (!item.value?.scheme_secondary_id) return;
  loading.value = true;
  try {
    const saved = await fetchRunConfig(itemId.value, item.value.scheme_secondary_id);
    configJson.value = saved?.config_json || configJson.value;
    thresholdJson.value = saved?.threshold_json || thresholdJson.value;
    ElMessage.info('已加载次要方案配置到当前表单（保存时将写入主方案）');
  } finally {
    loading.value = false;
  }
}

watch(itemId, loadConfig);

onMounted(loadConfig);
</script>
