<template>
  <PageShell :title="item?.item_name || item?.detail_summary || '测试项详情'" v-loading="loading">
    <template #extra>
      <el-button @click="goBack">{{ backLabel }}</el-button>
      <el-button v-if="hasListFilters && isFromRunConsole(route.query)" @click="goList">返回列表</el-button>
      <el-button
        v-if="isFromRunConsole(route.query) && activeModule !== 'detail'"
        data-testid="fitness-item-detail-tab"
        type="primary"
        @click="goModule('detail')"
      >
        查看详情
      </el-button>
      <el-button data-testid="fitness-item-config" :type="activeModule === 'config' ? 'primary' : 'default'" @click="goModule('config')">配置</el-button>
      <el-button data-testid="fitness-item-launch" :type="activeModule === 'launch' ? 'primary' : 'default'" @click="goModule('launch')">执行</el-button>
      <el-button data-testid="fitness-item-history" :type="activeModule === 'history' ? 'primary' : 'default'" @click="goModule('history')">历史</el-button>
    </template>
    <router-view />
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchTestItem } from '@/services/fitnessService.js';
import {
  buildItemDetailRoute,
  buildRunConsoleRoute,
  isFromRunConsole,
  pickListQuery,
} from '@/utils/itemListQuery.js';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const item = ref(null);

const itemId = computed(() => route.params.itemId);

const activeModule = computed(() => {
  const suffix = route.path.split('/').pop();
  if ([ 'config', 'launch', 'history' ].includes(suffix)) return suffix;
  return 'detail';
});

const backLabel = computed(() => (
  isFromRunConsole(route.query) ? '返回控制台' : '返回列表'
));

const hasListFilters = computed(() => Object.keys(pickListQuery(route.query)).length > 0);

function goModule(module) {
  router.push(buildItemDetailRoute(itemId.value, { module, query: route.query }));
}

function goBack() {
  if (isFromRunConsole(route.query)) {
    router.push(buildRunConsoleRoute(route.query.runId, route.query));
    return;
  }
  goList();
}

function goList() {
  router.push({ name: 'test-suite', query: pickListQuery(route.query) });
}

async function loadItem() {
  loading.value = true;
  try {
    item.value = await fetchTestItem(itemId.value);
  } finally {
    loading.value = false;
  }
}

watch(itemId, loadItem);

onMounted(loadItem);
</script>
