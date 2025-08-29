import { sanityClient, groq } from '@/lib/sanity'
import type { Product } from '@/types/product'

const query = groq`*[_type == "product" && defined(slug.current)]|order(_createdAt desc){
  "id": slug.current,
  name,
  "image": mainImage.asset->url,
  tastingNotes,
  origin,
  process,
  roast,
  variants[]{ id, label, size, grind, price }
}`

export async function fetchProductsFromSanity(): Promise<Product[]> {
  try {
    if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) return []
    const data = await sanityClient.fetch(query)
    return (data || []) as Product[]
  } catch (e) {
    console.error('Sanity fetch error', e)
    return []
  }
}
