<template>
  <PageShell title="枚举管理" :loading="loading">
    <p class="cartoon-module__hint">这里列出当前会用到的枚举。点开一张卡片，可以查看每一项被哪些项目或镜头引用，也可以新增和修改。编号不能改。</p>
    <el-empty v-if="!loading && !rows.length" :description="loadError || '还没有枚举'" />
    <div v-else class="cartoon-enum-grid">
      <el-card
        v-for="item in rows"
        :key="item.key"
        class="cartoon-enum-card"
        shadow="never"
        tabindex="0"
        @click="open(item)"
        @keyup.enter="open(item)"
      >
        <h3>{{ item.name }}</h3>
        <p>{{ item.description }}</p>
        <el-tag size="small">{{ item.item_count }} 项</el-tag>
      </el-card>
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { useRegionLoad } from '../lib/useRegionLoad.js';
import { request } from '../services/apiConfig.js';

const router = useRouter();
const rows = ref([]);
const loadError = ref('');
const { loading, run } = useRegionLoad({ immediate: true });

function open(item) {
  router.push(`/skills/enums/${item.key}`);
}
async function load() {
  await run(async () => {
    loadError.value = '';
    try {
      rows.value = await request('/enums') || [];
    } catch (err) {
      rows.value = [];
      loadError.value = err.message || '枚举加载失败';
      ElMessage.error(loadError.value);
    }
  });
}
onMounted(() => {
  load();
});
</script>

<style scoped>
.cartoon-enum-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.cartoon-enum-card {
  cursor: pointer;
}
.cartoon-enum-card h3 {
  margin: 0 0 8px;
  font-size: 16px;
}
.cartoon-enum-card p {
  margin: 0 0 12px;
  color: #5c6b62;
  line-height: 1.5;
}
</style>
