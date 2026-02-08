import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import HeroSection from '../components/HeroSection.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HeroSection', HeroSection);
  },
} satisfies Theme;
