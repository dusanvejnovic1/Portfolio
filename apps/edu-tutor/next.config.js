/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable server actions if needed
  },
  env: {
    // These will be available at build time
  NEXT_PUBLIC_APP_NAME: 'Portfolio AI',
  }
}

module.exports = nextConfig