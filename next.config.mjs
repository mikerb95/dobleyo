/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
  { protocol: 'https', hostname: 'files.stripe.com' },
  { protocol: 'https', hostname: 'cdn.sanity.io' }
    ]
  }
}

export default nextConfig
