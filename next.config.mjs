/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
  { protocol: 'https', hostname: 'images.unsplash.com' }
    ]
  }
}

export default nextConfig
