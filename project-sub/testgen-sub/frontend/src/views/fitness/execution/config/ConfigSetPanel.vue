<template>
  <GenericSchemePanel :item="item" title="固定样本集批量 (TS-04-SET)" hint="绑定样本集 + rate_L/M/H 阈值" />
</template>
<script setup>
import GenericSchemePanel from './GenericSchemePanel.vue';
defineProps({ item: Object, modelValue: Object });
</script>
