import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'NestJS SSR',
  description: 'React SSR for NestJS with Clean Architecture',
  base: '/nest-ssr/',

  ignoreDeadLinks: true,

  head: [
    ['meta', { name: 'theme-color', content: '#E0234E' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/introduction' },
      { text: 'Reference', link: '/reference/api' },
      {
        text: 'GitHub',
        link: 'https://github.com/georgialexandrov/nestjs-ssr',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Core Concepts', link: '/guide/core-concepts' },
          ],
        },
        {
          text: 'Guides',
          items: [
            { text: 'Development Setup', link: '/guide/development-setup' },
            { text: 'Head Tags', link: '/guide/head-tags' },
          ],
        },
      ],
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
            { text: 'Hot Module Replacement', link: '/architecture/hmr' },
            { text: 'Streaming SSR', link: '/architecture/streaming' },
          ],
        },
      ],
      '/reference/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Decorators & Methods', link: '/reference/api' },
            { text: 'Configuration', link: '/reference/configuration' },
          ],
        },
      ],
    },

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
