'use client'
import { createContext, useContext, useMemo, useState } from 'react'

type Product = {
  id: string
  name: string
  price: number
  image: string
  tastingNotes: string[]
}

type Item = Product & { qty: number }

type CartContext = {
  items: Item[]
  add: (p: Product) => void
  remove: (id: string) => void
  clear: () => void
  count: number
  total: number
}

const Ctx = createContext<CartContext | null>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const add = (p: Product) =>
    setItems((prev) => {
      const found = prev.find((i) => i.id === p.id)
      if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
      return [...prev, { ...p, qty: 1 }]
    })
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id))
  const clear = () => setItems([])
  const { count, total } = useMemo(() => ({
    count: items.reduce((a, i) => a + i.qty, 0),
    total: items.reduce((a, i) => a + i.qty * i.price, 0)
  }), [items])

  const value: CartContext = { items, add, remove, clear, count, total }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
