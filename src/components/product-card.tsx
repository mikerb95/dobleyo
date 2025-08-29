'use client'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import { useCart } from './cart-context'

interface Props {
  product: {
    id: string
    name: string
    price: number
    image: string
    tastingNotes: string[]
  }
}

export function ProductCard({ product }: Props) {
  const { add } = useCart()
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
        <div className="mt-auto flex items-center justify-between">
          <span className="font-semibold">{formatCurrency(product.price)}</span>
          <button className="btn btn-primary" onClick={() => add(product)}>
            Añadir
          </button>
        </div>
      </div>
    </div>
  )
}
