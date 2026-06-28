<template>
  <div class="fitness-filter-bar">
    <el-select v-if="showDimension" v-model="local.dimension_id" placeholder="维度" clearable style="width:120px" @change="emitChange">
      <el-option v-for="d in options.dimensions" :key="d.dimension_id" :label="d.name" :value="d.dimension_id" />
    </el-select>
    <el-select v-if="showMajor" v-model="local.category_major_id" placeholder="大类" clearable filterable style="width:160px" @change="emitChange">
      <el-option v-for="m in filteredMajors" :key="m.category_major_id" :label="m.name" :value="m.category_major_id" />
    </el-select>
    <el-select v-model="local.priority_id" placeholder="优先级" clearable style="width:100px" @change="emitChange">
      <el-option v-for="p in options.priorities" :key="p.priority_id" :label="p.name || p.priority_id" :value="p.priority_id" />
    </el-select>
    <el-select v-model="local.scheme_primary_id" placeholder="TS" clearable filterable style="width:130px" @change="emitChange">
      <el-option v-for="s in options.schemes" :key="s.scheme_id" :label="`${s.scheme_id} ${s.name || ''}`.trim()" :value="s.scheme_id" />
    </el-select>
    <el-select v-model="local.validation_primary_id" placeholder="VS" clearable filterable style="width:140px" @change="emitChange">
      <el-option v-for="v in options.validations" :key="v.validation_id" :label="`${v.validation_id} ${v.name || ''}`.trim()" :value="v.validation_id" />
    </el-select>
    <el-select v-model="local.automation_status_id" placeholder="自动化" clearable style="width:130px" @change="emitChange">
      <el-option v-for="a in options.automation" :key="a.automation_status_id" :label="a.name || a.automation_status_id" :value="a.automation_status_id" />
    </el-select>
    <el-select v-model="local.station_id" placeholder="六站" clearable style="width:100px" @change="emitChange">
      <el-option v-for="s in options.stations" :key="s.station_id" :label="s.name || s.station_id" :value="s.station_id" />
    </el-select>
    <el-select v-model="local.role_scope_id" placeholder="三端" clearable style="width:110px" @change="emitChange">
      <el-option v-for="r in options.roles" :key="r.role_scope_id" :label="r.name" :value="r.role_scope_id" />
    </el-select>
    <el-checkbox v-model="local.is_p0_blocker" @change="emitChange">P0阻塞</el-checkbox>
    <el-checkbox v-model="local.is_risk_flag" @change="emitChange">风险项</el-checkbox>
    <el-input v-model="local.keyword" placeholder="关键词" clearable style="width:180px" @change="emitChange" />
    <el-select v-model="local.preset" placeholder="快捷筛选" clearable style="width:160px" @change="emitChange">
      <el-option label="教练主链 P0" value="coach_p0" />
      <el-option label="会员载荷边界" value="member_boundary" />
      <el-option label="六站门禁 S02" value="station_gate" />
      <el-option label="P0 待建自动化" value="auto_todo_p0" />
    </el-select>
    <el-button v-if="showClear" :disabled="!hasActiveFilters" @click="clearAll">清空筛选</el-button>
    <slot name="extra" />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, watch } from 'vue';
import { fetchEnums } from '@/services/fitnessService.js';

const EMPTY_ITEM_FILTERS = {
  dimension_id: '',
  category_major_id: '',
  priority_id: '',
  scheme_primary_id: '',
  validation_primary_id: '',
  automation_status_id: '',
  station_id: '',
  role_scope_id: '',
  is_p0_blocker: false,
  is_risk_flag: false,
  keyword: '',
  preset: '',
};

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  showDimension: { type: Boolean, default: true },
  showMajor: { type: Boolean, default: true },
  showClear: { type: Boolean, default: true },
});

const emit = defineEmits([ 'update:modelValue', 'change', 'clear' ]);

const options = reactive({
  dimensions: [], majors: [], priorities: [], schemes: [], validations: [],
  automation: [], stations: [], roles: [],
});

const local = reactive({
  ...EMPTY_ITEM_FILTERS,
  ...props.modelValue,
});

const filteredMajors = computed(() => {
  if (!local.dimension_id) return options.majors;
  return options.majors.filter(m => m.dimension_id === local.dimension_id);
});

const hasActiveFilters = computed(() => (
  Object.entries(EMPTY_ITEM_FILTERS).some(([ key, empty ]) => {
    const v = local[key];
    if (typeof empty === 'boolean') return v !== empty;
    return v !== '' && v != null;
  })
));

function buildPayload() {
  return { ...local };
}

function apiPayload() {
  const payload = buildPayload();
  if (!payload.is_p0_blocker) delete payload.is_p0_blocker;
  if (!payload.is_risk_flag) delete payload.is_risk_flag;
  return payload;
}

function emitChange() {
  const payload = buildPayload();
  emit('update:modelValue', payload);
  emit('change', apiPayload());
}

function clearAll() {
  Object.assign(local, { ...EMPTY_ITEM_FILTERS });
  const payload = buildPayload();
  emit('update:modelValue', payload);
  emit('change', apiPayload());
  emit('clear', apiPayload());
}

watch(() => props.modelValue, (v) => Object.assign(local, { ...EMPTY_ITEM_FILTERS, ...(v || {}) }), { deep: true });

onMounted(async () => {
  const pageSizeAll = 200;
  const [ dimRes, majorRes, priRes, schemeRes, valRes, autoRes, stationRes, roleRes ] = await Promise.all([
    fetchEnums('test_dimension', { page: 1, pageSize: pageSizeAll }),
    fetchEnums('test_category_major', { page: 1, pageSize: pageSizeAll }),
    fetchEnums('test_priority_enum', { page: 1, pageSize: pageSizeAll }),
    fetchEnums('test_scheme_enum', { page: 1, pageSize: pageSizeAll }),
    fetchEnums('test_validation_enum', { page: 1, pageSize: pageSizeAll }),
    fetchEnums('test_automation_status_enum', { page: 1, pageSize: pageSizeAll }),
    fetchEnums('test_station_enum', { page: 1, pageSize: pageSizeAll }),
    fetchEnums('test_role_enum', { page: 1, pageSize: pageSizeAll }),
  ]);
  Object.assign(options, {
    dimensions: dimRes.list || [],
    majors: majorRes.list || [],
    priorities: priRes.list || [],
    schemes: schemeRes.list || [],
    validations: valRes.list || [],
    automation: autoRes.list || [],
    stations: stationRes.list || [],
    roles: roleRes.list || [],
  });
});

defineExpose({ clearAll, hasActiveFilters });
</script>

<style scoped>
.fitness-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}
</style>
