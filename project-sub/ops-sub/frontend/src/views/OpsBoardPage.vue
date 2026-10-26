<template>
  <PageShell title="数据看板">
    <template #extra>
      <el-button type="primary" :loading="loading" @click="load">刷新</el-button>
    </template>
    <el-alert v-if="loadError" type="error" :title="loadError" show-icon :closable="false" />
    <el-alert v-if="board?.production_error" type="warning" :title="board.production_error" show-icon :closable="false" />

    <h4 class="ops-block-title">生产</h4>
    <div class="ops-summary-row">
      <el-statistic title="近一小时成功" :value="board?.production?.hour_success ?? 0" />
      <el-statistic title="近一小时失败" :value="board?.production?.hour_failed ?? 0" />
      <el-statistic title="成功率" :value="rate(board?.production?.success_rate)" />
      <div class="ops-duration">
        <div class="ops-duration-label">今日成功平均耗时</div>
        <div class="ops-duration-value">{{ formatDuration(board?.production?.avg_duration_sec) }}</div>
      </div>
    </div>

    <h4 class="ops-block-title">成本</h4>
    <div class="ops-summary-row">
      <el-statistic title="调用次数" :value="board?.cost?.call_count ?? 0" />
      <el-statistic title="媒体秒数" :value="board?.cost?.media_seconds ?? 0" />
      <el-statistic title="存储字节" :value="board?.cost?.storage_bytes ?? 0" />
    </div>

    <h4 class="ops-block-title">质量</h4>
    <div class="ops-summary-row">
      <el-statistic title="审核通过" :value="count(board?.quality?.review_pass)" />
      <el-statistic title="审核驳回" :value="count(board?.quality?.review_reject)" />
      <el-statistic title="驳回率" :value="rate(board?.quality?.reject_rate)" />
      <el-statistic title="未关闭一致性问题" :value="count(board?.quality?.open_consistency)" />
    </div>
    <h4 class="ops-block-title">分发</h4>
    <div class="ops-summary-row">
      <el-statistic title="播放量" :value="board?.distribution?.play_count ?? 0" />
      <el-statistic title="完播" :value="board?.distribution?.finish_count ?? 0" />
      <el-statistic title="渠道转化" :value="board?.distribution?.conversion_count ?? 0" />
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import PageShell from '../components/PageShell.vue';
import { fetchContentBoard } from '../services/contentOpsService.js';
import { formatDuration } from '../utils/contentMeta.js';

const loading = ref(false);
const loadError = ref('');
const board = ref(null);

function rate(value) {
  if (value == null) return '—';
  return `${Math.round(value * 100)}%`;
}

function count(value) {
  return value == null ? '—' : value;
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    board.value = await fetchContentBoard();
  } catch (err) {
    loadError.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
