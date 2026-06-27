<template>
  <div class="testgen-page" :class="{ 'testgen-page--table': tableLayout }">
    <div v-if="title || $slots.extra" class="testgen-page-header">
      <h4 v-if="title" class="testgen-page-title">{{ title }}</h4>
      <div v-if="$slots.extra" class="testgen-page-extra">
        <slot name="extra" />
      </div>
    </div>
    <div class="testgen-page-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  /** 表格页：撑满视口高度，分页器吸底 */
  tableLayout: { type: Boolean, default: false },
});
</script>
