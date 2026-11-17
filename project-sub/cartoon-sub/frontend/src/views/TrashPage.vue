<template>
  <PageShell title="垃圾箱" :loading="loading">
    <div class="cartoon-module cartoon-trash">
      <p class="cartoon-trash__hint">这里集中已经对不上镜头的帧图、还指着这些目录的路径，以及没有镜头的提示词记录。上游已经删除的会标成已删除。</p>
      <div class="cartoon-trash__table">
        <el-table :data="pageRows" row-key="id" height="100%" empty-text="没有追溯不到源头的数据">
          <el-table-column label="类型" width="120" prop="kind_label" />
          <el-table-column label="内容" min-width="280" prop="detail" show-overflow-tooltip />
          <el-table-column label="项目" min-width="160">
            <template #default="{ row }">
              <span>{{ sourceText(row.project_name, '项目已不在') }}</span>
              <el-tag v-if="row.project_state !== 'ok'" size="small" type="danger">已删除</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="快照" min-width="180">
            <template #default="{ row }">
              <span>{{ sourceText(row.snapshot_title, '快照已不在') }}</span>
              <el-tag v-if="row.snapshot_state !== 'ok'" size="small" type="danger">已删除</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="镜头" width="140">
            <template #default="{ row }">
              <span>{{ sourceText(row.shot_label, '镜头已不在') }}</span>
              <el-tag v-if="row.shot_state !== 'ok'" size="small" type="danger">已删除</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="88" fixed="right">
            <template #default="{ row }">
              <el-button link type="danger" :disabled="!canMake()" @click="removeRow(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        class="cartoon-pager"
        :page-sizes="PAGE_SIZES"
        :total="rows.length"
        :layout="PAGER_LAYOUT"
        background
        @size-change="page = 1"
      />
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import { request } from '../services/apiConfig.js';
import { canMake } from '../lib/appAccess.js';
import { PAGE_SIZES, PAGER_LAYOUT } from '../lib/pager.js';

const loading = ref(false);
const rows = ref([]);
const page = ref(1);
const pageSize = ref(50);
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return rows.value.slice(start, start + pageSize.value);
});

watch(rows, list => {
  const pages = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (page.value > pages) page.value = pages;
});

function sourceText(name, missing) {
  return name || missing;
}

async function load() {
  loading.value = true;
  try {
    rows.value = await request('/trash') || [];
  } catch (err) {
    rows.value = [];
    ElMessage.error(err?.message || '垃圾箱加载失败');
  } finally {
    loading.value = false;
  }
}

async function removeRow(row) {
  try {
    await ElMessageBox.confirm('删除后这条数据就清掉了。', '清除垃圾数据', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  try {
    await request(`/trash/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
    ElMessage.success('已清除');
    await load();
  } catch (err) {
    ElMessage.error(err?.message || '清除失败');
  }
}

onMounted(load);
</script>

<style scoped>
.cartoon-trash {
  gap: 12px;
}
.cartoon-trash__hint {
  margin: 0;
  color: #5c6b62;
  line-height: 1.5;
}
.cartoon-trash__table {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}
.cartoon-trash :deep(.el-tag) {
  margin-left: 6px;
}
.cartoon-trash > .cartoon-pager {
  flex: none;
  margin-top: 0;
  justify-content: flex-end;
}
</style>
