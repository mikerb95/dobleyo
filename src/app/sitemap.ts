import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const routes = ['', '/about', '/catalog', '/faq', '/contact', '/policies', '/cart']
  return routes.map((r) => ({ url: `${base}${r}`, changeFrequency: 'weekly', priority: r === '' ? 1 : 0.7 }))
}
