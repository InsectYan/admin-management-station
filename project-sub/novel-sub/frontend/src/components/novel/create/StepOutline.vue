<template>
  <OutlineTree
    :volumes="form.volumes"
    @change="$emit('change')"
    @add-volume="$emit('add-volume')"
  />
</template>

<script setup>
import OutlineTree from './OutlineTree.vue';

defineProps({
  form: { type: Object, required: true },
});

defineEmits(['change', 'add-volume']);
</script>
