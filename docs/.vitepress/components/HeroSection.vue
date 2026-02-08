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
