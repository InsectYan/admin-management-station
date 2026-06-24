<template>
  <div class="novel-page">
    <div v-if="title || $slots.extra" class="novel-page-header">
      <h4 v-if="title" class="novel-page-title">{{ title }}</h4>
      <div v-if="$slots.extra" class="novel-page-extra">
        <slot name="extra" />
      </div>
    </div>
    <div class="novel-page-body">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, default: '' },
});
</script>
