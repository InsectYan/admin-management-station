<template>
  <PageShell :title="item?.item_name || item?.detail_summary || '测试项详情'" v-loading="loading">
    <template #extra>
      <el-button @click="router.push('/fitness/assets/items')">返回列表</el-button>
      <el-button :type="activeModule === 'config' ? 'primary' : 'default'" @click="goModule('config')">配置</el-button>
      <el-button :type="activeModule === 'launch' ? 'primary' : 'default'" @click="goModule('launch')">执行</el-button>
      <el-button :type="activeModule === 'history' ? 'primary' : 'default'" @click="goModule('history')">历史</el-button>
    </template>
    <router-view />
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchTestItem } from '@/services/fitnessService.js';

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

function goModule(module) {
  const base = `/fitness/assets/items/${encodeURIComponent(itemId.value)}`;
  if (module === 'detail') router.push(base);
  else router.push(`${base}/${module}`);
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
