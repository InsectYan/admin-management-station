<template>
  <div class="ops-page" :class="{ 'ops-page--table': tableLayout }">
    <div v-if="title || $slots.extra" class="ops-page-header">
      <h4 v-if="title" class="ops-page-title">{{ title }}</h4>
      <div v-if="$slots.extra" class="ops-page-extra">
        <slot name="extra" />
      </div>
    </div>
    <div class="ops-page-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
  tableLayout: { type: Boolean, default: false },
});
</script>
