import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fix workspace root inference issue
  outputFileTracingRoot: __dirname,
  experimental: {
    // Enable server actions if needed
  },
  env: {
    // These will be available at build time
    NEXT_PUBLIC_APP_NAME: 'Portfolio AI',
  }
}

export default nextConfig