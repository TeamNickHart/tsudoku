import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'TSudoku',
  description: 'A TypeScript-first Sudoku engine. Human techniques, machine precision.',
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'API', link: '/api/' },
      { text: 'Techniques', link: '/techniques/' },
      { text: 'ADR', link: '/adr/' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Quick Start', link: '/guide/quick-start' },
          ],
        },
      ],
      '/techniques/': [
        {
          text: 'Techniques',
          items: [{ text: 'Overview', link: '/techniques/' }],
        },
      ],
      '/adr/': [
        {
          text: 'Architecture Decisions',
          items: [{ text: 'Index', link: '/adr/' }],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/tsudoku/tsudoku' }],
  },
});
