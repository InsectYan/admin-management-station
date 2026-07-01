<template>
  <TemplateConfigShell :item-id="itemId" :item="item" editable />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import TemplateConfigShell from '@/components/config-templates/TemplateConfigShell.vue';
import { fetchTestItem } from '@/services/fitnessService.js';

const route = useRoute();
const itemId = computed(() => route.params.itemId);
const item = ref(null);

async function loadItem() {
  item.value = await fetchTestItem(itemId.value);
}

watch(itemId, loadItem);
onMounted(loadItem);
</script>
