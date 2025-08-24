import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// PostCSS config: enable Tailwind + Autoprefixer so the @tailwind
// directives in `globals.css` are processed during build/dev.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};