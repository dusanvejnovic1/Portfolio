import fs from 'fs'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

const input = './app/globals.css'
const output = './test-tailwind.out.css'

const css = fs.readFileSync(input, 'utf8')

postcss([tailwind('./tailwind.config.ts'), autoprefixer()])
  .process(css, { from: input, to: output })
  .then(result => {
    fs.writeFileSync(output, result.css)
    console.log('Wrote', output)
  })
  .catch(err => {
    console.error('PostCSS build failed:', err)
    process.exit(1)
  })
