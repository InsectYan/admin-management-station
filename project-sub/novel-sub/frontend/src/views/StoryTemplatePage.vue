<template>
  <PageShell title="故事模板">
    <p>模板只预填项目类型、空卷和人物角色。不写人物姓名，也不发布故事包。</p>
    <el-empty v-if="!rows.length" description="还没有模板" />
    <el-card v-for="item in rows" :key="item.id" class="novel-template-card" shadow="never">
      <h3>{{ item.name }}</h3>
      <p>预填 {{ item.volume_title }}，角色位是主角、配角、反派。</p>
      <el-button type="primary" @click="open(item)">用这个模板</el-button>
    </el-card>
    <el-dialog v-model="visible" title="从模板创建" width="420px">
      <el-form label-width="72px">
        <el-form-item label="标题">
          <el-input v-model="title" placeholder="作品标题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="create">创建</el-button>
      </template>
    </el-dialog>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { createNovelFromTemplate, fetchStoryTemplates } from '../services/novelService.js';

const router = useRouter();
const rows = ref([]);
const visible = ref(false);
const saving = ref(false);
const title = ref('');
const templateId = ref('');

function open(item) {
  templateId.value = item.id;
  title.value = '';
  visible.value = true;
}
async function create() {
  const name = title.value.trim();
  if (!name) return;
  saving.value = true;
  try {
    const novel = await createNovelFromTemplate({ template_id: templateId.value, title: name });
    visible.value = false;
    router.push(`/novels/${novel.id}`);
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  try {
    rows.value = await fetchStoryTemplates() || [];
  } catch (err) {
    ElMessage.error(err.message);
  }
});
</script>

<style scoped>
.novel-template-card { margin-top: 12px; }
</style>
