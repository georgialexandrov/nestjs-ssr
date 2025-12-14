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
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Rendering', link: '/guide/rendering' },
            { text: 'Request context', link: '/guide/request-context' },
            { text: 'Development', link: '/guide/development' },
            { text: 'Decorators & Methods', link: '/guide/api' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Navigation', link: '/guide/navigation' },
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
