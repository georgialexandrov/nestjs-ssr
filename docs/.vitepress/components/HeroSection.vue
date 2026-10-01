<script setup>
import { withBase } from 'vitepress';
</script>

<template>
  <div class="hero-section">
    <div class="hero-package">@nestjs-ssr/react</div>
    <h1>
      React SSR for <span class="brand">NestJS</span>
    </h1>
    <p class="tagline">
      One app. One deploy. Full type safety from database to DOM.
    </p>
    <p class="hero-note">
      <a :href="withBase('/migration/0.3-to-0.4')">0.4</a>: NestJS 11 and 12,
      per-page code loading, view edits without restarts.
    </p>

    <div class="hero-actions">
      <a :href="withBase('/installation')" class="primary">Get Started</a>
      <a
        href="https://github.com/georgialexandrov/nestjs-ssr"
        class="secondary"
        target="_blank"
      >
        GitHub
      </a>
    </div>
  </div>
</template>

<style scoped>
.hero-note {
  margin-top: 0.75rem;
  font-size: 0.95rem;
  color: var(--vp-c-text-2);
}
.hero-note a {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
</style>
