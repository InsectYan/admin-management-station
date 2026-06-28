<template>
  <GenericSchemePanel :item="item" title="同用例重复抽样 (TS-03-REP)" hint="重复次数 N、通过次数 M (passk_N/M)" />
</template>
<script setup>
import GenericSchemePanel from './GenericSchemePanel.vue';
defineProps({ item: Object, modelValue: Object });
</script>
