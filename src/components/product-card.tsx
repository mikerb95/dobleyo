'use client'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import { useCart } from './cart-context'
import { useState } from 'react'
import type { Product, Variant } from '@/data/products'

interface Props { product: Product }

export function ProductCard({ product }: Props) {
  const { add } = useCart()
  const [variant, setVariant] = useState<Variant>(product.variants[0])
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="relative aspect-square">
        <Image src={product.image} alt={product.name} fill className="object-cover" />
      </div>
      <div className="p-4 flex flex-col gap-2">
        <h3 className="font-medium text-coffee-800">{product.name}</h3>
        <p className="text-sm text-coffee-600">
          {product.tastingNotes.join(' • ')}
        </p>
        <div className="flex flex-wrap gap-2">
          {product.variants.map(v => (
            <button
              key={v.id}
              className={`badge ${variant.id === v.id ? 'ring-2 ring-coffee-500' : ''}`}
              onClick={() => setVariant(v)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className="font-semibold">{formatCurrency(variant.price)}</span>
          <button className="btn btn-primary" onClick={() => add({ ...product, price: variant.price, id: variant.id, name: `${product.name} — ${variant.label}` } as any)}>
            Añadir
          </button>
        </div>
      </div>
    </div>
  )
}
