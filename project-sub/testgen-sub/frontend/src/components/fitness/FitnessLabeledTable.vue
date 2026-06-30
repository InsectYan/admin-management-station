<template>
  <DataTablePanel
    :page="page"
    :page-size="pageSize"
    :total="displayTotal"
    :loading="loading"
    :hide-when-empty="hideWhenEmpty"
    @update:page="emit('update:page', $event)"
    @update:page-size="emit('update:pageSize', $event)"
    @change="emit('change', $event)"
  >
    <template #default="{ bodyHeight }">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="displayData"
        :height="bodyHeight ?? undefined"
        stripe
        border
        style="width: 100%"
        v-bind="tableProps"
        @row-click="(row, col, e) => emit('row-click', row, col, e)"
        @selection-change="(rows) => emit('selection-change', rows)"
      >
        <slot name="prefix" />
        <el-table-column
          v-for="col in resolvedColumns"
          :key="col.prop"
          :prop="col.prop"
          :label="col.label"
          :width="col.width"
          :min-width="col.minWidth || 120"
        >
          <template #default="{ row }">
            <el-tooltip
              :content="cellTooltipValue(row, col.prop, col.label)"
              placement="top"
              :show-after="400"
            >
              <span class="fitness-cell-text">
                <slot :name="`col-${col.prop}`" :row="row" :value="cellDisplayValue(row, col.prop)">
                  {{ cellDisplayValue(row, col.prop) }}
                </slot>
              </span>
            </el-tooltip>
          </template>
        </el-table-column>
        <slot name="suffix" />
      </el-table>
    </template>
  </DataTablePanel>
</template>

<script setup>
import { computed, ref } from 'vue';
import DataTablePanel from '@/components/DataTablePanel.vue';
import { cellDisplayValue, cellTooltipValue, inferColumnsFromRow } from '@/utils/fitnessTableColumns.js';

const tableRef = ref(null);

const props = defineProps({
  data: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  tableProps: { type: Object, default: () => ({}) },
  /** true 时在前端对 data 切片分页 */
  clientPagination: { type: Boolean, default: false },
  hideWhenEmpty: { type: Boolean, default: true },
});

const emit = defineEmits([ 'update:page', 'update:pageSize', 'change', 'row-click', 'selection-change' ]);

const displayData = computed(() => {
  if (!props.clientPagination) return props.data;
  const start = (props.page - 1) * props.pageSize;
  return props.data.slice(start, start + props.pageSize);
});

const displayTotal = computed(() => (
  props.clientPagination ? props.data.length : props.total
));

const resolvedColumns = computed(() => {
  const sample = displayData.value[0] || props.data[0];
  return inferColumnsFromRow(sample, props.columns);
});

function clearSelection() {
  tableRef.value?.clearSelection?.();
}

defineExpose({ clearSelection });
</script>

<style scoped>
.fitness-cell-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
</style>
