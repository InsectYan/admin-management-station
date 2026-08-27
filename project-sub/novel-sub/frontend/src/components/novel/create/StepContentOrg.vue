<template>
  <ChapterTagList
    :chapters="form.chapters"
    @change="$emit('change')"
    @add="$emit('add')"
  />
</template>

<script setup>
import ChapterTagList from './ChapterTagList.vue';

defineProps({
  form: { type: Object, required: true },
});

defineEmits(['change', 'add']);
</script>
