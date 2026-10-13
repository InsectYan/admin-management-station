<template>
  <div class="cartoon-page">
    <div v-if="title || $slots.extra" class="cartoon-page-header">
      <h4 v-if="title" class="cartoon-page-title">{{ title }}</h4>
      <div v-if="$slots.extra" class="cartoon-page-extra"><slot name="extra" /></div>
    </div>
    <div class="cartoon-page-body"><slot /></div>
  </div>
</template>

<script setup>
defineProps({ title: { type: String, default: '' } });
</script>
