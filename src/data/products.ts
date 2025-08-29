export const products = [
  {
    id: 'dbyo-sierra-250',
    name: 'Sierra Nevada — 250g',
    price: 42000,
    image: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?q=80&w=1200&auto=format&fit=crop',
    tastingNotes: ['Cacao', 'Nuez', 'Caramelo']
  },
  {
    id: 'dbyo-huila-250',
    name: 'Huila — 250g',
    price: 45000,
    image: 'https://images.unsplash.com/photo-1509043759401-136742328bb3?q=80&w=1200&auto=format&fit=crop',
    tastingNotes: ['Panela', 'Frutos rojos', 'Floral']
  },
  {
    id: 'dbyo-narino-250',
    name: 'Nariño — 250g',
    price: 48000,
    image: 'https://images.unsplash.com/photo-1494415859740-21e878dd929d?q=80&w=1200&auto=format&fit=crop',
    tastingNotes: ['Cítricos', 'Chocolate', 'Miel']
  }
] as const

export type Product = (typeof products)[number]
