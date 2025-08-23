import postcssTailwind from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

// Use the PostCSS bridge for Tailwind in ESM environments.
export default {
  plugins: [
    // Tailwind v4 PostCSS plugin auto-detects tailwind.config.* in project root
    postcssTailwind(),
    autoprefixer(),
  ],
};