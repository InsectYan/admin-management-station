<template>
  <div class="precheck-page">
    <div v-if="title || $slots.extra" class="precheck-page-header">
      <h4 v-if="title" class="precheck-page-title">{{ title }}</h4>
      <div v-if="$slots.extra" class="precheck-page-extra"><slot name="extra" /></div>
    </div>
    <div class="precheck-page-body"><slot /></div>
  </div>
</template>

<script setup>
defineProps({ title: { type: String, default: '' } });
</script>
