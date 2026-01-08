import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'NestJS SSR',
  description: 'React SSR for NestJS with Clean Architecture',
  base: '/nestjs-ssr/',

  ignoreDeadLinks: true,

  head: [
    ['meta', { name: 'theme-color', content: '#E0234E' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
  ],

  themeConfig: {
    nav: [
      {
        text: 'GitHub',
        link: 'https://github.com/georgialexandrov/nestjs-ssr',
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/installation' },
          { text: 'Rendering', link: '/rendering' },
          { text: 'Request Context', link: '/request-context' },
          { text: 'Development', link: '/development' },
          { text: 'Decorators & Methods', link: '/api' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Navigation', link: '/navigation' },
        ],
      },
      {
        text: 'Guides',
        items: [
          { text: 'Layouts', link: '/guide/layouts' },
          { text: 'Authentication', link: '/guide/authentication' },
          { text: 'Tailwind CSS', link: '/guide/tailwindcss' },
        ],
      },
    ],

    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/georgialexandrov/nestjs-ssr',
      },
    ],

    search: {
      provider: 'local',
    },

    editLink: {
      pattern:
        'https://github.com/georgialexandrov/nestjs-ssr/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2025 Georgi Alexandrov',
    },
  },
});
