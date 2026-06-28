<template><GenericSchemePanel :item="item" title="对抗专项 (TS-07-NEG)" hint="阻断率 block_L/M/H" /></template>
<script setup>
import GenericSchemePanel from './GenericSchemePanel.vue';
defineProps({ item: Object });
</script>
