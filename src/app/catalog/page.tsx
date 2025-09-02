'use client'
'use client'
import { products as localProducts } from '@/data/products'
import { ProductCard } from '@/components/product-card'
import { useEffect, useMemo, useState } from 'react'

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)) }

export default function CatalogPage() {
  const [origin, setOrigin] = useState<string>('')
  const [procFilter, setProcFilter] = useState<string>('')
  const [roast, setRoast] = useState<string>('')
  const [products] = useState(localProducts)

  const origins = useMemo(() => unique(products.map(p => p.origin)), [products])
  const processes = useMemo(() => unique(products.map(p => p.process)), [products])
  const roasts = useMemo(() => unique(products.map(p => p.roast)), [products])

  const filtered = useMemo(() => products.filter(p => (
    (!origin || p.origin === origin) &&
    (!procFilter || p.process === procFilter) &&
    (!roast || p.roast === roast)
  )), [origin, procFilter, roast, products])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-coffee-800">Catálogo</h1>
      <div className="card p-4 grid sm:grid-cols-3 gap-3">
        <select className="border rounded-md p-2" value={origin} onChange={e => setOrigin(e.target.value)}>
          <option value="">Origen (todos)</option>
          {origins.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
  <select className="border rounded-md p-2" value={procFilter} onChange={e => setProcFilter(e.target.value)}>
          <option value="">Proceso (todos)</option>
          {processes.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="border rounded-md p-2" value={roast} onChange={e => setRoast(e.target.value)}>
          <option value="">Tostado (todos)</option>
          {roasts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  )
}
