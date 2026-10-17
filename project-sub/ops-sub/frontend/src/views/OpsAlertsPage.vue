<template>
  <PageShell title="告警中心" table-layout>
    <template #extra>
      <el-button :loading="watching" @click="watchNow">立即巡检</el-button>
    </template>
    <div class="ops-filter-bar">
      <el-select v-model="status" clearable placeholder="状态" style="width: 140px" @change="apply">
        <el-option label="未处理" value="open" />
        <el-option label="已认领" value="ack" />
        <el-option label="已解决" value="resolved" />
      </el-select>
    </div>
    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <el-empty v-else-if="!loading && !alerts.length" description="没有告警" />
    <DataTablePanel
      v-else
      v-model:page="page"
      v-model:page-size="pageSize"
      :total="total"
      :loading="loading"
      @change="load"
    >
      <template #default="{ bodyHeight }">
        <el-table :data="alerts" :height="bodyHeight" row-key="id">
          <el-table-column label="等级" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="row.level === 'critical' ? 'danger' : 'warning'">{{ row.level === 'critical' ? '严重' : '警告' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="title" label="告警" min-width="180" />
          <el-table-column prop="detail" label="说明" min-width="220" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag size="small" :type="alertStatusMeta(row.status).type">{{ alertStatusMeta(row.status).label }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="assignee" label="处理人" width="120" />
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button v-if="row.status === 'open'" link type="primary" @click="onAck(row)">认领</el-button>
              <el-button v-if="row.status === 'open' || row.status === 'ack'" link type="primary" @click="onResolve(row)">解决</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </DataTablePanel>
  </PageShell>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import PageShell from '../components/PageShell.vue';
import DataTablePanel from '../components/DataTablePanel.vue';
import { ackContentAlert, fetchContentAlerts, resolveContentAlert, runContentWatch } from '../services/contentOpsService.js';
import { alertStatusMeta } from '../utils/contentMeta.js';
import { formatDateTime } from '../utils/opsMeta.js';

const alerts = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const status = ref('open');
const loading = ref(false);
const watching = ref(false);
const loadError = ref('');

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await fetchContentAlerts({
      status: status.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    alerts.value = data.list || [];
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

async function onAck(row) {
  try {
    await ackContentAlert(row.id);
    ElMessage.success('已认领');
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function onResolve(row) {
  try {
    await resolveContentAlert(row.id);
    ElMessage.success('已解决');
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function watchNow() {
  watching.value = true;
  try {
    await runContentWatch();
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  } finally {
    watching.value = false;
  }
}

let timer;
onMounted(() => {
  load();
  timer = setInterval(load, 15000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>
