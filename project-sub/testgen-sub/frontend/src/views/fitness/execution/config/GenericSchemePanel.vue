<template>
  <div>
    <p>{{ title }}</p>
    <p class="hint">{{ hint }}</p>
    <el-input :model-value="item?.test_input_example" type="textarea" :rows="3" disabled />
    <p>步骤: {{ (item?.test_steps || []).length }} 步</p>
  </div>
</template>
<script setup>
defineProps({ item: Object, title: String, hint: String });
</script>
<style scoped>.hint { color:#909399; font-size:13px; }</style>
