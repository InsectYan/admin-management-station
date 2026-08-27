<template>
  <div :class="SUBAPP_ROOT_CLASS">
    <router-view />
  </div>
</template>

<script setup>
import { SUBAPP_ROOT_CLASS } from './lib/subappScope.js';
</script>

<style>
.novel-sub-root {
  width: 100%;
  height: 100vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.novel-sub-root .novel-create-page,
.novel-sub-root .novel-detail-page {
  flex: 1;
  min-height: 0;
}
</style>
