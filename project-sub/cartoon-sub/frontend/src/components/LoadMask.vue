<template>
  <div v-if="loading" :style="maskStyle" role="status" aria-live="polite">
    <div :style="cardStyle">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="14" fill="none" stroke="#d7e6dc" stroke-width="3" />
        <circle cx="18" cy="18" r="14" fill="none" stroke="#2f8a5b" stroke-width="3" stroke-linecap="round" stroke-dasharray="64 28">
          <animateTransform attributeName="transform" type="rotate" from="0 18 18" to="360 18 18" dur="0.8s" repeatCount="indefinite" />
        </circle>
      </svg>
      <span :style="textStyle">加载中</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  loading: { type: Boolean, default: false },
});

const maskStyle = {
  position: 'absolute',
  inset: '0',
  zIndex: '30',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(247, 251, 248, 0.78)',
  backdropFilter: 'blur(1px)',
};

const cardStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  minWidth: '96px',
  minHeight: '96px',
  padding: '16px',
  borderRadius: '12px',
  background: 'rgba(255, 255, 255, 0.92)',
  boxShadow: '0 8px 28px rgba(31, 61, 44, 0.12)',
};

const textStyle = {
  color: '#1f3d2c',
  fontSize: '13px',
  lineHeight: '1',
};
</script>
