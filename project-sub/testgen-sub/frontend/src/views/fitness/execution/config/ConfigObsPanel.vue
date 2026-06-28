<template><GenericSchemePanel :item="item" title="可观测稽核 (TS-08-OBS)" hint="SLS/RDS/journey 字段清单" /></template>
<script setup>
import GenericSchemePanel from './GenericSchemePanel.vue';
defineProps({ item: Object });
</script>
