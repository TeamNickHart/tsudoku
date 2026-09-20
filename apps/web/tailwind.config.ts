import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // Semantic decoration roles. The game model emits role names; this is
        // the single place that decides what each one looks like.
        board: {
          given: 'hsl(var(--board-given))',
          entry: 'hsl(var(--board-entry))',
          error: 'hsl(var(--board-error))',
          note: 'hsl(var(--board-note))',
          'note-stale': 'hsl(var(--board-note-stale))',
          selected: 'hsl(var(--board-selected))',
          peer: 'hsl(var(--board-peer))',
          primary: 'hsl(var(--board-primary))',
          supporting: 'hsl(var(--board-supporting))',
          eliminated: 'hsl(var(--board-eliminated))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config;
