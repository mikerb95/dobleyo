import type { Product, Variant } from '@/types/product'
export type { Product, Variant }

export const products: Product[] = [
  {
    id: 'dbyo-sierra',
    name: 'Sierra Nevada',
    image: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=1200&auto=format&fit=crop',
    tastingNotes: ['Cacao', 'Nuez', 'Caramelo'],
    origin: 'Sierra Nevada',
    process: 'Lavado',
    roast: 'Medio',
    variants: [
      { id: 'sierra-250g-grano', label: '250g / Grano', size: '250g', grind: 'grano', price: 42000 },
      { id: 'sierra-250g-molido', label: '250g / Molido', size: '250g', grind: 'molido', price: 42000 },
      { id: 'sierra-1kg-grano', label: '1kg / Grano', size: '1kg', grind: 'grano', price: 145000 }
    ]
  },
  {
    id: 'dbyo-huila',
    name: 'Huila',
    image: 'https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=1200&auto=format&fit=crop',
    tastingNotes: ['Panela', 'Frutos rojos', 'Floral'],
    origin: 'Huila',
    process: 'Honey',
    roast: 'Claro',
    variants: [
      { id: 'huila-250g-grano', label: '250g / Grano', size: '250g', grind: 'grano', price: 45000 },
      { id: 'huila-250g-molido', label: '250g / Molido', size: '250g', grind: 'molido', price: 45000 },
      { id: 'huila-500g-grano', label: '500g / Grano', size: '500g', grind: 'grano', price: 85000 }
    ]
  },
  {
    id: 'dbyo-narino',
    name: 'Nariño',
    image: 'https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=1200&auto=format&fit=crop',
    tastingNotes: ['Cítricos', 'Chocolate', 'Miel'],
    origin: 'Nariño',
    process: 'Natural',
    roast: 'Oscuro',
    variants: [
      { id: 'narino-250g-grano', label: '250g / Grano', size: '250g', grind: 'grano', price: 48000 },
      { id: 'narino-250g-molido', label: '250g / Molido', size: '250g', grind: 'molido', price: 48000 }
    ]
  }
]

