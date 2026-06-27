<template>
  <div :class="SUBAPP_ROOT_CLASS">
    <router-view />
  </div>
</template>

<script setup>
import { SUBAPP_ROOT_CLASS } from './lib/subappScope.js';
</script>

<style>
.testgen-sub-root {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
</style>
