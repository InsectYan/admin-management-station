<template><GenericSchemePanel :item="item" title="人工评审 (TS-10-MAN)" hint="发起评审，非自动执行" /></template>
<script setup>
import GenericSchemePanel from './GenericSchemePanel.vue';
defineProps({ item: Object });
</script>
