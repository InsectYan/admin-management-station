<template>
  <div class="testgen-expandable-text">
    <div class="testgen-expandable-text-header">
      <span class="testgen-expandable-text-title">{{ title }}</span>
      <span v-if="hasActions" class="testgen-expandable-text-actions">
        <el-button
          v-if="showMore"
          link
          type="primary"
          size="small"
          @click="expandMore"
        >
          展示更多
        </el-button>
        <el-button
          v-if="showCollapse"
          link
          type="info"
          size="small"
          @click="collapse"
        >
          收起
        </el-button>
      </span>
    </div>
    <pre
      class="testgen-expandable-text-pre"
      :class="{ 'is-error': variant === 'error' }"
    >{{ displayText }}</pre>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const INITIAL_LIMIT = 500;
const EXPAND_STEP = 1000;

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    default: '',
  },
  variant: {
    type: String,
    default: 'default',
  },
});

const visibleLimit = ref(INITIAL_LIMIT);

const fullText = computed(() => String(props.content ?? '').trim());

const displayText = computed(() => {
  if (!fullText.value) return '暂无内容';
  if (fullText.value.length <= visibleLimit.value) return fullText.value;
  return fullText.value.slice(0, visibleLimit.value);
});

const showMore = computed(() => fullText.value.length > visibleLimit.value);

const showCollapse = computed(() => visibleLimit.value > INITIAL_LIMIT);

const hasActions = computed(() =>
  fullText.value.length > INITIAL_LIMIT && (showMore.value || showCollapse.value),
);

function expandMore() {
  visibleLimit.value = Math.min(visibleLimit.value + EXPAND_STEP, fullText.value.length);
}

function collapse() {
  visibleLimit.value = INITIAL_LIMIT;
}

watch(fullText, () => {
  visibleLimit.value = INITIAL_LIMIT;
});
</script>
