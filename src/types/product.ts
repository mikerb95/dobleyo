export type Variant = {
  id: string
  label: string
  size: '250g' | '500g' | '1kg'
  grind: 'grano' | 'molido'
  price: number
}

export type Product = {
  id: string
  name: string
  image: string
  tastingNotes: string[]
  origin: 'Sierra Nevada' | 'Huila' | 'Nariño' | string
  process: 'Lavado' | 'Honey' | 'Natural' | string
  roast: 'Claro' | 'Medio' | 'Oscuro' | string
  variants: Variant[]
}
