<template>
  <div ref="rootRef" class="tag-overflow-cell">
    <el-tag
      v-for="(item, idx) in visibleItems"
      :key="itemKey(item, idx)"
      size="small"
      class="tag-overflow-cell__tag"
    >
      {{ formatLabel(item) }}
    </el-tag>
    <el-tooltip
      v-if="hiddenItems.length"
      placement="top"
      :show-after="200"
    >
      <template #content>
        <div class="tag-overflow-cell__tooltip">
          <div
            v-for="(item, idx) in hiddenItems"
            :key="itemKey(item, idx)"
            class="tag-overflow-cell__tooltip-line"
          >
            {{ formatLabel(item) }}
          </div>
        </div>
      </template>
      <el-tag size="small" type="info" class="tag-overflow-cell__tag tag-overflow-cell__more">
        +{{ hiddenItems.length }}
      </el-tag>
    </el-tooltip>
    <span v-if="!items.length" class="tag-overflow-cell__empty">{{ emptyText }}</span>

    <div ref="sizerRef" class="tag-overflow-cell__sizer" aria-hidden="true">
      <el-tag
        v-for="(item, idx) in items"
        :key="`sizer-${itemKey(item, idx)}`"
        size="small"
        class="tag-overflow-cell__sizer-tag"
      >
        {{ formatLabel(item) }}
      </el-tag>
      <el-tag size="small" type="info" class="tag-overflow-cell__sizer-more">+99</el-tag>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  labelFn: { type: Function, default: null },
  itemKeyFn: { type: Function, default: null },
  emptyText: { type: String, default: '—' },
});

const rootRef = ref(null);
const sizerRef = ref(null);
const visibleCount = ref(null);
let resizeObserver = null;

const resolvedVisibleCount = computed(() => (
  visibleCount.value == null ? props.items.length : visibleCount.value
));
const visibleItems = computed(() => props.items.slice(0, resolvedVisibleCount.value));
const hiddenItems = computed(() => props.items.slice(resolvedVisibleCount.value));

function formatLabel(item) {
  if (props.labelFn) return props.labelFn(item);
  return String(item ?? '');
}

function itemKey(item, idx) {
  if (props.itemKeyFn) return props.itemKeyFn(item, idx);
  return idx;
}

function recalcVisibleCount() {
  const root = rootRef.value;
  const sizer = sizerRef.value;
  const total = props.items.length;

  if (!root || !sizer || !total) {
    visibleCount.value = total;
    return;
  }

  const containerWidth = root.clientWidth;
  if (containerWidth <= 0) {
    visibleCount.value = total;
    return;
  }

  const tagNodes = sizer.querySelectorAll('.tag-overflow-cell__sizer-tag');
  const moreNode = sizer.querySelector('.tag-overflow-cell__sizer-more');
  const moreWidth = moreNode?.offsetWidth || 32;
  const gap = 4;
  let used = 0;
  let count = 0;

  for (let i = 0; i < total; i += 1) {
    const tagWidth = tagNodes[i]?.offsetWidth || 0;
    const hasHidden = i < total - 1;
    const reserve = hasHidden ? moreWidth + gap : 0;
    if (used + tagWidth + reserve > containerWidth) break;
    used += tagWidth + gap;
    count += 1;
  }

  visibleCount.value = count;
}

async function scheduleRecalc() {
  await nextTick();
  recalcVisibleCount();
}

watch(
  () => [ props.items, props.labelFn ],
  () => { scheduleRecalc(); },
  { deep: true },
);

onMounted(() => {
  scheduleRecalc();
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    resizeObserver = new ResizeObserver(() => { recalcVisibleCount(); });
    resizeObserver.observe(rootRef.value);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<style scoped>
.tag-overflow-cell {
  position: relative;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-height: 24px;
  overflow: hidden;
}

.tag-overflow-cell__tag {
  flex: 0 0 auto;
  margin: 0;
}

.tag-overflow-cell__more {
  cursor: default;
}

.tag-overflow-cell__empty {
  color: #909399;
  font-size: 12px;
}

.tag-overflow-cell__tooltip-line + .tag-overflow-cell__tooltip-line {
  margin-top: 4px;
}

.tag-overflow-cell__sizer {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  max-width: none;
  white-space: nowrap;
}

.tag-overflow-cell__sizer-tag {
  margin: 0;
}
</style>
