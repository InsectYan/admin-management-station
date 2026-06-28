<template><GenericSchemePanel :item="item" title="压测 SLO (TS-09-LOAD)" hint="VU/持续时间/p99 阈值" /></template>
<script setup>
import GenericSchemePanel from './GenericSchemePanel.vue';
defineProps({ item: Object });
</script>
