import { MetadataRoute } from 'next'
import { getBaseUrl } from '@/lib/env'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl()
  const routes = ['', '/about', '/catalog', '/faq', '/contact', '/policies', '/cart']
  return routes.map((r) => ({ url: `${base}${r}`, changeFrequency: 'weekly', priority: r === '' ? 1 : 0.7 }))
}
