<template>
  <PageShell title="发版就绪仪表盘">
    <el-row :gutter="16" v-loading="loading">
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>发版信号</template>
          <el-tag :type="signalType" size="large">{{ readiness?.release_signal || '-' }}</el-tag>
          <p class="stat-desc">P0 待建: {{ readiness?.p0_auto_todo ?? '-' }} / {{ readiness?.p0_total ?? '-' }}</p>
          <p class="stat-desc">风险缺口: {{ readiness?.risk_gap_count ?? '-' }}</p>
          <el-button link type="primary" @click="router.push('/fitness/insights/analysis/readiness')">查看分析</el-button>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>P0 阻塞</template>
          <div class="stat-num">{{ readiness?.p0_auto_todo ?? 0 }}</div>
          <p class="stat-desc">待建自动化占比 {{ readiness?.p0_auto_todo_pct ?? 0 }}%</p>
          <el-button link type="primary" @click="router.push('/fitness/insights/analysis/p0-blockers')">待建清单</el-button>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="never">
          <template #header>风险覆盖</template>
          <p>COVERED: {{ readiness?.risk_covered_count ?? 0 }}</p>
          <p>PARTIAL: {{ readiness?.risk_partial_count ?? 0 }}</p>
          <p>GAP: {{ readiness?.risk_gap_count ?? 0 }}</p>
          <el-button link type="primary" @click="router.push('/fitness/insights/risks?status=GAP')">风险中心</el-button>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>PRD 目标覆盖</template>
          <el-table :data="prdGoals" size="small" max-height="280">
            <el-table-column prop="goal_id" label="目标" width="80" />
            <el-table-column prop="goal_name" label="名称" />
            <el-table-column prop="coverage_note" label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.coverage_note === 'OK' ? 'success' : row.coverage_note === 'LOW' ? 'warning' : 'danger'" size="small">
                  {{ row.coverage_note }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header>自动化分布</template>
          <el-table :data="automation" size="small">
            <el-table-column prop="automation_status_id" label="状态" />
            <el-table-column prop="item_count" label="数量" width="80" />
            <el-table-column prop="pct" label="占比" width="80" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <div class="quick-actions">
      <el-button type="primary" @click="router.push('/fitness/plans/new')">新建测试计划</el-button>
      <el-button @click="router.push({ path: '/fitness/assets/items', query: { preset: 'coach_p0' } })">教练 P0 用例</el-button>
      <el-button @click="router.push({ path: '/fitness/assets/items', query: { station_id: 'S02' } })">六站 B2 门禁</el-button>
    </div>
  </PageShell>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import PageShell from '@/components/PageShell.vue';
import { fetchDashboard } from '@/services/fitnessService.js';

const router = useRouter();
const loading = ref(false);
const readiness = ref(null);
const automation = ref([]);
const prdGoals = ref([]);

const signalType = computed(() => {
  const s = readiness.value?.release_signal;
  if (s === 'GREEN') return 'success';
  if (s === 'YELLOW') return 'warning';
  return 'danger';
});

onMounted(async () => {
  loading.value = true;
  try {
    const data = await fetchDashboard();
    readiness.value = data.readiness;
    automation.value = data.automation || [];
    prdGoals.value = data.prdGoals || [];
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.stat-num { font-size: 32px; font-weight: 600; }
.stat-desc { color: #909399; font-size: 13px; margin: 8px 0; }
.quick-actions { margin-top: 24px; display: flex; gap: 12px; }
</style>
