<template>
  <section class="novel-style">
    <header>
      <h3>风格</h3>
      <p>选定后，之后的生成会带上这个语气。已有正文不会被改写。清除后恢复原来的生成方式。</p>
    </header>
    <el-empty v-if="!presets.length" description="还没有风格" />
    <div v-else class="novel-style__list">
      <el-card v-for="item in presets" :key="item.id" shadow="never">
        <h4>{{ item.name }}</h4>
        <p>{{ item.note }}</p>
        <el-button
          :type="current === item.id ? 'primary' : 'default'"
          :loading="saving === item.id"
          @click="choose(item.id)"
        >
          {{ current === item.id ? '正在使用' : '使用这个风格' }}
        </el-button>
      </el-card>
    </div>
    <el-button v-if="current" :loading="saving === 'clear'" @click="choose('')">清除风格</el-button>
  </section>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchNovel, fetchStylePresets, saveNovelStyle } from '../../../services/novelService.js';

const props = defineProps({
  novelId: { type: [ Number, String ], default: '' },
});

const presets = ref([]);
const current = ref('');
const saving = ref('');

async function load() {
  if (!props.novelId) return;
  const [list, novel] = await Promise.all([
    fetchStylePresets(),
    fetchNovel(props.novelId),
  ]);
  presets.value = list || [];
  current.value = novel?.style_preset || '';
}

async function choose(presetId) {
  saving.value = presetId || 'clear';
  try {
    const data = await saveNovelStyle(props.novelId, presetId);
    current.value = data?.preset?.id || '';
    ElMessage.success(current.value ? '风格已记下' : '已清除风格');
  } catch (err) {
    ElMessage.error(err.message || '没有记下风格');
  } finally {
    saving.value = '';
  }
}

async function applyFromPatch(patch) {
  const id = String(patch?.style_preset || patch?.style?.id || '').trim();
  if (!id) {
    ElMessage.info('这一轮没有可选的风格');
    return;
  }
  await choose(id);
}

watch(() => props.novelId, () => load().catch(err => ElMessage.error(err.message)));
onMounted(() => load().catch(err => ElMessage.error(err.message)));
defineExpose({ applyFromPatch });
</script>

<style scoped>
.novel-style__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
</style>
