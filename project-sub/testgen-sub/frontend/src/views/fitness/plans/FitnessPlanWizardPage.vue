<template>
  <PageShell title="测试计划向导">
    <el-steps :active="step" finish-status="success" align-center style="margin-bottom:24px">
      <el-step title="基本信息" />
      <el-step title="目标范围" />
      <el-step title="用例选择" />
      <el-step title="阈值" />
      <el-step title="预览" />
    </el-steps>

    <div v-show="step === 0">
      <el-form label-width="100px">
        <el-form-item label="计划名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="版本"><el-input v-model="form.version_tag" /></el-form-item>
        <el-form-item label="环境"><el-input v-model="form.env_name" /></el-form-item>
      </el-form>
    </div>
    <div v-show="step === 1">
      <el-checkbox-group v-model="selectedGoals">
        <el-checkbox v-for="g in prdGoals" :key="g.goal_id || g.prd_goal_id" :label="g.goal_id || g.prd_goal_id">
          {{ g.goal_id || g.prd_goal_id }} {{ g.goal_name || g.name }}
        </el-checkbox>
      </el-checkbox-group>
    </div>
    <div v-show="step === 2">
      <ItemFilterBar v-model="itemFilters" @change="searchItems" />
      <el-table :data="candidateItems" size="small" @selection-change="onSelect">
        <el-table-column type="selection" width="50" />
        <el-table-column prop="item_id" label="ID" width="140" />
        <el-table-column prop="item_name" label="名称" />
      </el-table>
    </div>
    <div v-show="step === 3">
      <el-form label-width="120px">
        <el-form-item v-for="p in thresholdParams" :key="p.param_id" :label="p.param_id">
          <el-input-number v-model="thresholdValues[p.param_id]" :step="0.01" />
        </el-form-item>
      </el-form>
    </div>
    <div v-show="step === 4">
      <p>计划: {{ form.name }} · 用例 {{ selectedItemIds.length }} 条 · PRD 目标 {{ selectedGoals.length }} 个</p>
      <el-button type="primary" :loading="saving" @click="submit">创建计划</el-button>
    </div>

    <div style="margin-top:24px">
      <el-button v-if="step > 0" @click="step -= 1">上一步</el-button>
      <el-button v-if="step < 4" type="primary" @click="nextStep">下一步</el-button>
    </div>
  </PageShell>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import PageShell from '@/components/PageShell.vue';
import ItemFilterBar from '@/components/fitness/ItemFilterBar.vue';
import { createPlan, fetchEnums, fetchTestItems, fetchView } from '@/services/fitnessService.js';

const router = useRouter();
const step = ref(0);
const saving = ref(false);
const form = reactive({ name: '', version_tag: '', env_name: '', plan_type: 'release' });
const selectedGoals = ref([]);
const selectedItemIds = ref([]);
const prdGoals = ref([]);
const thresholdParams = ref([]);
const thresholdValues = reactive({});
const itemFilters = reactive({});
const candidateItems = ref([]);

function onSelect(rows) {
  selectedItemIds.value = rows.map(r => r.item_id);
}

async function searchItems() {
  const data = await fetchTestItems({ ...itemFilters, pageSize: 100 });
  candidateItems.value = data.list;
}

async function nextStep() {
  if (step.value === 2) await searchItems();
  step.value += 1;
}

async function submit() {
  saving.value = true;
  try {
    const plan = await createPlan({
      ...form,
      scope: [
        ...selectedGoals.value.map(g => ({ scope_type: 'prd_goal', scope_value: g })),
      ],
      thresholds: Object.entries(thresholdValues).map(([ param_id, param_value ]) => ({ param_id, param_value })),
      item_ids: selectedItemIds.value,
    });
    ElMessage.success('计划已创建');
    router.push(`/fitness/plans/${plan.id}`);
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  prdGoals.value = await fetchView('v_metric_prd_goal_coverage');
  thresholdParams.value = await fetchEnums('threshold_param_enum');
});
</script>
