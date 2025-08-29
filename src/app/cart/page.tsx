'use client'
import { useState } from 'react'
import { useCart } from '@/components/cart-context'
import { formatCurrency } from '@/lib/utils'
import { shippingMethods } from '@/data/shipping'

export default function CartPage() {
  const { items, total, remove, clear } = useCart()
  const [coupon, setCoupon] = useState('')
  const [shipping, setShipping] = useState(shippingMethods[0].id)
  const [address, setAddress] = useState({ name: '', line1: '', city: '', region: '', phone: '' })
  const shippingPrice = shippingMethods.find(m => m.id === shipping)?.price || 0
  const discount = coupon.toUpperCase() === 'CAFECITO10' ? Math.round(total * 0.10) : (coupon.toUpperCase() === 'ENVIOGRATIS' ? 10000 : 0)
  const estimated = Math.max(0, total + shippingPrice - discount)

  const checkout = async () => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
        coupon,
        shipping,
        address,
      })
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
            <div className="space-y-1">
              <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(total)}</span></div>
              <div className="flex items-center justify-between"><span>Envío</span><span>{formatCurrency(shippingPrice)}</span></div>
              {discount > 0 && <div className="flex items-center justify-between text-green-700"><span>Descuento</span><span>-{formatCurrency(discount)}</span></div>}
              <div className="flex items-center justify-between">
                <span>Total estimado</span>
                <strong>{formatCurrency(estimated)}</strong>
              </div>
            </div>
            <div className="grid gap-2">
              <input className="border rounded-md p-2" placeholder="Cupón (opcional)" value={coupon} onChange={e=>setCoupon(e.target.value)} />
              <select className="border rounded-md p-2" value={shipping} onChange={e=>setShipping(e.target.value)}>
                {shippingMethods.map(m => <option key={m.id} value={m.id}>{m.name} — {formatCurrency(m.price)}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded-md p-2 col-span-2" placeholder="Nombre" value={address.name} onChange={e=>setAddress(a=>({...a,name:e.target.value}))} />
                <input className="border rounded-md p-2 col-span-2" placeholder="Dirección" value={address.line1} onChange={e=>setAddress(a=>({...a,line1:e.target.value}))} />
                <input className="border rounded-md p-2" placeholder="Ciudad" value={address.city} onChange={e=>setAddress(a=>({...a,city:e.target.value}))} />
                <input className="border rounded-md p-2" placeholder="Departamento" value={address.region} onChange={e=>setAddress(a=>({...a,region:e.target.value}))} />
                <input className="border rounded-md p-2 col-span-2" placeholder="Teléfono" value={address.phone} onChange={e=>setAddress(a=>({...a,phone:e.target.value}))} />
              </div>
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
