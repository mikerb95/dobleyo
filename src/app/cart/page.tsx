'use client'
import { useCart } from '@/components/cart-context'
import { formatCurrency } from '@/lib/utils'

export default function CartPage() {
  const { items, total, remove, clear } = useCart()

  const checkout = async () => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map(({ id, name, price, qty }) => ({ id, name, price, qty })) })
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-coffee-800">Tu carrito</h1>
      {items.length === 0 ? (
        <p className="text-coffee-600">Tu carrito está vacío.</p>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {items.map((i) => (
              <div key={i.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="text-sm text-coffee-600">x{i.qty}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span>{formatCurrency(i.price * i.qty)}</span>
                  <button className="btn btn-outline" onClick={() => remove(i.id)}>Quitar</button>
                </div>
              </div>
            ))}
          </div>
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <strong>{formatCurrency(total)}</strong>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline flex-1" onClick={clear}>Vaciar</button>
              <button className="btn btn-primary flex-1" onClick={checkout}>Pagar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
