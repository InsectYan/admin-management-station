<template>
  <PageShell :title="title">
    <el-tabs v-if="tabs.length" :model-value="activeTab" @tab-change="onTabChange">
      <el-tab-pane v-for="tab in tabs" :key="tab.path" :label="tab.label" :name="tab.path" />
    </el-tabs>
    <router-view />
  </PageShell>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageShell from '../PageShell.vue';

const props = defineProps({
  title: { type: String, required: true },
  tabs: { type: Array, default: () => [] },
});

const route = useRoute();
const router = useRouter();

const activeTab = computed(() => {
  const match = props.tabs.find(t => route.path.startsWith(t.path));
  return match?.path || props.tabs[0]?.path;
});

function onTabChange(path) {
  router.push(path);
}
</script>
