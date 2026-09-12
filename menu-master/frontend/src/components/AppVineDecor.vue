<template>
  <div class="app-vine" aria-hidden="true">
    <svg class="app-vine-svg" viewBox="0 0 240 360" fill="none" preserveAspectRatio="xMinYMax meet">
      <path
        class="app-vine-stem"
        d="M120 348 C96 342 62 338 38 322 C22 310 18 286 20 252 C22 210 14 176 18 138 C20 108 12 78 22 42"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
      <path
        class="app-vine-curl app-vine-curl--a"
        d="M38 322 C28 314 18 318 16 328 C20 334 32 330 38 322"
        stroke="currentColor"
        stroke-width="1.15"
        stroke-linecap="round"
      />
      <path
        class="app-vine-curl app-vine-curl--b"
        d="M20 252 C8 246 2 256 8 266 C16 270 24 260 20 252"
        stroke="currentColor"
        stroke-width="1.15"
        stroke-linecap="round"
      />
      <path
        class="app-vine-curl app-vine-curl--c"
        d="M18 138 C6 128 2 142 10 152 C20 154 26 142 18 138"
        stroke="currentColor"
        stroke-width="1.15"
        stroke-linecap="round"
      />
      <g class="app-vine-leaves" stroke="currentColor" stroke-width="1.05" stroke-linecap="round">
        <path d="M120 348 C108 336 96 334 86 340 C96 348 110 350 120 348" />
        <path d="M62 336 C50 326 40 328 36 338 C46 344 56 342 62 336" />
        <path d="M20 210 C8 198 0 204 4 216 C12 220 20 216 20 210" />
        <path d="M16 88 C6 74 -2 80 4 92 C12 96 20 90 16 88" />
        <path d="M22 42 C16 28 8 30 10 42 C16 48 24 46 22 42" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.app-vine {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: min(360px, 46%);
  pointer-events: none;
  z-index: 0;
  color: #2f8a5b;
  opacity: 0.22;
  overflow: hidden;
}

.app-vine-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.app-vine-stem {
  stroke-dasharray: 520;
  stroke-dashoffset: 520;
  animation: app-vine-grow 2.4s ease-out forwards;
}

.app-vine-curl,
.app-vine-leaves {
  opacity: 0;
  animation: app-vine-fade 0.8s ease-out forwards;
}

.app-vine-curl--a { animation-delay: 0.7s; }
.app-vine-curl--b { animation-delay: 1.15s; }
.app-vine-curl--c { animation-delay: 1.55s; }
.app-vine-leaves { animation-delay: 1.7s; }

@keyframes app-vine-grow {
  to { stroke-dashoffset: 0; }
}

@keyframes app-vine-fade {
  to { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .app-vine-stem,
  .app-vine-curl,
  .app-vine-leaves {
    animation: none;
    stroke-dashoffset: 0;
    opacity: 1;
  }
}
</style>
