<template>
  <section class="novel-record">
    <p class="novel-record__hint">这里记下每次把 AI 生成结果保存进作品的快照。人物分新增和调整；正文按删去的行和新增的行对照。</p>
    <el-table v-loading="loading" :data="rows" empty-text="还没有 AI 保存记录" size="small">
      <el-table-column type="expand">
        <template #default="{ row }">
          <ul v-if="row.diff.length" class="novel-record__diff">
            <li v-for="(line, index) in row.diff" :key="index" :class="line.op === 'add' ? 'is-add' : 'is-remove'">
              <span>{{ line.op === 'add' ? '+' : '-' }}</span>
              <em v-if="line.field">{{ line.field }}</em>
              <code>{{ line.text }}</code>
            </li>
          </ul>
          <p v-else class="novel-record__empty">这次保存没有可对照的文字。</p>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="时间" width="170" />
      <el-table-column prop="kind_label" label="类型" width="110" />
      <el-table-column prop="action_label" label="动作" width="80" />
      <el-table-column prop="title" label="对象" width="160" />
      <el-table-column prop="summary" label="摘要" min-width="220" />
    </el-table>
  </section>
</template>

<script setup>
import { ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchGenerationRecords } from '../../../services/novelService.js';

const props = defineProps({
  novelId: { type: [String, Number], default: '' },
});

const loading = ref(false);
const rows = ref([]);

async function load() {
  if (!props.novelId) {
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    const data = await fetchGenerationRecords(props.novelId);
    const list = Array.isArray(data) ? data : (data?.list || []);
    rows.value = list.map((row) => ({ ...row, diff: Array.isArray(row.diff) ? row.diff : [] }));
  } catch (err) {
    ElMessage.error(err.message || '记录加载失败');
  } finally {
    loading.value = false;
  }
}

watch(() => props.novelId, () => { load(); }, { immediate: true });
</script>

<style scoped>
.novel-record__hint {
  margin: 0 0 12px;
  color: #5c6b62;
  font-size: 13px;
}
.novel-record__diff {
  margin: 0;
  padding: 8px 12px;
  list-style: none;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
}
.novel-record__diff li {
  display: flex;
  gap: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  white-space: pre-wrap;
}
.novel-record__diff .is-add { background: rgba(47, 138, 91, 0.12); color: #1f3d2c; }
.novel-record__diff .is-remove { background: rgba(196, 86, 86, 0.12); color: #6d2c2c; }
.novel-record__diff em { font-style: normal; color: #5c6b62; }
.novel-record__diff code { font: inherit; }
.novel-record__empty { margin: 0; color: #5c6b62; }
</style>
