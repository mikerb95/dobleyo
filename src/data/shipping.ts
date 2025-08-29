export type ShippingMethod = {
  id: string
  name: string
  price: number
}

export const shippingMethods: ShippingMethod[] = [
  { id: 'standard', name: 'Envío estándar (2-5 días)', price: 10000 },
  { id: 'express', name: 'Envío express (1-2 días)', price: 18000 },
]
