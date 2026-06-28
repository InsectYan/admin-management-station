<template><GenericSchemePanel :item="item" title="跨端对照 (TS-06-PAIR)" hint="COACH/MEMBER/MANAGER 对照臂" /></template>
<script setup>
import GenericSchemePanel from './GenericSchemePanel.vue';
defineProps({ item: Object });
</script>
