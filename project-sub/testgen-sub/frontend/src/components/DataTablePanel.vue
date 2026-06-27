<template>
  <div
    ref="panelRef"
    class="testgen-data-table-panel"
    :style="panelStyle"
  >
    <div
      class="testgen-data-table-panel__body"
      :style="bodyStyle"
    >
      <slot
        :body-height="bodyHeightPx"
        :panel-height="panelHeightPx"
        :footer-height="footerHeightPx"
        :show-footer="showFooter"
      />
    </div>
    <div
      v-if="showFooter"
      ref="footerRef"
      class="testgen-data-table-panel__footer"
      :style="footerStyle"
    >
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="pageSizes"
        :layout="layout"
        :disabled="loading"
        background
        @current-change="handleCurrentChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<script setup>
import {
  computed, ref, watch, onMounted, onUnmounted, nextTick,
} from 'vue';

const props = defineProps({
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 20 },
  total: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  pageSizes: {
    type: Array,
    default: () => [10, 20, 50, 100],
  },
  layout: {
    type: String,
    default: 'total, sizes, prev, pager, next, jumper',
  },
  /** 无数据时隐藏分页条 */
  hideWhenEmpty: { type: Boolean, default: true },
  /** 分页条与视口底部的间距（px） */
  bottomGap: { type: Number, default: 24 },
  /** 表格区域最小高度（px） */
  minBodyHeight: { type: Number, default: 200 },
});

const emit = defineEmits([ 'update:page', 'update:pageSize', 'change' ]);

const panelRef = ref(null);
const footerRef = ref(null);
const panelHeight = ref(null);
const footerHeight = ref(52);
const footerRect = ref({ left: 0, width: 0 });

const showFooter = computed(() => {
  if (props.hideWhenEmpty && props.total <= 0) return false;
  return true;
});

const bodyHeightPx = computed(() => {
  if (panelHeight.value == null) return null;
  const footerSpace = showFooter.value ? footerHeight.value : 0;
  return Math.max(props.minBodyHeight, panelHeight.value - footerSpace);
});

const panelHeightPx = computed(() => panelHeight.value);
const footerHeightPx = computed(() => (showFooter.value ? footerHeight.value : 0));

const panelStyle = computed(() => {
  if (panelHeight.value == null) return {};
  return { height: `${panelHeight.value}px` };
});

const bodyStyle = computed(() => {
  if (bodyHeightPx.value == null) return {};
  return { height: `${bodyHeightPx.value}px` };
});

const footerStyle = computed(() => ({
  position: 'fixed',
  left: `${footerRect.value.left}px`,
  width: `${footerRect.value.width}px`,
  bottom: `${props.bottomGap}px`,
}));

function measureLayout() {
  const panel = panelRef.value;
  if (!panel) return;

  const top = panel.getBoundingClientRect().top;
  const available = window.innerHeight - top - props.bottomGap;
  panelHeight.value = Math.max(props.minBodyHeight, available);

  const rect = panel.getBoundingClientRect();
  footerRect.value = { left: rect.left, width: rect.width };

  if (showFooter.value && footerRef.value) {
    footerHeight.value = footerRef.value.offsetHeight || 52;
  }
}

let rafId = 0;
function scheduleMeasure() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    measureLayout();
  });
}

function handleCurrentChange(nextPage) {
  if (nextPage === props.page) return;
  emit('update:page', nextPage);
  emit('change', { page: nextPage, pageSize: props.pageSize });
}

function handleSizeChange(nextSize) {
  if (nextSize === props.pageSize && props.page === 1) return;
  emit('update:pageSize', nextSize);
  emit('update:page', 1);
  emit('change', { page: 1, pageSize: nextSize });
}

watch(showFooter, () => {
  nextTick(scheduleMeasure);
});

watch(() => props.total, () => {
  nextTick(scheduleMeasure);
});

onMounted(() => {
  nextTick(scheduleMeasure);
  window.addEventListener('resize', scheduleMeasure);
  window.addEventListener('scroll', scheduleMeasure, true);
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  window.removeEventListener('resize', scheduleMeasure);
  window.removeEventListener('scroll', scheduleMeasure, true);
});
</script>

<style scoped>
.testgen-data-table-panel {
  position: relative;
  width: 100%;
}

.testgen-data-table-panel__body {
  overflow: hidden;
}

.testgen-data-table-panel__footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-shrink: 0;
  padding: 12px 0;
  border-top: 1px solid #ebeef5;
  background: #fff;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
  z-index: 20;
}
</style>
