<template>
  <PageShell title="操作审计" table-layout>
    <div class="ops-filter-bar">
      <el-input v-model="actor" clearable placeholder="操作者" style="width: 160px" />
      <el-select v-model="action" clearable placeholder="动作" style="width: 180px">
        <el-option v-for="item in actionOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-button type="primary" @click="apply">查询</el-button>
    </div>
    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <el-empty v-else-if="!loading && !rows.length" description="还没有审计记录" />
    <DataTablePanel
      v-else
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="total"
      :loading="loading"
      @change="load"
    >
      <template #default="{ bodyHeight }">
        <el-table :data="rows" :height="bodyHeight" row-key="id">
          <el-table-column label="时间" width="180">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column prop="actor" label="操作者" width="140" />
          <el-table-column label="动作" min-width="140">
            <template #default="{ row }">{{ actionLabel(row.action) }}</template>
          </el-table-column>
          <el-table-column prop="biz_app" label="业务" width="100" />
          <el-table-column label="对象" min-width="160">
            <template #default="{ row }">{{ [row.external_type, row.external_id].filter(Boolean).join(' #') || '—' }}</template>
          </el-table-column>
          <el-table-column label="提示词" width="120">
            <template #default="{ row }">
              <el-button link type="primary" @click="openPrompt(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </DataTablePanel>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import PageShell from '../components/PageShell.vue';
import DataTablePanel from '../components/DataTablePanel.vue';
import { ElMessage } from 'element-plus';
import { fetchContentAudit, viewAuditPrompt } from '../services/contentOpsService.js';
import { formatDateTime } from '../utils/opsMeta.js';

const rows = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const actor = ref('');
const actionOptions = [
  { value: 'task.retry', label: '重试任务' },
  { value: 'task.cancel', label: '取消任务' },
  { value: 'alert.ack', label: '认领告警' },
  { value: 'alert.resolve', label: '解决告警' },
  { value: 'config.update', label: '修改配置' },
  { value: 'story.publish', label: '发布故事包' },
  { value: 'story.promotion.apply', label: '应用提升' },
  { value: 'story.promotion.reject', label: '驳回提升' },
  { value: 'story.export', label: '导出正文' },
  { value: 'video.pin', label: '钉扎故事包' },
  { value: 'video.promote', label: '提交提升' },
  { value: 'video.generate', label: '提交生成' },
  { value: 'video.export', label: '导出成片' },
];
const actionNames = Object.fromEntries(actionOptions.map(item => [ item.value, item.label ]));
function actionLabel(value) {
  return actionNames[value] || value;
}
const action = ref('');

async function openPrompt(row) {
  try {
    const data = await viewAuditPrompt(row.id);
    ElMessage.info(data.empty ? '这条记录没有提示词' : '已记下这次查看');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
const loading = ref(false);
const loadError = ref('');

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchContentAudit({
      actor: actor.value || undefined,
      action: action.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    rows.value = data.list || [];
    total.value = data.total || 0;
  } catch (err) {
    loadError.value = err.message;
  } finally {
    loading.value = false;
  }
}

function apply() {
  page.value = 1;
  load();
}

onMounted(load);
</script>
